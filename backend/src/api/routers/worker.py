import os

from fastapi import APIRouter, Depends, HTTPException

from src.api.controllers.worker import WorkerController
from src.api.dependencies.auth import require_admin, get_current_active_user
from src.api.models.user import UserModel
from src.api.services.worker import WorkerService



router = APIRouter(
    prefix="/worker",
    tags=["Worker"]
)



def get_worker_controller() -> WorkerController:
    service = WorkerService(base_url=os.getenv("WORKER_API_BASE_URL", "http://localhost:8001"))
    return WorkerController(service)


@router.get("/status")
def worker_status(
    controller: WorkerController = Depends(get_worker_controller),
    current_user: UserModel = Depends(get_current_active_user)
):
    try:
        return controller.get_status_handler()
    except Exception as e:
        print(f"error in worker_status: {e}")
        raise HTTPException(status_code=500, detail="internal server error")


@router.post("/start")
def start_worker(
    controller: WorkerController = Depends(get_worker_controller),
    current_user: UserModel = Depends(require_admin())
):
    try:
        return controller.start_handler()
    except Exception as e:
        print(f"error in start_worker: {e}")
        raise HTTPException(status_code=500, detail="internal server error")


@router.post("/stop")
def stop_worker(
    controller: WorkerController = Depends(get_worker_controller),
    current_user: UserModel = Depends(require_admin())
):
    try:
        return controller.stop_handler()
    except Exception as e:
        print(f"error in stop_worker: {e}")
        raise HTTPException(status_code=500, detail="internal server error")


@router.post("/restart")
def restart_worker(
    controller: WorkerController = Depends(get_worker_controller),
    current_user: UserModel = Depends(require_admin())
):
    try:
        return controller.restart_handler()
    except Exception as e:
        print(f"error in restart_worker: {e}")
        raise HTTPException(status_code=500, detail="internal server error")