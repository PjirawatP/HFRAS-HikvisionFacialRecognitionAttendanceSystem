from fastapi import HTTPException, status

from src.api.models.notification_channel import NotificationChannelModel
from src.api.schemas.setting import AddNotificationChannelRequestSchema, EditNotificationChannelRequestSchema, SettingRequestSchema
from src.api.models.system_setting import SystemSettingModel
from src.api.repositories.setting import SettingRepository



class SettingService:
    def __init__(self, repo: SettingRepository):
        self.repo = repo


    def get_setting(self):
        setting = self.repo.get_setting()

        if not setting:
                setting = SystemSettingModel(
                    accuracy_threshold = 0.25,
                    detection_speed = 0.15,
                    notify_on_match = True,
                    notify_on_unknown = False,
                    notification_cooldown = 30,
                )
                
                setting = self.repo.save_setting(setting)

        return setting


    def save_setting(self, setting_data: SettingRequestSchema):
        setting = self.repo.get_setting() 

        if not setting:
            setting = SystemSettingModel()

            self.repo.save_setting(setting)

        setting.accuracy_threshold = setting_data.accuracy_threshold
        setting.detection_speed = setting_data.detection_speed
        setting.notify_on_match = setting_data.notify_on_match
        setting.notify_on_unknown = setting_data.notify_on_unknown
        setting.notification_cooldown = setting_data.notification_cooldown

        setting = self.repo.save_setting(setting)

        return setting


    def notification_channel_list(self):
        notification_channels = self.repo.get_all_notification_channels()

        return notification_channels

    
    def add_notification_channel(self, notification_channel_data: AddNotificationChannelRequestSchema):
        notification_channel = NotificationChannelModel(
              platform = notification_channel_data.platform.lower(),
              access_token = notification_channel_data.access_token,
              target_id = notification_channel_data.target_id,
              is_active = notification_channel_data.is_active     
        ) 

        added_notification_channel = self.repo.save_notification_channel(notification_channel)

        return added_notification_channel


    def edit_notification_channel(self, id: int, notification_channel_data: EditNotificationChannelRequestSchema):
        notification_channel = self.repo.get_notification_channel_by_id(id)

        if not notification_channel:
            raise HTTPException(
                status_code = status.HTTP_404_NOT_FOUND,
                detail = "channel not found"
            )

        if notification_channel_data.platform is not None:
            notification_channel.platform = notification_channel_data.platform.lower()

        if notification_channel_data.access_token is not None:
            notification_channel.access_token = notification_channel_data.access_token

        if notification_channel_data.target_id is not None:
            notification_channel.target_id = notification_channel_data.target_id

        if notification_channel_data.is_active is not None:
            notification_channel.is_active = notification_channel_data.is_active

        edited_notification_channel = self.repo.save_notification_channel(notification_channel)

        return edited_notification_channel