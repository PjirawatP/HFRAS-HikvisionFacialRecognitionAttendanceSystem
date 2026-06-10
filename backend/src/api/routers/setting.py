from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from src.api.configs.database import get_session, engine
from src.api.configs.database import SessionDep
from src.api.controllers.setting import SettingController
from src.api.models.notification_channel import NotificationChannelModel
from src.api.repositories.setting import SettingRepository
from src.api.schemas.setting import AddNotificationChannelRequestSchema, EditNotificationChannelRequestSchema, SettingRequestSchema
from src.api.services.setting import SettingService



router = APIRouter(
    prefix="/setting", 
    tags=["Setting"]
)


@router.get("/get")
def get_setting(session: SessionDep):
    try:
        repo = SettingRepository(session)
        service = SettingService(repo)
        controller = SettingController(service)

        return controller.get_setting_handler()

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in get_setting: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.put("/save")
def save_setting(setting: SettingRequestSchema, session: SessionDep):
    try:
        repo = SettingRepository(session)
        service = SettingService(repo)
        controller = SettingController(service)

        return controller.save_setting_handler(setting)

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in save_setting: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.get("/notification_channel/list")
def notification_channel_list(session: SessionDep):
    try:
        repo = SettingRepository(session)
        service = SettingService(repo)
        controller = SettingController(service)

        return controller.notification_channel_list_handler()

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in notification_channel_list: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.post("/notification_channel/add")
def add_notification_channel(notification_channel: AddNotificationChannelRequestSchema, session: SessionDep):
    try:
        repo = SettingRepository(session)
        service = SettingService(repo)
        controller = SettingController(service)

        return controller.add_notification_channel_handler(notification_channel)

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in add_notification_channel: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.put("/notification_channel/{id}/edit")
def edit_notification_channel(id: int, notification_channel: EditNotificationChannelRequestSchema, session: SessionDep):
    try:
        repo = SettingRepository(session)
        service = SettingService(repo)
        controller = SettingController(service)

        return controller.edit_notification_channel_handler(id, notification_channel)

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in edit_notification_channel: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.delete("/notification-channel/{channel_id}/delete")
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