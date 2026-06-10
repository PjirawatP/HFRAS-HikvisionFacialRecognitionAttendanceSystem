import os, uvicorn

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.api.repositories.camera import CameraRepository
from src.api.services.sync import sync_mediamtx_from_db
from src.api.configs.database import SessionDep, create_db_and_tables, create_vector_extension, get_session
from src.api.routers.auth import router as auth_router
from src.api.routers.camera import router as camera_router
from src.api.routers.detection import router as detection_router 
from src.api.routers.overview import router as overview_router
from src.api.routers.person import router as person_router
from src.api.routers.setting import router as setting_router
from src.api.routers.user import router as user_router
from src.api.routers.worker import router as worker_router



api = FastAPI() 



api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)



@api.on_event("startup")
def on_startup():
    create_vector_extension()
    create_db_and_tables()

    session = next(get_session())

    try:
        repo = CameraRepository(session)

        sync_mediamtx_from_db(repo)

        print("startup completed")
    finally:
        session.close()



os.makedirs("/app/files", exist_ok = True)

api.mount(
    "/files",
    StaticFiles(directory="/app/files"),
    name="files"
)


api.include_router(auth_router)
api.include_router(camera_router)
api.include_router(detection_router)
api.include_router(overview_router)
api.include_router(person_router)
api.include_router(setting_router)
api.include_router(user_router)
api.include_router(worker_router)



@api.get("/")
def health_check():
    return {
        "message": "hello world!"
    }



if __name__ == "__main__":
    uvicorn.run(api, host = "0.0.0.0", port = 8000)