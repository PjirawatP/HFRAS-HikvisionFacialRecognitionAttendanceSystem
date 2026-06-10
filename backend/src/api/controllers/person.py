from fastapi import UploadFile

from src.api.schemas.person import AddPersonRequestSchema, EditPersonRequestSchema
from src.api.services.person import PersonService



class PersonController:
    def __init__(self, service: PersonService):
        self.service = service


    def get_person_handler(self):
        return self.service.person_list()


    async def add_person_handler(
        self,
        person_data: AddPersonRequestSchema,
        face_image: UploadFile | None
    ):
        return await self.service.add_person(person_data, face_image)


    async def import_persons_handler(self, file: UploadFile):
        return await self.service.import_persons(file)


    def get_person_by_id_handler(self, person_id: int):
        return self.service.get_person_by_id(person_id)


    async def edit_person_handler(
        self,
        person_id: int,
        person: EditPersonRequestSchema,
        face_image: UploadFile | None
    ):
        return await self.service.edit_person(person_id, person, face_image)


    async def delete_person_handler(self, person_id: int):
        return await self.service.delete_person(person_id)