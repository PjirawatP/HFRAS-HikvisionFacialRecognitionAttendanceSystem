from typing import Optional
from sqlmodel import SQLModel



class SettingRequestSchema(SQLModel):
    accuracy_threshold: float
    detection_speed: float
    notify_on_match: bool
    notify_on_unknown: bool
    notification_cooldown: int



class AddNotificationChannelRequestSchema(SQLModel):
    platform: str
    access_token: str
    target_id: Optional[str] = None
    is_active: bool = True



class EditNotificationChannelRequestSchema(SQLModel):
    platform: Optional[str] = None
    access_token: Optional[str] = None
    target_id: Optional[str] = None
    is_active: Optional[bool] = None