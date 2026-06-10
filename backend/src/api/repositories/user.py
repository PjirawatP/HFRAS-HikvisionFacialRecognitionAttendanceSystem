from sqlmodel import select

from src.api.configs.database import SessionDep
from src.api.models.user import UserModel



class UserRepository:
    def __init__(self, session: SessionDep):
        self.session = session


    def get_all_users(self) -> list[UserModel]:
        return self.session.exec(
            select(UserModel)
            .order_by(UserModel.created_at.desc())
        ).all()


    def get_by_id(self, user_id: int) -> UserModel | None:
        return self.session.get(UserModel, user_id)


    def get_by_username(self, username: str) -> UserModel | None:
        return self.session.exec(
            select(UserModel).where(UserModel.username == username)
        ).first()