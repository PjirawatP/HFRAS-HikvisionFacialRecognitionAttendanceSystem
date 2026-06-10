from fastapi import APIRouter, Depends, HTTPException, status

from src.api.schemas.user import AdminResetPasswordSchema, UpdateUserStatusSchema
from src.api.configs.database import SessionDep
from src.api.controllers.user import UserController
from src.api.dependencies.auth import require_admin, require_superadmin, get_current_active_user
from src.api.models.user import UserModel, UserRole
from src.api.repositories.user import UserRepository
from src.api.services.user import UserService



router = APIRouter(
    prefix="/user",
    tags=["User"]
)



def _get_controller(session: SessionDep) -> UserController:
    repo = UserRepository(session)
    service = UserService(repo)

    return UserController(service)


@router.get("/list")
def user_list(
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        return _get_controller(session).user_list_handler()
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in user_list: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="internal server error")


@router.patch("/{user_id}/status")
def update_user_status(
    user_id: int,
    data: UpdateUserStatusSchema,
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        return _get_controller(session).update_user_status_handler(user_id, data, current_user)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in update_user_status: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="internal server error")


@router.delete("/{user_id}/delete", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int,
    session: SessionDep,
    current_user: UserModel = Depends(require_superadmin())
):
    try:
        return _get_controller(session).delete_user_handler(user_id, current_user)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in delete_user: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="internal server error")


@router.post("/admin-reset/{user_id}")
def admin_reset_password(
    user_id: int,
    data: AdminResetPasswordSchema,
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        return _get_controller(session).admin_reset_password_handler(user_id, data.new_password, current_user)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in admin_reset_password: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="internal server error")


@router.post("/{user_id}/unlock")
def unlock_user(
    user_id: int,
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        return _get_controller(session).unlock_user_handler(user_id, current_user)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in unlock_user: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="internal server error")