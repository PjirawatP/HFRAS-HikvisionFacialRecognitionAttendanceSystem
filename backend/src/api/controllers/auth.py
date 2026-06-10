from src.api.models.user import UserModel
from src.api.services.auth import AuthService
from src.api.schemas.auth import SignInRequestSchema, UserResponseSchema



class AuthController:
    def __init__(self, service: AuthService):
        self.service = service


    def sign_up_handler(self, user_data: UserResponseSchema):
        return self.service.sign_up(user_data)
    

    def sign_in_handler(self, user_credentials: SignInRequestSchema):
        return self.service.sign_in(user_credentials)

    
    def get_me_handler(self, current_user: UserModel):
        return self.service.get_me(current_user)


    def request_password_reset_handler(self, username: str):
        return self.service.request_password_reset(username)