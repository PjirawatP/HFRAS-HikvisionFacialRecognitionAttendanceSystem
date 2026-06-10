from src.api.schemas.setting import AddNotificationChannelRequestSchema, SettingRequestSchema
from src.api.services.setting import SettingService



class SettingController:
    def __init__(self, service: SettingService):
        self.service = service


    def get_setting_handler(self):
        return self.service.get_setting()
    

    def save_setting_handler(self, setting: SettingRequestSchema):
        return self.service.save_setting(setting)


    def notification_channel_list_handler(self):
        return self.service.notification_channel_list()


    def add_notification_channel_handler(self, notification_channel: AddNotificationChannelRequestSchema):
        return self.service.add_notification_channel(notification_channel)


    def edit_notification_channel_handler(self, id: int, notification_channel: AddNotificationChannelRequestSchema):
        return self.service.edit_notification_channel(id, notification_channel)

    