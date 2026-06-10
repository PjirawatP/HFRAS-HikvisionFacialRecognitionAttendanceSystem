from typing import Optional
from sqlmodel import select

from src.api.configs.database import SessionDep
from src.api.models.camera import CameraModel
from src.api.models.detection import DetectionModel
from src.api.models.face import FaceModel
from src.api.models.person import PersonModel



class DetectionRepository:
    def __init__(self, session: SessionDep):
        self.session = session


    def get_all_detections(self):
        return self.session.exec(
            select(
                DetectionModel.id,
                FaceModel.face_image_path,
                DetectionModel.detect_image_path,
                PersonModel.external_id,
                PersonModel.first_name,
                PersonModel.last_name,
                PersonModel.position,
                PersonModel.group,
                PersonModel.is_blacklist,
                DetectionModel.similarity,
                CameraModel.name,
                DetectionModel.detected_at
            )
            .join(FaceModel, FaceModel.person_id == PersonModel.id)
            .join(DetectionModel, DetectionModel.face_id == FaceModel.id)
            .join(CameraModel, DetectionModel.camera_id == CameraModel.id)
            .order_by(DetectionModel.detected_at.desc())
        ).all()
    

    def get_detection_by_id(self, detection_id: int) -> Optional[DetectionModel]:
        return self.session.get(DetectionModel, detection_id)
    

    def get_detections_by_camera_id(self, camera_id: int):
        return self.session.exec(
            select(
                DetectionModel.id,
                FaceModel.face_image_path,
                DetectionModel.detect_image_path,
                PersonModel.external_id,
                PersonModel.first_name,
                PersonModel.last_name,
                PersonModel.position,
                PersonModel.group,
                PersonModel.is_blacklist,
                DetectionModel.similarity,
                DetectionModel.detected_at,
                CameraModel.name
            )
            .join(FaceModel, DetectionModel.face_id == FaceModel.id)
            .join(PersonModel, FaceModel.person_id == PersonModel.id)
            .join(CameraModel, DetectionModel.camera_id == CameraModel.id)
            .where(DetectionModel.camera_id == camera_id)
            .order_by(DetectionModel.detected_at.desc())
        ).all()
    

    def delete_detection(self, detection_id: int) -> bool:
        detection = self.session.get(DetectionModel, detection_id)
        if detection:
            self.session.delete(detection)
            self.session.commit()
            return True
        return False