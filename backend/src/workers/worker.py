import cv2, logging, math, threading, numpy as np, time, torch, os

from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from insightface.app import FaceAnalysis
from sqlmodel import Session, select
from typing import Dict, List, Optional

from src.api.models.detection import DetectionModel
from src.api.models.face import FaceModel
from src.api.models.person import PersonModel
from src.api.utils.face import cosine_similarity, crop_square_face, is_face_quality_ok
from src.api.utils.file import save_capture_face_image
from src.api.utils.notify import NotificationService
from src.api.configs.database import engine
from src.api.models.camera import CameraModel
from src.api.models.system_setting import SystemSettingModel



log = logging.getLogger("worker")
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")



# ─────────────────────────────────────────────────────────────────────────────
# FACE DETECTOR  (YuNet — one instance per camera thread)
# ─────────────────────────────────────────────────────────────────────────────
class FaceDetector:
    """YuNet lightweight detector – one instance per camera thread."""

    MAX_W, MAX_H = 640, 360          # never process larger than this

    def __init__(
        self,
        model_path: str = "./yunet.onnx",
        score_threshold: float = 0.55,
        nms_threshold: float = 0.3,
        top_k: int = 100,
    ):
        self._model_path      = model_path
        self._score_threshold = score_threshold
        self._nms_threshold   = nms_threshold
        self._top_k           = top_k
        self._detector        = None           # lazy-init inside the thread
        self._current_size    = (0, 0)

    def _build(self, w: int, h: int):
        self._detector = cv2.FaceDetectorYN.create(
            self._model_path, "",
            (w, h),
            score_threshold=self._score_threshold,
            nms_threshold=self._nms_threshold,
            top_k=self._top_k,
        )
        self._current_size = (w, h)

    def detect(self, frame: np.ndarray):
        """Returns faces array in *original* frame coordinates, or None."""
        oh, ow = frame.shape[:2]

        scale = min(self.MAX_W / ow, self.MAX_H / oh, 1.0)
        nw    = int(ow * scale)
        nh    = int(oh * scale)

        small = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_LINEAR) if scale < 1.0 else frame

        if self._detector is None or self._current_size != (nw, nh):
            self._build(nw, nh)

        _, faces = self._detector.detect(small)

        if faces is not None and scale < 1.0:
            inv = 1.0 / scale
            faces[:, :4] *= inv          # scale bbox back to original coords

        return faces


# ─────────────────────────────────────────────────────────────────────────────
# FACE TRACKER
# ─────────────────────────────────────────────────────────────────────────────
class FaceTracker:
    """
    ติดตามใบหน้าแต่ละหน้าข้ามเฟรม พร้อม Vote System เพื่อยืนยันตัวตน

    Vote System:
      - แต่ละครั้งที่ recognize ผ่าน threshold จะเพิ่ม vote ให้ person_id นั้น
      - ต้องได้ REQUIRED_VOTES ครั้ง จึงจะ confirm ว่าเป็นคนนั้นจริง
      - ป้องกัน false match จาก frame เดี่ยวที่คุณภาพต่ำ
    """

    REQUIRED_VOTES = 2      # ต้องชนะ 2 ครั้งขึ้นไปจึงยืนยัน

    def __init__(
        self,
        dist_threshold: int    = 120,
        lost_time: float       = 3.0,
        recognize_interval: float = 0.5,
        max_recognize_try: int = 8,         # เพิ่มจาก 5 → 8 เพื่อให้ vote ได้ครบ
    ):
        self.tracks: Dict[int, dict] = {}
        self._next_id          = 1
        self.dist_threshold    = dist_threshold
        self.lost_time         = lost_time
        self.recognize_interval = recognize_interval
        self.max_recognize_try  = max_recognize_try
        self._lock             = threading.Lock()

    # ------------------------------------------------------------------
    def match(self, cx: int, cy: int) -> Optional[int]:
        with self._lock:
            best_dist, best_id = self.dist_threshold, None
            for fid, d in self.tracks.items():
                px, py = d["center"]
                dist = math.hypot(cx - px, cy - py)
                if dist < best_dist:
                    best_dist, best_id = dist, fid
            return best_id

    def create(self, center: tuple, now: float) -> int:
        with self._lock:
            fid = self._next_id
            self._next_id += 1
            self.tracks[fid] = {
                "center":       center,
                "last_seen":    now,
                "recognized":   False,
                "person_id":    None,
                "recognize_try": 0,
                "last_try":     0.0,
                "recognizing":  False,
                # Vote buffer
                "votes":        {},     # {person_id: vote_count}
                "vote_scores":  {},     # {person_id: best_similarity_score}
            }
            return fid

    def update(self, fid: int, center: tuple, now: float):
        with self._lock:
            if fid in self.tracks:
                t = self.tracks[fid]
                t["center"]    = center
                t["last_seen"] = now

    def cleanup(self, now: float, used_ids: set):
        with self._lock:
            stale = [
                fid for fid, d in self.tracks.items()
                if fid not in used_ids and now - d["last_seen"] > self.lost_time
            ]
            for fid in stale:
                del self.tracks[fid]

    def can_recognize(self, fid: int, now: float) -> bool:
        with self._lock:
            if fid not in self.tracks:
                return False
            t = self.tracks[fid]
            return (
                not t["recognized"]
                and not t["recognizing"]
                and t["recognize_try"] < self.max_recognize_try
                and now - t["last_try"] >= self.recognize_interval
            )

    def mark_attempt(self, fid: int, now: float):
        with self._lock:
            if fid in self.tracks:
                t = self.tracks[fid]
                t["last_try"]      = now
                t["recognize_try"] += 1
                t["recognizing"]   = True

    def mark_done(self, fid: int):
        with self._lock:
            if fid in self.tracks:
                self.tracks[fid]["recognizing"] = False

    def mark_recognized(self, fid: int, person_id: int):
        """Direct confirm — ใช้เมื่อ vote ครบแล้ว"""
        with self._lock:
            if fid in self.tracks:
                t = self.tracks[fid]
                t["recognized"]  = True
                t["person_id"]   = person_id
                t["recognizing"] = False

    def add_vote(self, fid: int, person_id: int, score: float) -> Optional[int]:
        """
        เพิ่ม vote ให้ person_id และคืน person_id ถ้า vote ครบ REQUIRED_VOTES
        คืน None ถ้ายังไม่ครบ
        """
        with self._lock:
            if fid not in self.tracks:
                return None
            t = self.tracks[fid]
            t["recognizing"] = False

            votes       = t["votes"]
            vote_scores = t["vote_scores"]

            votes[person_id]       = votes.get(person_id, 0) + 1
            vote_scores[person_id] = max(score, vote_scores.get(person_id, 0.0))

            best_pid   = max(votes, key=votes.get)
            best_count = votes[best_pid]

            if best_count >= self.REQUIRED_VOTES:
                t["recognized"] = True
                t["person_id"]  = best_pid
                return best_pid

            return None   # ยังไม่ครบ รอ vote เพิ่ม


# ─────────────────────────────────────────────────────────────────────────────
# FACE RECOGNIZER  (singleton — shared across cameras)
# ─────────────────────────────────────────────────────────────────────────────
class FaceRecognizer:
    _CACHE_TTL = 300        # seconds

    def __init__(self, num_threads: int = 4, similarity_threshold: float = 0.45):
        log.info("Loading InsightFace model …")

        # Default threshold เพิ่มจาก 0.25 → 0.45
        # buffalo_l (ArcFace) : คนเดียวกัน ≈ 0.4–0.7 / คนต่างกัน ≈ 0.1–0.3
        self.threshold = similarity_threshold
        self._lock     = threading.Lock()
        self._cache: Optional[List[dict]] = None
        self._cache_ts = 0.0

        self.app = FaceAnalysis(name="buffalo_l")

        ctx = 0 if torch.cuda.is_available() else -1
        log.info("Using %s for InsightFace (ctx_id=%d)",
                 "GPU" if ctx == 0 else "CPU", ctx)

        self.app.prepare(ctx_id=ctx, det_size=(320, 320))

        log.info("InsightFace ready")

        self._executor = ThreadPoolExecutor(
            max_workers=num_threads,
            thread_name_prefix="recognizer",
        )

    # ------------------------------------------------------------------
    def update_threshold(self, v: float):
        self.threshold = v
        log.info("Similarity threshold → %.3f", v)

    # ------------------------------------------------------------------
    def _embeddings(self) -> List[dict]:
        """Return cached face embeddings + person names (refresh every CACHE_TTL s)."""
        now = time.time()
        with self._lock:
            if self._cache is not None and now - self._cache_ts < self._CACHE_TTL:
                return self._cache
            with Session(engine) as s:
                rows = s.exec(select(FaceModel)).all()
                person_ids = {r.person_id for r in rows}
                persons: dict = {}
                for pid in person_ids:
                    p = s.get(PersonModel, pid)
                    if p:
                        persons[pid] = (p.first_name or "", p.last_name or "")
                self._cache = [
                    {
                        "id":         r.id,
                        "person_id":  r.person_id,
                        "embedding":  np.asarray(r.face_embedding, dtype=np.float32),
                        "first_name": persons.get(r.person_id, ("Unknown", ""))[0],
                        "last_name":  persons.get(r.person_id, ("Unknown", ""))[1],
                    }
                    for r in rows
                ]
                self._cache_ts = now
            return self._cache

    def invalidate_cache(self):
        with self._lock:
            self._cache = None

    # ------------------------------------------------------------------
    def _best_match(self, query_emb: np.ndarray):
        """Vectorised cosine similarity over all stored embeddings."""
        faces_db = self._embeddings()
        if not faces_db:
            return None, 0.0

        mat    = np.stack([f["embedding"] for f in faces_db])   # (N, D)
        q      = query_emb / (np.linalg.norm(query_emb) + 1e-8)
        n      = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-8)
        scores = n @ q                                           # (N,)

        idx   = int(np.argmax(scores))
        score = float(scores[idx])
        return faces_db[idx], score

    # ------------------------------------------------------------------
    def recognize_async(self, image_bgr: np.ndarray, camera_id: int,
                        image_path: str, callback):
        self._executor.submit(self._worker, image_bgr, camera_id, image_path, callback)

    def _worker(self, image_bgr: np.ndarray, camera_id: int,
                image_path: str, callback):
        try:
            h, w = image_bgr.shape[:2]
            if h < 320 or w < 320:
                image_bgr = cv2.resize(image_bgr, (320, 320), interpolation=cv2.INTER_LINEAR)

            faces = self.app.get(image_bgr, max_num=1)
            if not faces:
                callback(None)
                return

            # กรอง frame ที่ InsightFace ตรวจหน้าได้ confidence ต่ำ
            face = faces[0]
            if face.det_score < 0.70:
                log.debug("Low det_score %.2f — skipped", face.det_score)
                callback(None)
                return

            query_emb         = face.embedding
            best_face, score  = self._best_match(query_emb)
            detected_at       = datetime.now()

            if best_face and score >= self.threshold:
                # บันทึก detection ทุกครั้งที่ผ่าน threshold (ไม่ใช่แค่ตอน confirm)
                # การ confirm จะทำใน _on_result ผ่าน Vote System
                with Session(engine) as session:
                    det = DetectionModel(
                        face_id=best_face["id"],
                        camera_id=camera_id,
                        detect_image_path=image_path,
                        similarity=round(float(score), 6),
                    )
                    session.add(det)
                    session.commit()

                callback({
                    "matched":    True,
                    "person_id":  best_face["person_id"],
                    "first_name": best_face.get("first_name", "Unknown"),
                    "last_name":  best_face.get("last_name", ""),
                    "similarity": round(float(score), 4),
                    "face_id":    best_face["id"],
                    "image_path": image_path,
                    "detected_at": detected_at,
                })
            else:
                callback({
                    "matched":    False,
                    "person_id":  None,
                    "first_name": "Unknown",
                    "last_name":  "",
                    "similarity": round(float(score), 4),
                    "image_path": image_path,
                    "detected_at": detected_at,
                })
        except Exception as exc:
            log.exception("recognize_worker error: %s", exc)
            callback(None)

    def cleanup(self):
        self._executor.shutdown(wait=False)


# ─────────────────────────────────────────────────────────────────────────────
# IMAGE ENHANCEMENT
# ─────────────────────────────────────────────────────────────────────────────
_CLAHE = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
_GAMMA_TABLE = np.array(
    [((i / 255.0) ** (1.0 / 1.2)) * 255 for i in range(256)], dtype=np.uint8
)

def enhance_face(img: np.ndarray) -> np.ndarray:
    """Lightweight enhancement: gamma + CLAHE on L channel only."""
    try:
        gamma = cv2.LUT(img, _GAMMA_TABLE)
        lab   = cv2.cvtColor(gamma, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        lab[:, :, 0] = _CLAHE.apply(l)
        return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    except Exception:
        return img


# ─────────────────────────────────────────────────────────────────────────────
# PER-CAMERA PIPELINE
# ─────────────────────────────────────────────────────────────────────────────
class CameraPipeline:
    """
    Two threads per camera:
      reader_thread  → grabs frames at camera speed, keeps only the latest
      detect_thread  → polls the latest frame, runs detection + recognition
    """

    def __init__(
        self,
        camera: CameraModel,
        recognizer: FaceRecognizer,
        notification_service: NotificationService,
        settings,
        detect_interval: float = 0.10,
        face_crop_size: int    = 360,
    ):
        self.camera_id   = camera.id
        self.camera_name = camera.name
        self.is_notify   = camera.is_notify

        self._recognizer = recognizer
        self._notif      = notification_service
        self._settings   = settings
        self._detect_iv  = detect_interval
        self._crop_size  = face_crop_size

        self._stream_url = (
            f"rtsp://{camera.username}:{camera.password}"
            f"@{camera.ip}:{camera.port}/ISAPI/Streaming/Channels/101"
        )

        self._latest_frame: Optional[np.ndarray] = None
        self._frame_lock   = threading.Lock()
        self._frame_event  = threading.Event()
        self._stop_event   = threading.Event()
        self._tracker      = FaceTracker()

        self._person_cooldown: Dict[int, float] = {}
        self._person_cooldown_sec = 10.0
        self._cooldown_lock = threading.Lock()

        self.frame_count       = 0
        self.detection_count   = 0
        self.recognition_count = 0
        self.is_alive          = False

        self._reader_thread = threading.Thread(
            target=self._reader_loop,
            name=f"reader-cam{camera.id}",
            daemon=True,
        )
        self._detect_thread = threading.Thread(
            target=self._detect_loop,
            name=f"detect-cam{camera.id}",
            daemon=True,
        )

    # ------------------------------------------------------------------
    def _make_threads(self):
        self._reader_thread = threading.Thread(
            target=self._reader_loop,
            name=f"reader-cam{self.camera_id}",
            daemon=True,
        )
        self._detect_thread = threading.Thread(
            target=self._detect_loop,
            name=f"detect-cam{self.camera_id}",
            daemon=True,
        )

    def start(self) -> bool:
        self._stop_event.clear()
        self._reader_thread.start()
        self._detect_thread.start()
        self.is_alive = True
        log.info("Camera %s pipeline started", self.camera_name)
        return True

    def stop(self):
        self._stop_event.set()
        self._frame_event.set()
        self.is_alive = False
        log.info("Camera %s pipeline stopping …", self.camera_name)

    def check_and_restart_threads(self):
        if self._stop_event.is_set():
            return
        restarted = False
        if not self._reader_thread.is_alive():
            log.warning("Camera %s reader thread died — restarting", self.camera_name)
            self._make_threads()
            self._reader_thread.start()
            restarted = True
        if not self._detect_thread.is_alive():
            log.warning("Camera %s detect thread died — restarting", self.camera_name)
            if not restarted:
                self._detect_thread = threading.Thread(
                    target=self._detect_loop,
                    name=f"detect-cam{self.camera_id}",
                    daemon=True,
                )
            self._detect_thread.start()

    def update_settings(self, settings, detect_interval: float):
        self._settings  = settings
        self._detect_iv = detect_interval

    # ------------------------------------------------------------------
    # READER THREAD
    # ------------------------------------------------------------------
    def _reader_loop(self):
        cap = None
        reconnect_delay = 2.0

        while not self._stop_event.is_set():
          try:
            if cap is None or not cap.isOpened():
                log.info("Camera %s connecting …", self.camera_name)
                cap = self._open_capture()
                if cap is None:
                    self._stop_event.wait(reconnect_delay)
                    reconnect_delay = min(reconnect_delay * 1.5, 30.0)
                    continue
                reconnect_delay = 2.0

            ret, frame = cap.read()
            if not ret or frame is None:
                log.warning("Camera %s lost frame, reconnecting …", self.camera_name)
                cap.release()
                cap = None
                continue

            if frame.size == 0 or frame.shape[0] < 16 or frame.shape[1] < 16:
                continue

            with self._frame_lock:
                self._latest_frame = frame
            self._frame_event.set()
            self.frame_count += 1

          except Exception as exc:
            log.error("Camera %s reader error: %s", self.camera_name, exc, exc_info=True)
            if cap:
                try:
                    cap.release()
                except Exception:
                    pass
            cap = None
            self._stop_event.wait(2.0)

        if cap:
            cap.release()

    def _open_capture(self) -> Optional[cv2.VideoCapture]:
        try:
            os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = (
                'rtsp_transport;tcp'
                '|fflags;nobuffer+discardcorrupt'
                '|flags;low_delay'
                '|buffer_size;65536'
            )
            cap = cv2.VideoCapture(self._stream_url + '?rtsp_transport=tcp', cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            cap.set(cv2.CAP_PROP_FPS, 25)
            if cap.isOpened():
                return cap
            cap.release()
        except Exception as exc:
            log.error("Camera %s open error: %s", self.camera_name, exc)
        return None

    # ------------------------------------------------------------------
    # DETECT THREAD
    # ------------------------------------------------------------------
    def _detect_loop(self):
        detector  = FaceDetector()
        last_time = 0.0

        while not self._stop_event.is_set():
            try:
                self._frame_event.wait(timeout=1.0)
                self._frame_event.clear()

                if self._stop_event.is_set():
                    break

                now = time.time()
                if now - last_time < self._detect_iv:
                    continue
                last_time = now

                with self._frame_lock:
                    frame = self._latest_frame
                if frame is None:
                    continue

                self._process(frame, detector, now)
            except Exception as exc:
                log.error("Camera %s detect error: %s", self.camera_name, exc, exc_info=True)
                time.sleep(0.5)

    # ------------------------------------------------------------------
    def _process(self, frame: np.ndarray, detector: FaceDetector, now: float):
        faces = detector.detect(frame)
        self.detection_count += 1

        if faces is None or len(faces) == 0:
            self._tracker.cleanup(now, set())
            return

        used_ids: set = set()

        for face in faces:
            x, y, w, h = map(int, face[:4])
            cx, cy = x + w // 2, y + h // 2

            fid = self._tracker.match(cx, cy) or self._tracker.create((cx, cy), now)
            self._tracker.update(fid, (cx, cy), now)
            used_ids.add(fid)

            if not self._tracker.can_recognize(fid, now):
                continue

            self._tracker.mark_attempt(fid, now)

            try:
                crop = crop_square_face(frame, x, y, w, h)
                if crop is None or crop.size == 0:
                    self._tracker.mark_done(fid)
                    continue

                if crop.shape[0] != self._crop_size:
                    crop = cv2.resize(crop, (self._crop_size, self._crop_size),
                                      interpolation=cv2.INTER_LINEAR)

                crop_enhanced = enhance_face(crop)

                # กรองคุณภาพก่อนส่ง recognize — ลด false match จาก frame blur/มืด
                if not is_face_quality_ok(crop_enhanced):
                    log.debug("cam=%s fid=%d skipped (low quality)", self.camera_name, fid)
                    self._tracker.mark_done(fid)
                    continue

                image_path = save_capture_face_image(crop_enhanced)

                _fid = fid
                self._recognizer.recognize_async(
                    crop_enhanced,
                    self.camera_id,
                    image_path,
                    callback=lambda r, f=_fid: self._on_result(f, r),
                )
            except Exception as exc:
                log.error("Crop error cam %s: %s", self.camera_name, exc)
                self._tracker.mark_done(fid)

        self._tracker.cleanup(now, used_ids)

    # ------------------------------------------------------------------
    def _is_cooldown_ok(self, person_id: int, now: float) -> bool:
        with self._cooldown_lock:
            last = self._person_cooldown.get(person_id, 0.0)
            if now - last >= self._person_cooldown_sec:
                self._person_cooldown[person_id] = now
                return True
            return False

    # ------------------------------------------------------------------
    def _on_result(self, fid: int, result: Optional[dict]):
        if result is None:
            self._tracker.mark_done(fid)
            return

        matched   = result.get("matched", False)
        person_id = result.get("person_id")
        now       = time.time()

        if matched and person_id:
            # Vote System — รอให้ครบ REQUIRED_VOTES ก่อน notify
            confirmed_pid = self._tracker.add_vote(
                fid, person_id, result.get("similarity", 0.0)
            )

            if confirmed_pid is None:
                # ยังไม่ครบ vote — รอ frame ถัดไป
                log.debug(
                    "cam=%s fid=%d person=%d voted (waiting …)",
                    self.camera_name, fid, person_id,
                )
                return

            # Vote ครบแล้ว — ยืนยันตัวตน
            if not self._is_cooldown_ok(confirmed_pid, now):
                return

            self.recognition_count += 1
            log.info(
                "✓ cam=%s person=%s %s %s (%.1f%%) [confirmed]",
                self.camera_name, confirmed_pid,
                result.get("first_name"), result.get("last_name"),
                result.get("similarity", 0) * 100,
            )

            if self.is_notify and self._settings.notify_on_match:
                self._notif.send_notification(
                    message="ตรวจพบบุคคล",
                    notification_type="match",
                    camera_name=self.camera_name,
                    person_id=confirmed_pid,
                    first_name=result.get("first_name"),
                    last_name=result.get("last_name"),
                    similarity=result.get("similarity"),
                    image_path=result.get("image_path"),
                    detected_at=result.get("detected_at"),
                )

        else:
            self._tracker.mark_done(fid)
            log.debug("? Unknown cam=%s (best=%.1f%%)",
                      self.camera_name, result.get("similarity", 0) * 100)

            if self.is_notify and self._settings.notify_on_unknown:
                self._notif.send_notification(
                    message="ตรวจพบบุคคลที่ไม่รู้จัก",
                    notification_type="unknown",
                    camera_name=self.camera_name,
                    person_id=None,
                    first_name="Unknown",
                    last_name="",
                    similarity=result.get("similarity"),
                    image_path=result.get("image_path"),
                    detected_at=result.get("detected_at"),
                )


# ─────────────────────────────────────────────────────────────────────────────
# CAMERA MANAGER
# ─────────────────────────────────────────────────────────────────────────────
class CameraManager:
    def __init__(
        self,
        recognizer: FaceRecognizer,
        notification_service: NotificationService,
        settings,
        detect_interval: float,
        face_crop_size: int,
    ):
        self._recognizer = recognizer
        self._notif      = notification_service
        self._settings   = settings
        self._detect_iv  = detect_interval
        self._crop_size  = face_crop_size

        self._pipelines: Dict[int, CameraPipeline] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    def update_cameras(self, cameras: List[CameraModel]):
        with self._lock:
            wanted = {c.id: c for c in cameras if c.is_detect}
            active = set(self._pipelines.keys())

            for cam_id, cam in wanted.items():
                if cam_id not in active:
                    self._start(cam)

            for cam_id in active - set(wanted.keys()):
                self._stop(cam_id)

            for cam_id, cam in wanted.items():
                if cam_id in self._pipelines:
                    self._pipelines[cam_id].is_notify = cam.is_notify

    def update_settings(self, settings, detect_interval: float):
        self._settings  = settings
        self._detect_iv = detect_interval
        with self._lock:
            for p in self._pipelines.values():
                p.update_settings(settings, detect_interval)

    def check_health(self):
        with self._lock:
            for p in list(self._pipelines.values()):
                try:
                    p.check_and_restart_threads()
                except Exception as exc:
                    log.error("Health check error cam %s: %s", p.camera_name, exc)

    # ------------------------------------------------------------------
    def _start(self, camera: CameraModel):
        p = CameraPipeline(
            camera=camera,
            recognizer=self._recognizer,
            notification_service=self._notif,
            settings=self._settings,
            detect_interval=self._detect_iv,
            face_crop_size=self._crop_size,
        )
        p.start()
        self._pipelines[camera.id] = p

    def _stop(self, camera_id: int):
        p = self._pipelines.pop(camera_id, None)
        if p:
            p.stop()

    def cleanup(self):
        with self._lock:
            for cam_id in list(self._pipelines.keys()):
                self._stop(cam_id)

    # ------------------------------------------------------------------
    @property
    def stats(self) -> dict:
        with self._lock:
            return {
                "cameras":      len(self._pipelines),
                "frames":       sum(p.frame_count       for p in self._pipelines.values()),
                "detections":   sum(p.detection_count   for p in self._pipelines.values()),
                "recognitions": sum(p.recognition_count for p in self._pipelines.values()),
            }


# ─────────────────────────────────────────────────────────────────────────────
# REPOSITORY
# ─────────────────────────────────────────────────────────────────────────────
class Repository:
    _cam_cache: Optional[List[CameraModel]] = None
    _cam_ts: float = 0.0
    _CAM_TTL = 30.0

    @classmethod
    def get_cameras(cls) -> List[CameraModel]:
        now = time.time()
        if cls._cam_cache and now - cls._cam_ts < cls._CAM_TTL:
            return cls._cam_cache
        try:
            with Session(engine) as s:
                cls._cam_cache = s.exec(select(CameraModel)).all()
                cls._cam_ts    = now
                return cls._cam_cache
        except Exception as exc:
            log.error("get_cameras: %s", exc)
            return cls._cam_cache or []

    @classmethod
    def get_settings(cls) -> Optional[SystemSettingModel]:
        try:
            with Session(engine) as s:
                return s.exec(select(SystemSettingModel)).first()
        except Exception as exc:
            log.error("get_settings: %s", exc)
            return None


# ─────────────────────────────────────────────────────────────────────────────
# MAIN WORKER
# ─────────────────────────────────────────────────────────────────────────────
class RealtimeFaceDetectionWorker:
    def __init__(
        self,
        detect_interval: float    = 0.10,
        camera_check_interval: int   = 30,
        settings_check_interval: int = 60,
        recognition_threads: int  = 4,
        face_crop_size: int       = 360,
        # legacy args kept for API compatibility
        detect_size: tuple        = (480, 270),
        display_size: tuple       = (960, 540),
        show_preview: bool        = False,
    ):
        self.should_stop = False
        self._detect_interval         = detect_interval
        self._camera_check_interval   = camera_check_interval
        self._settings_check_interval = settings_check_interval
        self._face_crop_size          = face_crop_size

        log.info("Initialising realtime system …")

        self.settings = self._load_or_create_settings()

        self.recognizer = FaceRecognizer(
            num_threads=recognition_threads,
            similarity_threshold=self.settings.accuracy_threshold,
        )

        self.notification_service = NotificationService(
            cooldown_seconds=self.settings.notification_cooldown
        )

        self.camera_manager = CameraManager(
            recognizer=self.recognizer,
            notification_service=self.notification_service,
            settings=self.settings,
            detect_interval=self._detect_interval,
            face_crop_size=self._face_crop_size,
        )

        self.frame_count       = 0
        self.detection_count   = 0
        self.recognition_count = 0

        log.info("System ready — recognition threads: %d", recognition_threads)

    # ------------------------------------------------------------------
    def _load_or_create_settings(self) -> SystemSettingModel:
        s = Repository.get_settings()
        if not s:
            s = SystemSettingModel(
                accuracy_threshold=0.45,
                detection_speed=0.10,
                notify_on_match=True,
                notify_on_unknown=False,
                notification_cooldown=30,
            )
            try:
                with Session(engine) as sess:
                    sess.add(s)
                    sess.commit()
                    sess.refresh(s)
            except Exception:
                pass

        log.info(
            "Settings: threshold=%.2f  speed=%.2fs  cooldown=%ds",
            s.accuracy_threshold, s.detection_speed, s.notification_cooldown,
        )
        return s

    # ------------------------------------------------------------------
    def _reload_settings(self):
        new = Repository.get_settings()
        if not new:
            return

        if new.accuracy_threshold != self.settings.accuracy_threshold:
            self.recognizer.update_threshold(new.accuracy_threshold)

        if new.notification_cooldown != self.settings.notification_cooldown:
            self.notification_service.update_cooldown(new.notification_cooldown)

        if new.detection_speed != self.settings.detection_speed:
            self._detect_interval = new.detection_speed
            log.info("Detection speed → %.3fs", new.detection_speed)

        self.settings = new
        self.camera_manager.update_settings(new, self._detect_interval)

    # ------------------------------------------------------------------
    def run(self):
        log.info("=" * 60)
        log.info("REALTIME Face Detection — Production Mode")
        log.info("=" * 60)

        last_cam_check      = 0.0
        last_settings_check = 0.0

        try:
            while not self.should_stop:
                try:
                    now = time.time()

                    if now - last_settings_check >= self._settings_check_interval:
                        self._reload_settings()
                        last_settings_check = now

                    if now - last_cam_check >= self._camera_check_interval:
                        cameras = Repository.get_cameras()
                        self.camera_manager.update_cameras(cameras)
                        last_cam_check = now

                    self.camera_manager.check_health()

                    st = self.camera_manager.stats
                    self.frame_count       = st["frames"]
                    self.detection_count   = st["detections"]
                    self.recognition_count = st["recognitions"]

                    log.debug(
                        "cams=%d  frames=%d  detections=%d  recognized=%d",
                        st["cameras"], st["frames"], st["detections"], st["recognitions"],
                    )

                except Exception as exc:
                    log.error("Main loop error (will retry): %s", exc, exc_info=True)

                time.sleep(1.0)

        except KeyboardInterrupt:
            log.info("KeyboardInterrupt — shutting down")
        finally:
            self.cleanup()

    # ------------------------------------------------------------------
    def cleanup(self):
        log.info("Cleanup …")
        self.should_stop = True
        if hasattr(self, "recognizer"):
            self.recognizer.cleanup()
        if hasattr(self, "camera_manager"):
            self.camera_manager.cleanup()
        log.info("Cleanup complete")


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    worker = RealtimeFaceDetectionWorker(
        detect_interval=0.10,
        camera_check_interval=30,
        settings_check_interval=60,
        recognition_threads=4,
        face_crop_size=360,
    )
    worker.run()