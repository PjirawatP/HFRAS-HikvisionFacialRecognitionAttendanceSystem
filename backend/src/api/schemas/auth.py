from enum import Enum
from pydantic import BaseModel, Field
from sqlmodel import SQLModel
from typing import Optional

from src.api.models.user import UserRole



class UserResponseSchema(SQLModel):
    id: int
    username: str
    role: UserRole
    is_active: bool
    


class SignUpRequestSchema(SQLModel):
    username: str
    password: str



class SignUpResponseSchema(SQLModel):
    id: int
    username: str
    role: UserRole
    is_active: bool
    is_first_user: bool



class SignInResponseSchema(SQLModel):
    access_token: str
    token_type: str
    force_password_change: bool



class SignInRequestSchema(SQLModel):
    username: str
    password: str



class TokenData(SQLModel):
    username: Optional[str] = None



class UpdateUserRequestSchema(SQLModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None



class ForgotPasswordRequestSchema(SQLModel):
    username: str



class ChangePasswordSchema(BaseModel):
    old_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=6)



class ForgotPasswordRequestSchema(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)