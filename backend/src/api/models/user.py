from datetime import datetime
from enum import Enum
from sqlmodel import TIMESTAMP, Column, SQLModel, Field, func
from typing import Optional



class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"



class UserModel(SQLModel, table=True):
    __tablename__ = "users"
    
    id: Optional[int] = Field(default = None, primary_key = True)
    username: str = Field(unique = True, index = True)
    hashed_password: str
    role: UserRole = Field(default = UserRole.USER)
    is_active: bool = Field(default = True)
    lock_count: int = Field(default=0)
    is_locked: bool = Field(default=False)
    failed_login_attempts: int = Field(default=0)
    locked_at: Optional[datetime] = None
    force_password_change: bool = Field(default=False)
    reset_requested_at: Optional[datetime] = None
    created_at: datetime = Field(sa_column = Column(TIMESTAMP(timezone = True), server_default = func.now(), nullable = False))
    updated_at: datetime = Field(sa_column = Column(TIMESTAMP(timezone = True), server_default = func.now(), onupdate = func.now(), nullable = False))