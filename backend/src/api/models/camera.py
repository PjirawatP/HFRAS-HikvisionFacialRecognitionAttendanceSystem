from datetime import datetime
from sqlmodel import TIMESTAMP, Boolean, Column, SQLModel, Field, Text, func
from typing import Optional



class CameraModel(SQLModel, table = True):
    __tablename__ = "cameras"

    id: Optional[int] = Field(default = None, primary_key = True)
    name: str = Field(max_length=255)
    location: Optional[str] = Field(default = None, sa_column = Column(Text))
    username: str = Field(max_length=255)
    password: str = Field(max_length=255)
    ip: str = Field(max_length=100)
    port: str = Field(max_length=10)
    channel: int = Field(default=102)
    is_detect: bool = Field(default = False, sa_column = Column(Boolean, nullable = False))
    is_notify: bool = Field(default = False, sa_column = Column(Boolean, nullable = False))
    created_at: datetime = Field(sa_column = Column(TIMESTAMP(timezone = True), server_default = func.now(), nullable = False))
    updated_at: datetime = Field(sa_column = Column(TIMESTAMP(timezone = True), server_default = func.now(), onupdate = func.now(), nullable = False))