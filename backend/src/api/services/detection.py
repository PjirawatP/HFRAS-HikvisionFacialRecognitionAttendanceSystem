from fastapi import HTTPException
from fastapi.responses import JSONResponse

from src.api.models.camera import CameraModel
from src.api.repositories.camera import CameraRepository
from src.api.repositories.detection import DetectionRepository



class DetectionService:
    def __init__(self, detection_repo: DetectionRepository, camera_repo: CameraRepository):
        self.detection_repo = detection_repo
        self.camera_repo = camera_repo


    def list_detections(self):
        detections = self.detection_repo.get_all_detections()

        return [
            {
                "id": detection.id ,
                "face_image_path": detection.face_image_path,
                "detect_image_path": detection.detect_image_path,
                "external_id": detection.external_id,
                "first_name": detection.first_name,
                "last_name": detection.last_name,
                "position": detection.position,
                "group": detection.group,
                "is_blacklist": detection.is_blacklist,
                "camera_name": detection.name,
                "similarity": detection.similarity,
                "detected_at": detection.detected_at 
            }

            for detection in detections 
        ]

        
    def get_detections_list_by_camera_id(self, camera_id: int):
        camera = self.camera_repo.get_camera_by_id(camera_id)

        if not camera:
            raise JSONResponse(
                status_code = 404,
                content = {
                    "status": 1,
                    "message": f"Camera with ID {camera_id} not found",
                    "data": {}
                }
            )

        detections = self.detection_repo.get_detections_by_camera_id(camera_id)

        return [
            {
                "id": d.id,
                "face_image_path": d.face_image_path,
                "detect_image_path": d.detect_image_path,
                "external_id": d.external_id,
                "first_name": d.first_name,
                "last_name": d.last_name,
                "position": d.position,
                "group": d.group,
                "is_blacklist": d.is_blacklist,
                "similarity": d.similarity,
                "detected_at": d.detected_at,
                "camera_name": d.name
            }
            for d in detections
        ]


    def delete_detection(self, detection_id: int):
        detection = self.detection_repo.get_detection_by_id(detection_id)

        if not detection:
            raise JSONResponse(
                status_code = 404,
                content = {
                    "status": 1,
                    "message": f"Detection with ID {detection_id} not found",
                    "data": {}
                }
            )

        self.detection_repo.delete_detection(detection_id)

        return JSONResponse(
            status_code = 200,
            content = {
                "status": 0,
                "message": f"Detection with ID {detection_id} deleted successfully",
                "data": {}
            }
        )