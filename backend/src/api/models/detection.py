from datetime import datetime
from sqlmodel import TIMESTAMP, Column, Float, SQLModel, Field, Text, func
from typing import Optional



class DetectionModel(SQLModel, table = True):
    __tablename__ = "detections"

    id: Optional[int] = Field(default = None, primary_key = True)
    face_id: int = Field(foreign_key = "faces.id")
    camera_id: int = Field(foreign_key = "cameras.id")
    detect_image_path: Optional[str] = Field(default = None, sa_column = Column(Text))
    similarity: Optional[float] = Field(default = None, sa_column = Column(Float, nullable = True))
    detected_at: datetime = Field(sa_column = Column(TIMESTAMP(timezone = True), server_default = func.now(), nullable = False))