from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select, func, and_
from sqlalchemy import cast, Date, extract
from typing import List, Optional

from src.api.configs.database import get_session
from src.api.dependencies.auth import require_admin
from src.api.models.camera import CameraModel
from src.api.models.detection import DetectionModel
from src.api.models.face import FaceModel
from src.api.models.person import PersonModel
from src.api.models.system_setting import SystemSettingModel
from src.api.models.user import UserModel



router = APIRouter(
    prefix="/api/overview",
    tags=["Overview"]
)



class SummaryStats(BaseModel):
    total_cameras: int
    online_cameras: int
    offline_cameras: int
    total_persons: int
    blacklist_persons: int
    total_detections_today: int
    average_detections_per_day: float



class CameraStatusResponse(BaseModel):
    id: int
    name: str
    location: Optional[str]
    status: str
    detections_today: int
    uptime_percentage: float



class DetectionSummaryByCameraResponse(BaseModel):
    camera_name: str
    normal_count: int
    blacklist_count: int



class HourlyDetectionTrendResponse(BaseModel):
    hour: str
    count: int



class RecentDetectionResponse(BaseModel):
    id: int
    person_name: str
    camera_name: str
    detected_at: datetime
    similarity: float
    is_blacklist: bool
    detect_image_path: Optional[str]



class DetectionStatsResponse(BaseModel):
    normal: int
    blacklist: int



class SystemAlertResponse(BaseModel):
    id: int
    type: str
    title: str
    location: str
    time: datetime



@router.get("/summary", response_model=SummaryStats)
async def get_summary_stats(
    session: Session = Depends(get_session),
    current_user: UserModel = Depends(require_admin())
):
    total_cameras = session.exec(select(func.count(CameraModel.id))).one()

    online_cameras = session.exec(
        select(func.count(CameraModel.id)).where(CameraModel.is_detect == True)
    ).one()

    offline_cameras = total_cameras - online_cameras

    total_persons = session.exec(select(func.count(PersonModel.id))).one()

    blacklist_persons = session.exec(
        select(func.count(PersonModel.id)).where(PersonModel.is_blacklist == True)
    ).one()

    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    total_detections_today = session.exec(
        select(func.count(DetectionModel.id)).where(DetectionModel.detected_at >= today_start)
    ).one()

    thirty_days_ago = datetime.now() - timedelta(days=30)
    total_30_days = session.exec(
        select(func.count(DetectionModel.id)).where(DetectionModel.detected_at >= thirty_days_ago)
    ).one()

    average_detections_per_day = round(total_30_days / 30.0, 1) if total_30_days > 0 else 0.0

    return SummaryStats(
        total_cameras=total_cameras,
        online_cameras=online_cameras,
        offline_cameras=offline_cameras,
        total_persons=total_persons,
        blacklist_persons=blacklist_persons,
        total_detections_today=total_detections_today,
        average_detections_per_day=average_detections_per_day,
    )


@router.get("/camera-status", response_model=List[CameraStatusResponse])
async def get_camera_status(
    session: Session = Depends(get_session),
    current_user: UserModel = Depends(require_admin())
):
    cameras = session.exec(select(CameraModel)).all()

    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    result = []

    for camera in cameras:
        detections_today = session.exec(
            select(func.count(DetectionModel.id)).where(
                and_(
                    DetectionModel.camera_id == camera.id,
                    DetectionModel.detected_at >= today_start,
                )
            )
        ).one()

        result.append(
            CameraStatusResponse(
                id=camera.id,
                name=camera.name,
                location=camera.location,
                status="online" if camera.is_detect else "offline",
                detections_today=detections_today,
                uptime_percentage=99.8 if camera.is_detect else 0.0,
            )
        )

    return result


@router.get("/detection-summary-by-camera", response_model=List[DetectionSummaryByCameraResponse])
async def get_detection_summary_by_camera(
    period: str = "today",
    session: Session = Depends(get_session),
    current_user: UserModel = Depends(require_admin())
):
    now = datetime.now()

    if period == "today":
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_time = now - timedelta(days=7)
    elif period == "month":
        start_time = now - timedelta(days=30)
    else:
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)

    cameras = session.exec(select(CameraModel)).all()

    result = []

    for camera in cameras:
        normal_count = session.exec(
            select(func.count(DetectionModel.id))
            .join(FaceModel, DetectionModel.face_id == FaceModel.id)
            .join(PersonModel, FaceModel.person_id == PersonModel.id)
            .where(
                and_(
                    DetectionModel.camera_id == camera.id,
                    DetectionModel.detected_at >= start_time,
                    PersonModel.is_blacklist == False,
                )
            )
        ).one()

        blacklist_count = session.exec(
            select(func.count(DetectionModel.id))
            .join(FaceModel, DetectionModel.face_id == FaceModel.id)
            .join(PersonModel, FaceModel.person_id == PersonModel.id)
            .where(
                and_(
                    DetectionModel.camera_id == camera.id,
                    DetectionModel.detected_at >= start_time,
                    PersonModel.is_blacklist == True,
                )
            )
        ).one()

        result.append(
            DetectionSummaryByCameraResponse(
                camera_name=camera.name,
                normal_count=normal_count,
                blacklist_count=blacklist_count,
            )
        )

    return result


@router.get("/hourly-trend", response_model=List[HourlyDetectionTrendResponse])
async def get_hourly_detection_trend(
    session: Session = Depends(get_session),
    current_user: UserModel = Depends(require_admin())
):
    now = datetime.now()
    twenty_four_hours_ago = now - timedelta(hours=24)

    results = session.exec(
        select(
            func.date_trunc("hour", DetectionModel.detected_at).label("hour_bucket"),
            func.count(DetectionModel.id).label("count"),
        )
        .where(DetectionModel.detected_at >= twenty_four_hours_ago)
        .group_by("hour_bucket")
        .order_by("hour_bucket")
    ).all()

    trend_data = []

    for hour_bucket, count in results:
        label = hour_bucket.strftime("%d/%m/%Y %H:00")

        trend_data.append(
            HourlyDetectionTrendResponse(hour=label, count=count)
        )

    return trend_data


@router.get("/detection-stats", response_model=DetectionStatsResponse)
async def get_detection_stats(
    period: str = "today",
    session: Session = Depends(get_session),
    current_user: UserModel = Depends(require_admin())
):
    now = datetime.now()

    if period == "today":
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_time = now - timedelta(days=7)
    elif period == "month":
        start_time = now - timedelta(days=30)
    else:
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)

    normal = session.exec(
        select(func.count(DetectionModel.id))
        .join(FaceModel, DetectionModel.face_id == FaceModel.id)
        .join(PersonModel, FaceModel.person_id == PersonModel.id)
        .where(
            and_(
                DetectionModel.detected_at >= start_time,
                PersonModel.is_blacklist == False,
            )
        )
    ).one()

    blacklist = session.exec(
        select(func.count(DetectionModel.id))
        .join(FaceModel, DetectionModel.face_id == FaceModel.id)
        .join(PersonModel, FaceModel.person_id == PersonModel.id)
        .where(
            and_(
                DetectionModel.detected_at >= start_time,
                PersonModel.is_blacklist == True,
            )
        )
    ).one()

    return DetectionStatsResponse(normal=normal, blacklist=blacklist)


@router.get("/recent-detections", response_model=List[RecentDetectionResponse])
async def get_recent_detections(
    limit: int = 10, 
    session: Session = Depends(get_session),
    current_user: UserModel = Depends(require_admin()) 
):
    detections = session.exec(
        select(DetectionModel, PersonModel, CameraModel)
        .join(FaceModel, DetectionModel.face_id == FaceModel.id)
        .join(PersonModel, FaceModel.person_id == PersonModel.id)
        .join(CameraModel, DetectionModel.camera_id == CameraModel.id)
        .order_by(DetectionModel.detected_at.desc())
        .limit(limit)
    ).all()

    result = []

    for detection, person, camera in detections:
        person_name = person.first_name
        if person.last_name:
            person_name += f" {person.last_name}"

        result.append(
            RecentDetectionResponse(
                id=detection.id,
                person_name=person_name,
                camera_name=camera.name,
                detected_at=detection.detected_at,
                similarity=detection.similarity or 0.0,
                is_blacklist=person.is_blacklist,
                detect_image_path=detection.detect_image_path,
            )
        )

    return result


@router.get("/system-alerts", response_model=List[SystemAlertResponse])
async def get_system_alerts(
    limit: int = 10, 
    session: Session = Depends(get_session),
    current_user: UserModel = Depends(require_admin())
):
    alerts = []

    offline_cameras = session.exec(
        select(CameraModel).where(CameraModel.is_detect == False)
    ).all()

    for camera in offline_cameras:
        alerts.append(
            SystemAlertResponse(
                id=camera.id,
                type="error",
                title="กล้องออฟไลน์",
                location=camera.name,
                time=camera.updated_at,
            )
        )

    one_hour_ago = datetime.now() - timedelta(hours=1)

    blacklist_detections = session.exec(
        select(DetectionModel, CameraModel, PersonModel)
        .join(FaceModel, DetectionModel.face_id == FaceModel.id)
        .join(PersonModel, FaceModel.person_id == PersonModel.id)
        .join(CameraModel, DetectionModel.camera_id == CameraModel.id)
        .where(
            and_(
                DetectionModel.detected_at >= one_hour_ago,
                PersonModel.is_blacklist == True,
            )
        )
        .order_by(DetectionModel.detected_at.desc())
        .limit(limit)
    ).all()

    for detection, camera, person in blacklist_detections:
        person_name = person.first_name
        if person.last_name:
            person_name += f" {person.last_name}"

        alerts.append(
            SystemAlertResponse(
                id=detection.id + 10000,
                type="error",
                title=f"ตรวจพบบุคคลในบัญชีดำ: {person_name}",
                location=camera.name,
                time=detection.detected_at,
            )
        )

    if not offline_cameras:
        alerts.append(
            SystemAlertResponse(
                id=99999,
                type="success",
                title="ระบบทำงานปกติ",
                location="ทุกกล้อง",
                time=datetime.now(),
            )
        )

    alerts.sort(key=lambda x: x.time, reverse=True)

    return alerts[:limit]


@router.get("/detection-count-by-period")
async def get_detection_count_by_period(
    period: str = "7days",
    session: Session = Depends(get_session),
    current_user: UserModel = Depends(require_admin())
):
    now = datetime.now()
    days = {"7days": 7, "30days": 30, "90days": 90}.get(period, 7)
    start_date = now - timedelta(days=days)

    results = session.exec(
        select(
            cast(DetectionModel.detected_at, Date).label("date"),
            func.count(DetectionModel.id).label("count"),
        )
        .where(DetectionModel.detected_at >= start_date)
        .group_by("date")
        .order_by("date")
    ).all()

    return [{"date": str(date), "count": count} for date, count in results]


@router.get("/top-detected-persons")
async def get_top_detected_persons(
    limit: int = 10,
    period: str = "today",
    session: Session = Depends(get_session),
    current_user: UserModel = Depends(require_admin())
):
    now = datetime.now()

    if period == "today":
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_time = now - timedelta(days=7)
    elif period == "month":
        start_time = now - timedelta(days=30)
    else:
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)

    results = session.exec(
        select(
            PersonModel.id,
            PersonModel.first_name,
            PersonModel.last_name,
            PersonModel.position,
            PersonModel.is_blacklist,
            func.count(DetectionModel.id).label("detection_count"),
        )
        .join(FaceModel, PersonModel.id == FaceModel.person_id)
        .join(DetectionModel, FaceModel.id == DetectionModel.face_id)
        .where(DetectionModel.detected_at >= start_time)
        .group_by(PersonModel.id)
        .order_by(func.count(DetectionModel.id).desc())
        .limit(limit)
    ).all()

    return [
        {
            "id": pid,
            "name": f"{first} {last or ''}".strip(),
            "position": position,
            "is_blacklist": is_bl,
            "detection_count": count,
        }
        for pid, first, last, position, is_bl, count in results
    ]