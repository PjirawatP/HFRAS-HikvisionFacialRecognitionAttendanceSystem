import csv, io, os

from fastapi import HTTPException, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from src.api.models.face import FaceModel
from src.api.models.person import PersonModel
from src.api.repositories.person import PersonRepository
from src.api.schemas.person import AddPersonRequestSchema, EditPersonRequestSchema
from src.api.utils.face import extract_face_embedding
from src.api.utils.file import save_upload_face_image



class PersonService:
    def __init__(self, repo: PersonRepository):
        self.repo = repo


    def person_list(self):
        persons = self.repo.get_all_persons()

        return [
            {
                "id":              person.id,
                "external_id":     person.external_id,
                "first_name":      person.first_name,
                "last_name":       person.last_name,
                "position":        person.position,
                "group":           person.group,
                "is_blacklist":    person.is_blacklist,
                "face_image_path": person.face_image_path,
                "created_at":      person.created_at,
                "updated_at":      person.updated_at,
            }
            for person in persons
        ]


    async def add_person(self, person_data, face_image):

        if person_data.external_id:
            existing = self.repo.get_person_by_external_id(person_data.external_id)
            if existing:
                raise HTTPException(status_code=400, detail="external id already exists")

        image_bytes    = None
        face_embedding = None

        if face_image:
            await face_image.seek(0)
            image_bytes = await face_image.read()

            # extract_face_embedding จะ raise ValueError ถ้า:
            #    - ไม่พบหน้า
            #    - det_score < 0.70 (รูปคุณภาพต่ำ)
            try:
                face_embedding = await run_in_threadpool(
                    extract_face_embedding,
                    image_bytes,
                )
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            if not face_embedding:
                raise HTTPException(status_code=400, detail="no face detected")

        async with self.repo.transaction():

            new_person = PersonModel(
                external_id = person_data.external_id,
                first_name  = person_data.first_name,
                last_name   = person_data.last_name,
                position    = person_data.position,
                group       = person_data.group,
                is_blacklist = person_data.is_blacklist,
            )

            created_person = await self.repo.create_person(new_person)

            if face_embedding:

                image_path = await save_upload_face_image(
                    image_bytes,
                    face_image.filename,
                    created_person.id,
                )

                new_face = FaceModel(
                    person_id      = created_person.id,
                    face_image_path = image_path,
                    face_embedding = face_embedding,
                )

                await self.repo.create_face(new_face)

        return {"message": "add person successfully"}


    async def import_persons(self, file: UploadFile):

        content = await file.read()

        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail="invalid file encoding, must be UTF-8",
            )

        reader = csv.DictReader(io.StringIO(text))

        if not reader.fieldnames or "first_name" not in reader.fieldnames:
            raise HTTPException(
                status_code=400,
                detail="field 'first_name' is required in the csv header",
            )

        rows = list(reader)

        if not rows:
            raise HTTPException(status_code=400, detail="csv file is empty")

        if len(rows) > 500:
            raise HTTPException(
                status_code=400,
                detail="too many rows in csv file, maximum is 500",
            )

        persons = [
            PersonModel(
                external_id  = r.get("external_id") or None,
                first_name   = r["first_name"].strip(),
                last_name    = r.get("last_name") or None,
                position     = r.get("position") or None,
                group        = r.get("group") or None,
                is_blacklist = r.get("is_blacklist", "").lower() in ("true", "1", "yes"),
            )
            for r in rows
        ]

        async with self.repo.transaction():
            await self.repo.bulk_create_persons(persons)

        return {"message": f"imported {len(persons)} persons successfully"}


    def get_person_by_id(self, person_id: int):
        person = self.repo.get_person_by_id(person_id)

        if not person:
            raise HTTPException(status_code=400, detail="person not found")

        return {
            "id":              person.id,
            "external_id":     person.external_id,
            "first_name":      person.first_name,
            "last_name":       person.last_name,
            "position":        person.position,
            "group":           person.group,
            "is_blacklist":    person.is_blacklist,
            "face_image_path": person.face_image_path,
            "created_at":      person.created_at,
            "updated_at":      person.updated_at,
        }


    async def edit_person(self, person_id, person_data, face_image):
        person = self.repo.get_person_by_id(person_id)

        if not person:
            raise HTTPException(status_code=404, detail="person not found")

        person.external_id  = person_data.external_id
        person.first_name   = person_data.first_name
        person.last_name    = person_data.last_name
        person.position     = person_data.position
        person.group        = person_data.group
        person.is_blacklist = person_data.is_blacklist

        async with self.repo.transaction():

            await self.repo.update_person(person)

            if face_image:
                await face_image.seek(0)
                image_bytes = await face_image.read()

                # propagate quality error to API caller
                try:
                    face_embedding = await run_in_threadpool(
                        extract_face_embedding,
                        image_bytes,
                    )
                except ValueError as e:
                    raise HTTPException(status_code=400, detail=str(e))

                if not face_embedding:
                    raise HTTPException(status_code=400, detail="No face detected")

                image_path = await save_upload_face_image(
                    image_bytes,
                    face_image.filename,
                    person_id,
                )

                face = self.repo.get_face_by_person_id(person_id)

                if face:
                    face.face_image_path = image_path
                    face.face_embedding  = face_embedding
                    await self.repo.update_face(face)
                else:
                    new_face = FaceModel(
                        person_id       = person_id,
                        face_image_path = image_path,
                        face_embedding  = face_embedding,
                    )
                    await self.repo.create_face(new_face)

        return {"message": "edit person successfully"}


    async def delete_person(self, person_id: int):
        async with self.repo.transaction():
            person = self.repo.get_person_by_id(person_id)

            if not person:
                raise HTTPException(status_code=404, detail="person not found")

            face = self.repo.get_face_by_person_id(person_id)

            image_path = None

            if face:
                image_path = face.face_image_path

                detections = self.repo.get_detections_by_face_id(face.id)

                for detection in detections:
                    await self.repo.delete_detection(detection)

                await self.repo.delete_face(face)

            await self.repo.delete_person(person)

        if image_path and os.path.exists(image_path):
            try:
                os.remove(image_path)
            except Exception:
                pass

        return {"message": "delete person successfully"}