from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel

from src.api.models.user import UserRole



class UserDataResponseSchema(SQLModel):
    id: int
    username: str
    role: UserRole
    is_active: bool
    is_locked: bool
    reset_requested_at: Optional[datetime]
    locked_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime



class AdminResetPasswordSchema(SQLModel):
    new_password: str



class CreateUserSchema(SQLModel):
    username: str
    password: str
    role: UserRole = UserRole.ADMIN



class UpdateUserSchema(SQLModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None



class UpdateUserStatusSchema(SQLModel):
    is_active: bool