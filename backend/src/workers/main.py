import time, threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from src.workers.worker import RealtimeFaceDetectionWorker



class WorkerStatusResponse(BaseModel):
    status: str
    uptime: Optional[float] = None
    frame_count: int = 0
    detection_count: int = 0
    recognition_count: int = 0



class MessageResponse(BaseModel):
    ok: bool
    message: str



class WorkerManager:
    def __init__(self):
        self.worker: Optional[RealtimeFaceDetectionWorker] = None
        self.worker_thread: Optional[threading.Thread] = None
        self.is_running = False
        self.start_time: Optional[float] = None
        self._lock = threading.Lock()


    def start(self) -> dict:
        with self._lock:
            if self.is_running:
                return {"ok": False, "message": "Worker is already running"}
            try:
                self.worker = RealtimeFaceDetectionWorker(
                    detect_interval=0.10,
                    camera_check_interval=30,
                    settings_check_interval=60,
                    recognition_threads=4,
                    face_crop_size=360,
                )
                self.worker_thread = threading.Thread(
                    target=self._run,
                    daemon=True,
                    name="worker-main",
                )
                self.worker_thread.start()
                self.is_running = True
                self.start_time = time.time()
                return {"ok": True, "message": "Worker started successfully"}

            except Exception as exc:
                self.is_running = False
                return {"ok": False, "message": f"Failed to start worker: {exc}"}


    def _run(self):
        try:
            if self.worker:
                self.worker.run()
        except Exception as exc:
            print(f"[ERROR] Worker crashed: {exc}")
        finally:
            self.is_running = False


    def stop(self) -> dict:
        with self._lock:
            if not self.is_running:
                return {"ok": False, "message": "Worker is not running"}
            try:
                if self.worker:
                    self.worker.cleanup()
                self.is_running = False
                self.start_time = None
                if self.worker_thread and self.worker_thread.is_alive():
                    self.worker_thread.join(timeout=10)
                self.worker = None
                self.worker_thread = None
                return {"ok": True, "message": "Worker stopped successfully"}

            except Exception as exc:
                return {"ok": False, "message": f"Failed to stop worker: {exc}"}


    def restart(self) -> dict:
        stop = self.stop()
        if not stop["ok"]:
            return stop
        time.sleep(2)
        return self.start()


    def get_status(self) -> WorkerStatusResponse:
        uptime = frame_count = detection_count = recognition_count = 0

        if self.is_running and self.start_time:
            uptime = time.time() - self.start_time
            if self.worker:
                frame_count       = getattr(self.worker, "frame_count", 0)
                detection_count   = getattr(self.worker, "detection_count", 0)
                recognition_count = getattr(self.worker, "recognition_count", 0)

        return WorkerStatusResponse(
            status="running" if self.is_running else "stopped",
            uptime=uptime or None,
            frame_count=frame_count,
            detection_count=detection_count,
            recognition_count=recognition_count,
        )



worker_manager = WorkerManager()



api = FastAPI(title="Worker API", version="1.0.0")



api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@api.on_event("startup")
async def on_startup():
    worker_manager.start()


@api.on_event("shutdown")
async def on_shutdown():
    worker_manager.stop()



@api.get("/")
def health():
    return {"status": "healthy", "service": "worker-api"}


@api.get("/status", response_model=WorkerStatusResponse)
def worker_status():
    return worker_manager.get_status()


@api.post("/start", response_model=MessageResponse)
def start_worker():
    return worker_manager.start()


@api.post("/stop", response_model=MessageResponse)
def stop_worker():
    return worker_manager.stop()   


@api.post("/restart", response_model=MessageResponse)
def restart_worker():
    return worker_manager.restart()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(api, host="0.0.0.0", port=8000, log_level="info")