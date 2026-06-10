from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from typing_extensions import Literal



class AddCameraRequestSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="ชื่อกล้อง")
    location: Optional[str] = Field(None, max_length=500, description="ตำแหน่งที่ตั้ง")
    username: str = Field(..., min_length=1, max_length=255, description="RTSP Username")
    password: str = Field(..., min_length=1, max_length=255, description="RTSP Password")
    ip: str = Field(..., min_length=1, max_length=100, description="IP Address")
    port: str = Field(..., min_length=1, max_length=10, description="Port")
    channel: Literal[101, 102] = 102


    class Config:
        json_schema_extra = {
            "example": {
                "name": "Camera 1",
                "location": "Entrance",
                "username": "admin",
                "password": "password123",
                "ip": "192.168.1.100",
                "port": "554",
                "channel": 102
            }
        }



class UpdateCameraRequestSchema(BaseModel):
    """Schema สำหรับอัปเดตกล้อง (password optional)"""
    name: str = Field(..., min_length=1, max_length=255, description="ชื่อกล้อง")
    location: Optional[str] = Field(None, max_length=500, description="ตำแหน่งที่ตั้ง")
    username: str = Field(..., min_length=1, max_length=255, description="RTSP Username")
    password: Optional[str] = Field(None, min_length=1, max_length=255, description="RTSP Password (เว้นว่างถ้าไม่เปลี่ยน)")
    ip: str = Field(..., min_length=1, max_length=100, description="IP Address")
    port: str = Field(..., min_length=1, max_length=10, description="Port")
    channel: Optional[Literal[101, 102]] = None  


    class Config:
        json_schema_extra = {
            "example": {
                "name": "Camera 1",
                "location": "Entrance",
                "username": "admin",
                "password": None,
                "ip": "192.168.1.100",
                "port": "554",
                "channel": 102
            }
        }



class CameraResponseSchema(BaseModel):
    id: int
    name: str
    location: Optional[str]
    username: str
    ip: str
    port: str
    channel: int
    is_detect: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]


    class Config:
        from_attributes = True



class CameraListResponseSchema(BaseModel):
    cameras: list[CameraResponseSchema]
    total: int



class CameraStatusUpdateSchema(BaseModel):
    is_detect: bool


    class Config:
        json_schema_extra = {
            "example": {
                "is_detect": True
            }
        }