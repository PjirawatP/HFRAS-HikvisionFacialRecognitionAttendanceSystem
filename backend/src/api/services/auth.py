from datetime import datetime, timedelta
from fastapi import HTTPException, status

from src.api.configs.setting import settings
from src.api.dependencies.auth import create_access_token, pwd_context, verify_password
from src.api.models.user import UserModel, UserRole
from src.api.repositories.auth import AuthRepository
from src.api.schemas.auth import SignInRequestSchema, SignUpRequestSchema



class AuthService:
    def __init__(self, repo: AuthRepository):
        self.repo = repo


    def sign_up(self, user_data: SignUpRequestSchema):
        existing_user = self.repo.get_user_by_username(user_data.username)

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )

        first_user = self.repo.get_first_user()
        is_first = first_user is None

        new_user = UserModel(
            username=user_data.username,
            hashed_password=pwd_context.hash(user_data.password),
            role=UserRole.SUPERADMIN if is_first else UserRole.USER,
            is_active=True if is_first else False,
        )

        created_user = self.repo.create_user(new_user)

        return {
            "id": created_user.id,
            "username": created_user.username,
            "role": created_user.role,
            "is_active": created_user.is_active,
            "is_first_user": is_first   # ✅ เพิ่มตัวนี้
        } 


    def sign_in(self, credentials: SignInRequestSchema):
        user = self.repo.get_user_by_username(credentials.username)

        if not user:
            raise HTTPException(status_code=401, detail="Incorrect username or password")

        if user.is_locked:
            if user.role == UserRole.SUPERADMIN and user.locked_at:
                duration = self._get_superadmin_lock_duration(user.lock_count)
                if datetime.utcnow() - user.locked_at > duration:
                    # auto unlock
                    user.is_locked = False
                    user.failed_login_attempts = 0
                    user.locked_at = None
                    self.repo.session.commit()
                else:
                    raise HTTPException(
                        status_code=403,
                        detail="Account is temporarily locked"
                    )
            else:
                raise HTTPException(
                    status_code=403,
                    detail="Account is locked. Please contact administrator."
                )

        if not verify_password(credentials.password, user.hashed_password):
            user.failed_login_attempts += 1

            if user.failed_login_attempts >= 5:
                user.is_locked = True
                user.locked_at = datetime.utcnow()

                if user.role == UserRole.SUPERADMIN:
                    user.lock_count += 1

            self.repo.session.commit()

            raise HTTPException(status_code=401, detail="Incorrect username or password")

        user.failed_login_attempts = 0
        user.is_locked = False
        user.locked_at = None
        user.lock_count = 0
        self.repo.session.commit()

        if not user.is_active:
            raise HTTPException(
                status_code=403,
                detail="Account is not yet activated. Please contact administrator."
            )

        access_token = create_access_token(
            data={"sub": user.username},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "force_password_change": user.force_password_change
        }


    def get_me(self, current_user: UserModel) -> UserModel:
        return current_user


    def request_password_reset(self, username: str):
        user = self.repo.get_user_by_username(username)

        if user:
            user.reset_requested_at = datetime.utcnow()
            self.repo.session.commit()

        return {
            "message": "If the account exists, a reset request has been submitted."
        }


    def change_password(self, current_user: UserModel, old_password: str, new_password: str):

        if not verify_password(old_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Old password is incorrect")

        if len(new_password) < 6:
            raise HTTPException(status_code=400, detail="New password too short (min 6 characters)")

        current_user.hashed_password = pwd_context.hash(new_password)

        # clear reset request
        current_user.reset_requested_at = None

        # reset security state
        current_user.failed_login_attempts = 0
        current_user.is_locked = False
        current_user.locked_at = None
        current_user.lock_count = 0
        current_user.force_password_change = False

        self.repo.session.commit()

        return {"message": "Password changed successfully"}


    def _get_superadmin_lock_duration(self, lock_count: int) -> timedelta:
        # escalation: 15 → 30 → 60 → 120 → max 240 นาที
        minutes = min(15 * (2 ** max(lock_count - 1, 0)), 240)
        return timedelta(minutes=minutes)