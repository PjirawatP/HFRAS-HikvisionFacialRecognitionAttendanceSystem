from src.api.schemas.camera import AddCameraRequestSchema, UpdateCameraRequestSchema
from src.api.services.camera import CameraService



class CameraController:
    def __init__(self, service: CameraService):
        self.service = service


    def camera_list_handler(self):
        return self.service.camera_list()


    def add_camera_handler(self, camera: AddCameraRequestSchema):
        return self.service.add_camera(camera)


    def get_camera_name_by_id_handler(self, camera_id: int):
        return self.service.get_camera_name_by_id(camera_id)


    def get_camera_by_id_handler(self, camera_id: int):
        return self.service.get_camera_by_id(camera_id)


    def edit_camera_handler(self, camera_id: int, camera: UpdateCameraRequestSchema):
        return self.service.edit_camera(camera_id, camera)


    def start_detect_handler(self, camera_id: int):
        return self.service.start_detect(camera_id)


    def stop_detect_handler(self, camera_id: int):
        return self.service.stop_detect(camera_id)


    def start_notify_handler(self, camera_id: int):
        return self.service.start_notify(camera_id)


    def stop_notify_handler(self, camera_id: int):
        return self.service.stop_notify(camera_id)


    def delete_camera_handler(self, camera_id: int):
        return self.service.delete_camera(camera_id)