import asyncio, cv2, io, os, time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from src.api.configs.database import SessionDep
from src.api.controllers.camera import CameraController
from src.api.dependencies.auth import require_admin, require_superadmin, get_current_active_user
from src.api.models.user import UserModel
from src.api.repositories.camera import CameraRepository
from src.api.schemas.camera import AddCameraRequestSchema, UpdateCameraRequestSchema
from src.api.services.camera import CameraService



router = APIRouter(
    prefix = "/camera",
    tags = ["Camera"]
)



@router.get("/list")
def camera_list(
    session: SessionDep,
    current_user: UserModel = Depends(get_current_active_user)
):
    try:
        repo = CameraRepository(session)
        service = CameraService(repo)
        controller = CameraController(service)

        return controller.camera_list_handler()

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in camera_list: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.post("/add")
def add_camera(
    camera: AddCameraRequestSchema,
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        repo = CameraRepository(session)
        service = CameraService(repo)
        controller = CameraController(service)

        return controller.add_camera_handler(camera)
    
    except HTTPException:
        raise

    except Exception as e:
        print(f"Error in add_camera: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.get("/{camera_id}/name")
def get_camera_name_by_id(
    camera_id: int, 
    session: SessionDep,
    current_user: UserModel = Depends(get_current_active_user)
):
    try:
        repo = CameraRepository(session)
        service = CameraService(repo)
        controller = CameraController(service)

        return controller.get_camera_name_by_id_handler(camera_id)
    
    except HTTPException:
        raise

    except Exception as e:
        print(f"error in get_camera_name_by_id: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.get("/{camera_id}/info")
def get_camera_by_id(
    camera_id: int, 
    session: SessionDep,
    current_user: UserModel = Depends(get_current_active_user)
):
    try:
        repo = CameraRepository(session)
        service = CameraService(repo)
        controller = CameraController(service)

        return controller.get_camera_by_id_handler(camera_id)
    
    except HTTPException:
        raise

    except Exception as e:
        print(f"error in get_camera_by_id: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.put("/{camera_id}/edit")
def edit_camera(
    camera_id: int,
    camera: UpdateCameraRequestSchema,
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        repo = CameraRepository(session)
        service = CameraService(repo)
        controller = CameraController(service)

        return controller.edit_camera_handler(camera_id, camera)

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in edit_camera: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.patch("/{camera_id}/start-detect")
def start_detect(
    camera_id: int, 
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        repo = CameraRepository(session)
        service = CameraService(repo)
        controller = CameraController(service)

        return controller.start_detect_handler(camera_id)
    
    except HTTPException:
        raise

    except Exception as e:
        print(f"error in start_detect: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.patch("/{camera_id}/stop-detect")
def stop_detect(
    camera_id: int,
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        repo = CameraRepository(session)
        service = CameraService(repo)
        controller = CameraController(service)

        return controller.stop_detect_handler(camera_id)
    
    except HTTPException:
        raise

    except Exception as e:
        print(f"error in stop_detect: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.patch("/{camera_id}/start-notify")
def start_notify(
    camera_id: int, 
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        repo = CameraRepository(session)
        service = CameraService(repo)
        controller = CameraController(service)

        return controller.start_notify_handler(camera_id)
    
    except HTTPException:
        raise

    except Exception as e:
        print(f"error in start_notify: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.patch("/{camera_id}/stop-notify")
def stop_notify(
    camera_id: int, 
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        repo = CameraRepository(session)
        service = CameraService(repo)
        controller = CameraController(service)

        return controller.stop_notify_handler(camera_id)
    
    except HTTPException:
        raise

    except Exception as e:
        print(f"error in stop_notify: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.delete("/{camera_id}/delete")
def delete_camera(
    camera_id: int, 
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        repo = CameraRepository(session)
        service = CameraService(repo)
        controller = CameraController(service)

        return controller.delete_camera_handler(camera_id)
    
    except HTTPException:
        raise

    except Exception as e:
        print(f"error in delete_camera: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )