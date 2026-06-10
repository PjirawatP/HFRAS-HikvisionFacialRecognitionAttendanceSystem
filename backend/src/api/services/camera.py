
import os, time

from fastapi import HTTPException

from src.api.models.camera import CameraModel
from src.api.repositories.camera import CameraRepository
from src.api.schemas.camera import AddCameraRequestSchema, UpdateCameraRequestSchema
from src.api.services.mediamtx import MediaMTXService



BASE_IMAGE_DIR = "/app/files"



class CameraService:
    def __init__(self, repo: CameraRepository):
        self.repo = repo


    def _build_rtsp_url(self, camera: CameraModel) -> str:
        return (
            f"rtsp://{camera.username}:{camera.password}"
            f"@{camera.ip}:{camera.port}/ISAPI/Streaming/Channels/{camera.channel}"
        )


    def _path_name(self, camera_id: int) -> str:
        return f"camera_{camera_id}"


    def camera_list(self):
        cameras = self.repo.get_all_cameras()

        return [
            {
                "id": cam.id,
                "name": cam.name,
                "location": cam.location,
                "ip": cam.ip,
                "port": cam.port,
                "channel": cam.channel,
                "is_detect": cam.is_detect,
                "is_notify": cam.is_notify,
                "created_at": cam.created_at,
                "updated_at": cam.updated_at,
            }
            for cam in cameras
        ]


    def add_camera(self, data: AddCameraRequestSchema):

        if self.repo.get_camera_by_ip(data.ip):
            raise HTTPException(400, f"camera with ip {data.ip} already exists")

        new_camera = CameraModel(
            name=data.name,
            location=data.location,
            username=data.username,
            password=data.password,
            ip=data.ip,
            port=data.port,
            channel=data.channel,
        )

        rtsp_url = self._build_rtsp_url(new_camera)

        created = self.repo.create_camera(new_camera)
        path_name = self._path_name(created.id)

        try:
            MediaMTXService.upsert_path(path_name, rtsp_url)
        except Exception as e:
            self.repo.delete_camera(created.id)
            raise HTTPException(500, f"failed to add camera to mediamtx: {repr(e)}")

        return {
            "id": created.id,
            "name": created.name,
            "location": created.location,
            "ip": created.ip,
            "port": created.port,
            "channel": created.channel,
            "is_detect": created.is_detect,
        }

    
    def get_camera_name_by_id(self, camera_id: int):
        camera = self.repo.get_camera_by_id(camera_id)

        if not camera:
            raise HTTPException(404, f"camera with id {camera_id} not found")

        return {"id": camera.id, "name": camera.name}

    
    def get_camera_by_id(self, camera_id: int):
        camera = self.repo.get_camera_by_id(camera_id)

        if not camera:
            raise HTTPException(404, "camera not found")

        return {
            "id": camera.id,
            "name": camera.name,
            "location": camera.location,
            "ip": camera.ip,
            "port": camera.port,
            "channel": camera.channel,
            "is_detect": camera.is_detect,
            "is_notify": camera.is_notify,
            "created_at": camera.created_at,
            "updated_at": camera.updated_at,
        }


    def edit_camera(self, camera_id: int, data: UpdateCameraRequestSchema):

        camera = self.repo.get_camera_by_id(camera_id)
        if not camera:
            raise HTTPException(404, "camera not found")

        update_data = data.model_dump(
            exclude_unset=True,
            exclude={"is_detect", "is_notify"},
        )

        # duplicate IP
        new_ip = update_data.get("ip")
        if new_ip:
            existing = self.repo.get_camera_by_ip(new_ip)
            if existing and existing.id != camera_id:
                raise HTTPException(400, "ip already exists")

        # backup
        original_state = {
            field: getattr(camera, field)
            for field in update_data.keys()
            if hasattr(camera, field)
        }

        # apply temp
        for field, value in update_data.items():
            if field == "password" and not value:
                continue
            setattr(camera, field, value)

        CONNECTION_FIELDS = {"ip", "port", "username", "password", "channel"}

        need_stream_update = bool(CONNECTION_FIELDS & set(update_data.keys()))

        rtsp_url = self._build_rtsp_url(camera)
        path_name = self._path_name(camera.id)

        # 1️ validate first
        if need_stream_update:
            try:
                MediaMTXService.upsert_path(path_name, rtsp_url)
            except Exception as e:
                # rollback state
                for k, v in original_state.items():
                    setattr(camera, k, v)

                raise HTTPException(500, f"mediamtx update failed: {repr(e)}")

        # 3️ update DB LAST
        try:
            updated = self.repo.update_camera(camera)
        except Exception as e:
            raise HTTPException(500, f"database update failed: {e}")

        return {
            "id": updated.id,
            "ip": updated.ip,
            "is_detect": updated.is_detect,
            "is_notify": updated.is_notify,
        } 


    def delete_camera(self, camera_id: int):
        camera = self.repo.get_camera_by_id(camera_id)

        if not camera:
            raise HTTPException(404, "camera not found")

        path_name = self._path_name(camera_id)

        # Remove stream first
        try:
            MediaMTXService.remove_path(path_name)
        except Exception:
            pass

        # Delete images safely
        detections = self.repo.get_detections_by_camera_id(camera_id)

        for detection in detections:
            if detection.detect_image_path:

                full_path = os.path.abspath(
                    os.path.join(BASE_IMAGE_DIR, detection.detect_image_path)
                )

                if not full_path.startswith(BASE_IMAGE_DIR):
                    continue

                try:
                    if os.path.exists(full_path):
                        os.remove(full_path)
                except Exception:
                    pass

        self.repo.delete_detections_by_camera_id(camera_id)
        self.repo.delete_camera(camera_id)

        return {"message": "delete camera successfully"}


    def start_detect(self, camera_id: int):
        camera = self.repo.get_camera_by_id(camera_id)

        if not camera:
            raise HTTPException(404, f"camera {camera_id} not found")

        if camera.is_detect:
            raise HTTPException(400, "camera already detecting")

        camera.is_detect = True
        self.repo.update_camera(camera)

        return {"id": camera.id, "is_detect": True}


    def stop_detect(self, camera_id: int):
        camera = self.repo.get_camera_by_id(camera_id)

        if not camera:
            raise HTTPException(404, f"camera {camera_id} not found")

        if not camera.is_detect:
            raise HTTPException(400, "camera already idle")

        camera.is_detect = False
        self.repo.update_camera(camera)

        return {"id": camera.id, "is_detect": False}


    def start_notify(self, camera_id: int):
        camera = self.repo.get_camera_by_id(camera_id)

        if not camera:
            raise HTTPException(404, f"camera {camera_id} not found")

        if camera.is_notify:
            raise HTTPException(400, "camera already notifying")

        camera.is_notify = True
        self.repo.update_camera(camera)

        return {"id": camera.id, "is_notify": True}


    def stop_notify(self, camera_id: int):
        camera = self.repo.get_camera_by_id(camera_id)

        if not camera:
            raise HTTPException(404, f"camera {camera_id} not found")

        if not camera.is_notify:
            raise HTTPException(400, "camera already not notifying")

        camera.is_notify = False
        self.repo.update_camera(camera)

        return {"id": camera.id, "is_notify": False}