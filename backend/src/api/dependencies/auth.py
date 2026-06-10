from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlmodel import Session, select
from typing import Optional

from src.api.configs.database import get_session
from src.api.configs.setting import settings
from src.api.models.user import UserModel, UserRole
from src.api.schemas.auth import TokenData



pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()



def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session)
) -> UserModel:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    statement = select(UserModel).where(UserModel.username == token_data.username)
    user = session.exec(statement).first()
    
    if user is None:
        raise credentials_exception
    return user


def get_current_user_raw(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session)
) -> UserModel:

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token = credentials.credentials
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    statement = select(UserModel).where(UserModel.username == username)
    user = session.exec(statement).first()

    if user is None:
        raise credentials_exception

    return user


def get_current_active_user(
    current_user: UserModel = Depends(get_current_user_raw)
) -> UserModel:

    if not current_user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Inactive user"
        )

    return current_user


def get_current_verified_user(
    current_user: UserModel = Depends(get_current_active_user)
) -> UserModel:

    if current_user.force_password_change:
        raise HTTPException(
            status_code=403,
            detail="PASSWORD_CHANGE_REQUIRED"
        )

    return current_user


def require_role(allowed_roles: list[UserRole]):
    def role_checker(
        current_user: UserModel = Depends(get_current_verified_user)
    ) -> UserModel:

        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )

        return current_user

    return role_checker


require_admin = lambda: require_role([UserRole.ADMIN, UserRole.SUPERADMIN])
require_superadmin = lambda: require_role([UserRole.SUPERADMIN])