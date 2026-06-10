from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import List, Optional

from src.api.configs.database import SessionDep, engine
from src.api.models.notification_channel import NotificationChannelModel
from src.api.models.system_setting import SystemSettingModel



class NotificationChannelCreate(BaseModel):
    platform: str
    access_token: str
    target_id: Optional[str] = None
    is_active: bool = True



router = APIRouter(
    prefix="/notification_channel", 
    tags=["Notification Channel"]
)



@router.get("/list")
def notification_channel_list(session: SessionDep):
    try:
        repo = NotificationChannelRepository(session)
        service = NotificationChannelService(repo)
        controller = NotificationChannelController(service)

        return controller.notification_channel_list_handler()

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in notification_channel_list: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.get("/notification-channels", response_model = List[NotificationChannelModel])
def get_notification_channels():
    """ดึงรายการช่องทางการแจ้งเตือน"""
    try:
        with Session(engine) as session:
            channels = session.exec(select(NotificationChannelModel)).all()
            return channels
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/notification-channels", response_model=NotificationChannelModel)
def create_notification_channel(data: NotificationChannelCreate):
    try:
        with Session(engine) as session:
            channel = NotificationChannelModel(
                platform=data.platform.lower(),  # ป้องกันตัวพิมพ์ใหญ่
                access_token=data.access_token,
                target_id=data.target_id,
                is_active=data.is_active
            )
            session.add(channel)
            session.commit()
            session.refresh(channel)
            return channel
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/notification-channels/{channel_id}", response_model=NotificationChannelModel)
def update_notification_channel(
    channel_id: int,
    platform: str = None,
    access_token: str = None,
    target_id: str = None,
    is_active: bool = None
):
    try:
        with Session(engine) as session:
            channel = session.get(NotificationChannelModel, channel_id)
            if not channel:
                raise HTTPException(status_code=404, detail="Channel not found")
            
            if platform is not None:
                channel.platform = platform
            if access_token is not None:
                channel.access_token = access_token
            if target_id is not None:
                channel.target_id = target_id
            if is_active is not None:
                channel.is_active = is_active
            
            channel.updated_at = datetime.utcnow()
            session.commit()
            session.refresh(channel)
            return channel
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/notification-channels/{channel_id}")
def delete_notification_channel(channel_id: int):
    try:
        with Session(engine) as session:
            channel = session.get(NotificationChannelModel, channel_id)
            if not channel:
                raise HTTPException(status_code=404, detail="Channel not found")
            
            session.delete(channel)
            session.commit()
            return {"message": "Channel deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))