import cv2, numpy as np, onnxruntime as ort

from insightface.app import FaceAnalysis
from typing import List, Optional



# ─────────────────────────────────────────────────────────────────────────────
# PROVIDER SETUP
# ─────────────────────────────────────────────────────────────────────────────
available_providers = ort.get_available_providers()
print("Available providers:", available_providers)

providers = []

if "CUDAExecutionProvider" in available_providers:
    providers.append("CUDAExecutionProvider")

providers.append("CPUExecutionProvider")

print("Using providers:", providers)

app = FaceAnalysis(
    name="buffalo_l",
    providers=providers,
    root="/root/.insightface"
)

ctx_id = 0 if "CUDAExecutionProvider" in providers else -1
app.prepare(ctx_id=ctx_id, det_size=(640, 640))   # ✅ เพิ่ม det_size ให้ใหญ่ขึ้น ตรวจจับหน้าเล็กได้ดีขึ้น

print("ctx_id:", ctx_id)



# ─────────────────────────────────────────────────────────────────────────────
# EXTRACT FACE EMBEDDING  (ใช้ตอน upload รูปลงทะเบียน)
# ─────────────────────────────────────────────────────────────────────────────
def extract_face_embedding(image_bytes: bytes) -> List[float]:
    image = cv2.imdecode(
        np.frombuffer(image_bytes, np.uint8),
        cv2.IMREAD_COLOR
    )

    if image is None:
        raise ValueError("Invalid image file")

    # Ensure minimum 640px for RetinaFace anchor grid — รูปเล็กทำให้ตรวจหน้าพลาด
    h, w = image.shape[:2]
    if h < 640 or w < 640:
        scale = 640 / min(h, w)
        new_w = int(w * scale)
        new_h = int(h * scale)
        image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    faces = app.get(image)

    if not faces:
        raise ValueError("No face detected")

    # เลือก face ที่ detection score สูงสุด กรณีมีหลายหน้าในรูป
    best_face = max(faces, key=lambda f: f.det_score)

    # กรองรูปคุณภาพต่ำออก ป้องกัน embedding ที่ไม่น่าเชื่อถือ
    if best_face.det_score < 0.70:
        raise ValueError(
            f"Face detection confidence too low ({best_face.det_score:.2f}). "
            "Please use a clearer front-facing photo."
        )

    return best_face.embedding.tolist()


# ─────────────────────────────────────────────────────────────────────────────
# COSINE SIMILARITY
# ─────────────────────────────────────────────────────────────────────────────
def cosine_similarity(a: list[float], b: list[float]) -> float:
    a = np.array(a)
    b = np.array(b)

    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


# ─────────────────────────────────────────────────────────────────────────────
# FACE QUALITY FILTER  (ใช้กับ crop จากกล้องก่อนส่ง recognize)
# ─────────────────────────────────────────────────────────────────────────────
def is_face_quality_ok(
    crop: np.ndarray,
    min_sharpness: float = 80.0,
    min_brightness: float = 40.0,
    max_brightness: float = 230.0,
) -> bool:
    """
    กรอง frame ที่คุณภาพต่ำออกก่อนส่ง recognize เพื่อลด false match

    - sharpness   : วัด Laplacian variance — ค่าต่ำ = ภาพ blur
    - brightness  : ป้องกัน underexposed (มืด) หรือ overexposed (สว่างเกิน)
    """
    if crop is None or crop.size == 0:
        return False

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    # Laplacian variance — ยิ่งสูงยิ่งคมชัด
    sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
    if sharpness < min_sharpness:
        return False

    brightness = float(gray.mean())
    if brightness < min_brightness or brightness > max_brightness:
        return False

    return True


# ─────────────────────────────────────────────────────────────────────────────
# FACE CROP  (ใช้กับ frame จากกล้อง)
# ─────────────────────────────────────────────────────────────────────────────
def crop_square_face(
    frame: np.ndarray,
    x: int,
    y: int,
    w: int,
    h: int,
    padding_ratio: float = 1.8,
) -> Optional[np.ndarray]:
    """
    Crop หน้าเป็นสี่เหลี่ยมจัตุรัส พร้อม padding รอบใบหน้า

    padding_ratio = 1.8 หมายถึงขนาด crop = 1.8x ของ bounding box ใบหน้า
    ปรับลดได้ถ้ากล้องอยู่ใกล้ / เพิ่มได้ถ้าต้องการบริบทรอบหน้ามากขึ้น
    """
    if frame is None or frame.size == 0:
        return None

    frame_h, frame_w = frame.shape[:2]

    center_x = x + w // 2
    center_y = y + h // 2

    size = int(max(w, h) * padding_ratio)

    x1 = max(0, center_x - size // 2)
    y1 = max(0, center_y - size // 2)
    x2 = min(frame_w, center_x + size // 2)
    y2 = min(frame_h, center_y + size // 2)

    actual_w = x2 - x1
    actual_h = y2 - y1

    if actual_w <= 0 or actual_h <= 0:
        return None

    face = frame[y1:y2, x1:x2]

    if actual_w < size or actual_h < size:
        # ชนขอบ — pad ด้วยสีดำให้ครบ square
        square = np.zeros((size, size, 3), dtype=np.uint8)
        y_off  = (size - actual_h) // 2
        x_off  = (size - actual_w) // 2
        square[y_off:y_off + actual_h, x_off:x_off + actual_w] = face
        return cv2.resize(square, (360, 360), interpolation=cv2.INTER_LINEAR)

    return cv2.resize(face, (360, 360), interpolation=cv2.INTER_LINEAR)