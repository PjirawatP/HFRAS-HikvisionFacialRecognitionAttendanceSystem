from typing import Optional
from sqlmodel import select

from src.api.configs.database import SessionDep
from src.api.models.camera import CameraModel
from src.api.models.detection import DetectionModel



class CameraRepository:
    def __init__(self, session: SessionDep):
        self.session = session


    def get_all_cameras(self) -> list[CameraModel]:
        return self.session.exec(
            select(CameraModel)
            .order_by(CameraModel.created_at.desc())
        ).all()


    def get_camera_by_id(self, camera_id: int) -> Optional[CameraModel]:
        return self.session.get(CameraModel, camera_id)


    def get_camera_by_name(self, name: str) -> Optional[CameraModel]:
        return self.session.exec(
            select(CameraModel).where(CameraModel.name == name)
        ).first()


    def get_camera_by_ip(self, ip: str) -> Optional[CameraModel]:
        return self.session.exec(
            select(CameraModel).where(CameraModel.ip == ip)
        ).first()


    def create_camera(self, new_camera: CameraModel) -> CameraModel:
        self.session.add(new_camera)
        self.session.commit()
        self.session.refresh(new_camera)

        return new_camera


    def update_camera(self, camera: CameraModel) -> CameraModel:
        self.session.add(camera)
        self.session.commit()
        self.session.refresh(camera)

        return camera


    def delete_camera(self, camera_id: int) -> bool:
        camera = self.session.get(CameraModel, camera_id)

        if camera:
            self.session.delete(camera)
            self.session.commit()
            return True
        return False


    def get_detecting_cameras(self) -> list[CameraModel]:
        return self.session.exec(
            select(CameraModel)
            .where(CameraModel.is_detect == True)
            .order_by(CameraModel.id.asc())
        ).all()


    def get_idle_cameras(self) -> list[CameraModel]:
        return self.session.exec(
            select(CameraModel)
            .where(CameraModel.is_detect == False)
            .order_by(CameraModel.id.asc())
        ).all()

    def get_detections_by_camera_id(self, camera_id: int) -> list[DetectionModel]:
        return self.session.exec(
            select(DetectionModel).where(DetectionModel.camera_id == camera_id)
        ).all()


    def delete_detections_by_camera_id(self, camera_id: int) -> None:
        detections = self.get_detections_by_camera_id(camera_id)
        for d in detections:
            self.session.delete(d)
        self.session.commit()