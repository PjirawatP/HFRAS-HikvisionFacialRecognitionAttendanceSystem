from fastapi import APIRouter, Depends, HTTPException, Response, status

from src.api.configs.database import SessionDep
from src.api.controllers.auth import AuthController
from src.api.dependencies.auth import get_current_active_user
from src.api.models.user import UserModel
from src.api.repositories.auth import AuthRepository
from src.api.schemas.auth import (ChangePasswordSchema, ForgotPasswordRequestSchema, SignInRequestSchema, SignInResponseSchema, SignUpRequestSchema, SignUpResponseSchema, UserResponseSchema)
from src.api.services.auth import AuthService



router = APIRouter(
    prefix="/auth", 
    tags=["Auth"]
)



@router.post("/sign-up", response_model=SignUpResponseSchema)
def sign_up(user_data: SignUpRequestSchema, session: SessionDep):
    try:
        repo = AuthRepository(session)
        service = AuthService(repo)
        controller = AuthController(service)
        return controller.sign_up_handler(user_data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in sign_up: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="internal server error")


@router.post("/sign-in", response_model=SignInResponseSchema)
def sign_in(user_credentials: SignInRequestSchema, response: Response, session: SessionDep):
    try:
        repo = AuthRepository(session)
        service = AuthService(repo)
        controller = AuthController(service)

        result = controller.sign_in_handler(user_credentials)
        access_token = result["access_token"]

        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=False,   # True in production
            samesite="lax",
            max_age=60 * 60,
        )

        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in sign_in: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="internal server error")


@router.post("/sign-out")
def sign_out(response: Response):
    response.delete_cookie(key="access_token")
    return {"message": "Signed out successfully"}


@router.get("/get-me", response_model=UserResponseSchema)
def get_me(current_user: UserModel = Depends(get_current_active_user)):
    return current_user


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequestSchema, session: SessionDep):
    try:
        repo = AuthRepository(session)
        service = AuthService(repo)
        controller = AuthController(service)
        return controller.request_password_reset_handler(data.username)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in forgot_password: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="internal server error")


@router.post("/change-password")
def change_password(
    data: ChangePasswordSchema,
    session: SessionDep,
    current_user: UserModel = Depends(get_current_active_user)
):
    try:
        repo = AuthRepository(session)
        service = AuthService(repo)
        return service.change_password(current_user, data.old_password, data.new_password)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in change_password: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="internal server error")