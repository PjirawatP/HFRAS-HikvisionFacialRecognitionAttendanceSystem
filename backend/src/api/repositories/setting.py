from sqlmodel import select
from src.api.models.notification_channel import NotificationChannelModel
from src.api.configs.database import SessionDep
from src.api.models.system_setting import SystemSettingModel


class SettingRepository:
    def __init__(self, session: SessionDep):
        self.session = session


    def get_setting(self) -> SystemSettingModel | None:
        return self.session.exec(
            select(SystemSettingModel)
        ).first()


    def save_setting(self, settings: SystemSettingModel) -> SystemSettingModel:
        self.session.add(settings)
        self.session.commit()
        self.session.refresh(settings)

        return settings

    
    def get_all_notification_channels(self) -> NotificationChannelModel | None:
        return self.session.exec(
            select(NotificationChannelModel)
        ).all()
    

    def save_notification_channel(self, notification_channel) -> NotificationChannelModel:
        self.session.add(notification_channel)
        self.session.commit()
        self.session.refresh(notification_channel)

        return notification_channel

    
    def get_notification_channel_by_id(self, id: int) -> NotificationChannelModel:
        return self.session.exec(
            select(NotificationChannelModel).where(NotificationChannelModel.id == id)
        ).first()

        