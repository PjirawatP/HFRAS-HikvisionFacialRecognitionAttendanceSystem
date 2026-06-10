from src.api.services.detection import DetectionService



class DetectionController:
    def __init__(self, service: DetectionService):
        self.service = service


    def list_detections_handler(self):
        return self.service.list_detections()


    def get_detections_list_by_camera_id_handler(self, camera_id: int):
        return self.service.get_detections_list_by_camera_id(camera_id)


    def delete_detection_handler(self, detection_id: int):
        return self.service.delete_detection(detection_id)