from datetime import datetime
from typing import List, Optional
from pgvector.sqlalchemy import Vector
from sqlmodel import TIMESTAMP, Column, Field, SQLModel, Text, func



class FaceModel(SQLModel, table = True):
    __tablename__ = "faces"

    id: Optional[int] = Field(default = None, primary_key = True)
    person_id: int = Field(foreign_key = "persons.id", unique = True, nullable = False)
    face_image_path: Optional[str] = Field(default = None, sa_column = Column(Text))
    face_embedding: List[float] = Field(sa_column = Column(Vector(512), nullable = False))
    created_at: datetime = Field(sa_column = Column(TIMESTAMP(timezone = True), server_default = func.now(), nullable = False))
    updated_at: datetime = Field(sa_column = Column(TIMESTAMP(timezone = True), server_default = func.now(), onupdate = func.now(), nullable = False))