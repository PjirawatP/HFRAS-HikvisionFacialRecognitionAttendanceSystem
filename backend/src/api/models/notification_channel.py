from datetime import datetime
from sqlmodel import SQLModel, Field
from typing import Optional



class NotificationChannelModel(SQLModel, table=True):
    __tablename__ = "notification_channels"

    id: Optional[int] = Field(default=None, primary_key=True)

    platform: str
    access_token: str
    target_id: str

    is_active: bool = True

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
