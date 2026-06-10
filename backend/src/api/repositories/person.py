from contextlib import asynccontextmanager
from sqlalchemy import outerjoin, insert
from sqlmodel import select

from src.api.configs.database import SessionDep
from src.api.models.detection import DetectionModel
from src.api.models.face import FaceModel
from src.api.models.person import PersonModel



class PersonRepository:
    def __init__(self, session):
        self.session = session


    @asynccontextmanager
    async def transaction(self):
        try:
            yield
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise


    def get_all_persons(self):
        subquery = (
            select(
                FaceModel.person_id,
                FaceModel.face_image_path
            )
            .subquery()
        )

        return self.session.exec(
            select(
                PersonModel.id,
                PersonModel.external_id,
                PersonModel.first_name,
                PersonModel.last_name,
                PersonModel.position,
                PersonModel.group,
                PersonModel.is_blacklist,
                PersonModel.created_at,
                PersonModel.updated_at,
                subquery.c.face_image_path,
            )
            .outerjoin(
                subquery,
                subquery.c.person_id == PersonModel.id
            )
            .order_by(PersonModel.created_at.desc())
        ).all()


    def get_person_by_id(self, person_id: int):
        return self.session.exec(
            select(PersonModel).where(PersonModel.id == person_id)
        ).first()


    def get_person_by_external_id(self, external_id: str):
        return self.session.exec(
            select(PersonModel).where(PersonModel.external_id == external_id)
        ).first()


    def get_persons_by_external_ids(self, external_ids: list[str]) -> list[PersonModel]:
        return self.session.exec(
            select(PersonModel).where(PersonModel.external_id.in_(external_ids))
        ).all()


    def get_face_by_person_id(self, person_id: int):
        return self.session.exec(
            select(FaceModel)
            .where(FaceModel.person_id == person_id)
            .order_by(FaceModel.id.desc())
        ).first()


    def get_detections_by_face_id(self, face_id: int):
        return self.session.exec(
            select(DetectionModel).where(DetectionModel.face_id == face_id)
        ).all()


    async def create_person(self, person: PersonModel):
        self.session.add(person)
        self.session.flush()

        return person


    async def create_face(self, face: FaceModel):
        self.session.add(face)
        self.session.flush()

        return face


    async def bulk_create_persons(self, persons: list[PersonModel]):
        self.session.execute(
            insert(PersonModel),
            [
                {
                    "external_id": p.external_id,
                    "first_name": p.first_name,
                    "last_name": p.last_name,
                    "position": p.position,
                    "group": p.group,
                    "is_blacklist": p.is_blacklist,
                }
                for p in persons
            ]
        )


    async def update_person(self, person: PersonModel):
        self.session.add(person)
        self.session.flush()

        return person


    async def update_face(self, face: FaceModel):
        self.session.add(face)
        self.session.flush()

        return face


    async def delete_person(self, person: PersonModel):
        self.session.delete(person)


    async def delete_face(self, face: FaceModel):
        self.session.delete(face)


    async def delete_detection(self, detection: DetectionModel):
        self.session.delete(detection)