import os

from dotenv import load_dotenv
from fastapi import Depends
from sqlalchemy import text
from sqlmodel import SQLModel, create_engine, Session
from typing import Annotated

from src.api.models.camera import CameraModel
from src.api.models.detection import DetectionModel
from src.api.models.face import FaceModel
from src.api.models.person import PersonModel
from src.api.models.user import UserModel
from src.api.models.system_setting import SystemSettingModel
from src.api.models.notification_channel import NotificationChannelModel



load_dotenv()

POSTGRES_USER = os.getenv("POSTGRES_USER")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
POSTGRES_HOST = os.getenv("POSTGRES_HOST")
POSTGRES_PORT = os.getenv("POSTGRES_PORT")
POSTGRES_DB = os.getenv("POSTGRES_DB")
POSTGRES_URL = f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"



engine = create_engine(POSTGRES_URL, echo = True)



def create_vector_extension():
    with Session(engine) as session:
        session.exec(
            text("CREATE EXTENSION IF NOT EXISTS vector;")
        )

        session.commit()



def create_db_and_tables():
    SQLModel.metadata.create_all(engine)



def get_session():
    with Session(engine) as session:
        yield session



SessionDep = Annotated[Session, Depends(get_session )]