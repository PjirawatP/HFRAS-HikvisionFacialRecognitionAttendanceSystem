from src.api.services.mediamtx import MediaMTXService



def sync_mediamtx_from_db(repo):
    db_cameras = repo.get_all_cameras()
    db_paths = {f"camera_{cam.id}": cam for cam in db_cameras}

    try:
        runtime_paths = set(MediaMTXService.list_paths())
    except Exception as e:
        print("mediamtx not available:", e)
        return

    # sync add/update
    for path_name, cam in db_paths.items():
        rtsp_url = (
            f"rtsp://{cam.username}:{cam.password}"
            f"@{cam.ip}:{cam.port}/ISAPI/Streaming/Channels/{cam.channel}"
        )
        try:
            MediaMTXService.upsert_path(path_name, rtsp_url)
            print(f"[sync] ✅ synced {path_name}")
        except Exception as e:
            print(f"[sync] ❌ failed to sync {path_name}: {e}")

    # remove extra
    for runtime_path in runtime_paths:
        if runtime_path.startswith("camera_") and runtime_path not in db_paths:
            try:
                MediaMTXService.remove_path(runtime_path)
                print(f"[sync] 🗑️ removed {runtime_path}")
            except Exception as e:
                print(f"[sync] ❌ failed to remove {runtime_path}: {e}")