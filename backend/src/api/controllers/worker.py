from src.api.services.worker import WorkerService



class WorkerController:
    def __init__(self, service: WorkerService):
        self.service = service


    def get_status_handler(self):
        return self.service.get_status()


    def start_handler(self):
        return self.service.start()


    def stop_handler(self):
        return self.service.stop()


    def restart_handler(self):
        return self.service.restart()