from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from src.api.configs.database import SessionDep
from src.api.controllers.detection import DetectionController
from src.api.dependencies.auth import require_admin, require_superadmin, get_current_active_user
from src.api.models.user import UserModel
from src.api.repositories.camera import CameraRepository
from src.api.repositories.detection import DetectionRepository
from src.api.services.detection import DetectionService



router = APIRouter(
    prefix = "/detection",
    tags = ["Detection"]
)



@router.get("/list")
def list_detections(
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
    ):
    try:
        detection_repo = DetectionRepository(session)
        camera_repo = CameraRepository(session)
        service = DetectionService(detection_repo, camera_repo)  # แก้ไขบรรทัดนี้
        controller = DetectionController(service)

        return controller.list_detections_handler()
    
    except HTTPException:
        raise

    except Exception as e:
        print(f"error in list_detections: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.get("/list/{camera_id}")
def get_detections_list_by_camera_id(
    camera_id: int, 
    session: SessionDep,
    current_user: UserModel = Depends(get_current_active_user)
):
    try:
        detection_repo = DetectionRepository(session)
        camera_repo = CameraRepository(session)
        service = DetectionService(detection_repo, camera_repo)        
        controller = DetectionController(service)

        return controller.get_detections_list_by_camera_id_handler(camera_id)

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in get_detections_list_by_camera_id: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.delete("/{detection_id}/delete")
def delete_detection(
    detection_id: int, 
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        repo = DetectionRepository(session)
        service = DetectionService(repo, None)  # No need for camera_repo in delete operation
        controller = DetectionController(service)

        return controller.delete_detection_handler(detection_id)
    
    except HTTPException:
        raise

    except Exception as e:
        print(f"error in delete_detection: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )