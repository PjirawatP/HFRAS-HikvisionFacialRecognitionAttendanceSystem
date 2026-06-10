from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlmodel import Session

from src.api.configs.database import SessionDep, get_session
from src.api.controllers.person import PersonController
from src.api.dependencies.auth import require_admin, get_current_active_user
from src.api.models.user import UserModel
from src.api.services.person import PersonService
from src.api.repositories.person import PersonRepository
from src.api.schemas.person import AddPersonRequestSchema, EditPersonRequestSchema



router = APIRouter(
    prefix = "/person",
    tags = ["Person"]
)



@router.get("/list")
def person_list(
    session: SessionDep,
    current_user: UserModel = Depends(get_current_active_user)
):
    try:
        repo = PersonRepository(session)
        service = PersonService(repo)
        controller = PersonController(service)

        return controller.get_person_handler()

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in person_list: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.post("/add")
async def add_person(
    external_id: str = Form(None),
    first_name: str = Form(...),
    last_name: str = Form(None),
    position: str = Form(None),
    group: str = Form(None),
    is_blacklist: bool = Form(False),
    face_image: UploadFile | None = File(None),
    session: Session = Depends(get_session),
    current_user: UserModel = Depends(require_admin())
):
    try:
        repo = PersonRepository(session)
        service = PersonService(repo)
        controller = PersonController(service)

        person_data = AddPersonRequestSchema(
            external_id = external_id,
            first_name = first_name,
            last_name = last_name,
            position = position,
            group = group,
            is_blacklist = is_blacklist
        )

        return await controller.add_person_handler(person_data, face_image)

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in add_person: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.post("/import")
async def import_persons(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: UserModel = Depends(require_admin())
):
    try:
        repo = PersonRepository(session)
        service = PersonService(repo)
        controller = PersonController(service)

        return await controller.import_persons_handler(file)

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in import_persons: {e}")

        raise HTTPException(
            status_code=500,
            detail="internal server error"
        )


@router.get("/{person_id}/info")
def get_person_by_id(
    person_id: int, 
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        repo = PersonRepository(session)
        service = PersonService(repo)
        controller = PersonController(service)

        return controller.get_person_by_id_handler(person_id)

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in get_person_by_id: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.put("/{person_id}/edit")
async def edit_person(
    person_id: int,
    external_id: str = Form(None),
    first_name: str = Form(...),
    last_name: str = Form(None),
    position: str = Form(None),
    group: str = Form(None),
    is_blacklist: bool = Form(False),
    face_image: UploadFile | None = File(None),
    session: Session = Depends(get_session),
    current_user: UserModel = Depends(require_admin())
):
    try:
        repo = PersonRepository(session)
        service = PersonService(repo)
        controller = PersonController(service)

        person_data = EditPersonRequestSchema(
            external_id = external_id,
            first_name = first_name,
            last_name = last_name,
            position = position,
            group = group,
            is_blacklist = is_blacklist
        )

        return await controller.edit_person_handler(person_id, person_data, face_image)

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in edit_person: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )


@router.delete("/{person_id}/delete")
async def delete_person(
    person_id: int,
    session: SessionDep,
    current_user: UserModel = Depends(require_admin())
):
    try:
        repo = PersonRepository(session)
        service = PersonService(repo)
        controller = PersonController(service)

        return await controller.delete_person_handler(person_id)

    except HTTPException:
        raise

    except Exception as e:
        print(f"error in delete_person: {e}")

        raise HTTPException(
            status_code = 500,
            detail = "internal server error"
        )