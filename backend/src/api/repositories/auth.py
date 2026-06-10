from typing import Optional
from sqlmodel import select

from src.api.configs.database import SessionDep
from src.api.models.user import UserModel



class AuthRepository:
    def __init__(self, session: SessionDep):
        self.session = session


    def get_user_by_username(self, username: str) -> Optional[UserModel]:
        return self.session.exec(
            select(UserModel)
            .where(UserModel.username == username)
        ).first()


    def get_first_user(self):
        return self.session.exec(
            select(UserModel)
        ).first()


    def create_user(self, new_user: UserModel) -> UserModel:
        self.session.add(new_user)
        self.session.commit()
        self.session.refresh(new_user)

        return new_user 