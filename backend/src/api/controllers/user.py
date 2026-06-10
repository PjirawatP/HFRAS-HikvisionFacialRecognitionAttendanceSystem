from src.api.models.user import UserModel
from src.api.schemas.user import CreateUserSchema, UpdateUserSchema, UpdateUserStatusSchema
from src.api.services.user import UserService



class UserController:
    def __init__(self, service: UserService):
        self.service = service


    def user_list_handler(self):
        return self.service.user_list()


    def update_user_status_handler(self, user_id: int, data: UpdateUserStatusSchema, current_user: UserModel):
        return self.service.update_user_status(user_id, data.is_active, current_user)


    def delete_user_handler(self, user_id: int, current_user: UserModel):
        return self.service.delete_user(user_id, current_user)


    def admin_reset_password_handler(self, user_id: int, new_password: str, current_user: UserModel):
        return self.service.admin_reset_password(user_id, new_password, current_user)


    def unlock_user_handler(self, user_id: int, current_user: UserModel):
        return self.service.unlock_user(user_id, current_user)