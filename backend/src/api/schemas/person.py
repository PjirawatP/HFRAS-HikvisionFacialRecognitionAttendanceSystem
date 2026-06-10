from fastapi import UploadFile
from sqlmodel import Field, SQLModel
from typing import Optional



class AddPersonRequestSchema(SQLModel):
    external_id: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    position: Optional[str] = None
    group: Optional[str] = None
    is_blacklist: bool = False 



class PersonResponseSchema(SQLModel):
    person_id: int
    external_id: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    position: Optional[str] = None
    group: Optional[str] = None
    is_blacklist: bool
    face_image_path: str



class EditPersonRequestSchema(SQLModel):
    external_id: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    position: Optional[str] = None
    group: Optional[str] = None
    is_blacklist: bool = False 



class ImportPersonRowSchema(SQLModel):
    external_id: str | None = None
    first_name: str
    last_name: str | None = None
    position: str | None = None
    group: str | None = None
    is_blacklist: bool = False