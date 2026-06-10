from datetime import datetime
from typing import Optional
from sqlmodel import TIMESTAMP, Boolean, Column, Field, SQLModel, Text, func



class PersonModel(SQLModel, table = True):
    __tablename__ = "persons"

    id: Optional[int] = Field(default = None, primary_key = True)
    external_id: Optional[str] = Field(default = None, sa_column = Column(Text))
    first_name: str = Field(sa_column = Column(Text, nullable = False))
    last_name: Optional[str] = Field(default = None, sa_column = Column(Text))
    position: Optional[str] = Field(default = None, sa_column = Column(Text))
    group: Optional[str] = Field(default = None, sa_column = Column(Text))
    is_blacklist: bool = Field(default = False, sa_column = Column(Boolean, nullable = False))
    created_at: datetime = Field(sa_column = Column(TIMESTAMP(timezone = True), server_default = func.now(), nullable = False))
    updated_at: datetime = Field(sa_column = Column(TIMESTAMP(timezone = True), server_default = func.now(), onupdate = func.now(), nullable = False))