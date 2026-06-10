from datetime import datetime
from sqlmodel import SQLModel, Field
from typing import Optional



class SystemSettingModel(SQLModel, table=True):
    __tablename__ = "system_settings"

    id: Optional[int] = Field(default=None, primary_key=True)

    accuracy_threshold: float = 0.7
    detection_speed: float = 0.3

    notify_on_match: bool = True
    notify_on_unknown: bool = False

    notification_cooldown: int = 30

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
