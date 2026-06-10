from fastapi import HTTPException

from src.api.dependencies.auth import pwd_context
from src.api.models.user import UserModel, UserRole
from src.api.repositories.user import UserRepository
from src.api.schemas.user import UpdateUserSchema



class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo


    def user_list(self):
        users = self.repo.get_all_users()
        return [
            {
                "id": u.id,
                "username": u.username,
                "role": u.role,
                "is_active": u.is_active,
                "is_locked": u.is_locked,
                "reset_requested_at": u.reset_requested_at,
                "locked_at": u.locked_at,
                "updated_at": u.updated_at,
                "created_at": u.created_at,
            }
            for u in users
        ]


    def update_user_status(self, user_id: int, is_active: bool, current_user: UserModel):
        user = self._get_or_404(user_id)
        self._guard_superadmin(user, current_user)

        # ห้าม deactivate ตัวเอง
        if user.id == current_user.id and not is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

        user.is_active = is_active
        self.repo.session.commit()
        return {"message": f"User {'activated' if is_active else 'deactivated'} successfully"}


    def delete_user(self, user_id: int, current_user: UserModel):
        user = self._get_or_404(user_id)

        # ห้ามลบตัวเอง
        if user.id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot delete your own account")

        # ห้าม admin ลบ superadmin
        if user.role == UserRole.SUPERADMIN and current_user.role != UserRole.SUPERADMIN:
            raise HTTPException(status_code=403, detail="Forbidden")

        self.repo.session.delete(user)
        self.repo.session.commit()
        return {"message": "User deleted successfully"}


    def admin_reset_password(self, user_id: int, new_password: str, current_user: UserModel):
        user = self._get_or_404(user_id)
        self._guard_superadmin(user, current_user)

        user.hashed_password = pwd_context.hash(new_password)
        user.reset_requested_at = None
        user.failed_login_attempts = 0
        user.is_locked = False
        user.lock_count = 0
        user.force_password_change = True   # 🔥 สำคัญมาก

        self.repo.session.commit()
        return {"message": "Password reset successful"}


    def unlock_user(self, user_id: int, current_user: UserModel):
        user = self._get_or_404(user_id)
        self._guard_superadmin(user, current_user)

        user.is_locked = False
        user.failed_login_attempts = 0
        user.locked_at = None

        self.repo.session.commit()

        return {"message": "User unlocked successfully"}


    def _get_or_404(self, user_id: int) -> UserModel:
        user = self.repo.session.get(UserModel, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user


    def _guard_superadmin(self, target: UserModel, current_user: UserModel):
        if target.role == UserRole.SUPERADMIN and current_user.role != UserRole.SUPERADMIN:
            raise HTTPException(status_code=403, detail="Forbidden")