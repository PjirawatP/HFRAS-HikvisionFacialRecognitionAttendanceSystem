import time
import requests
from requests.auth import HTTPBasicAuth



MEDIAMTX_API = "http://fdar_mediamtx:9997"
AUTH = HTTPBasicAuth("admin", "password")



class MediaMTXService:
    @staticmethod
    def _request(method, url, **kwargs):
        r = requests.request(method, url, auth=AUTH, timeout=5, **kwargs)
        if r.status_code not in (200, 201, 204):
            raise RuntimeError(f"{method} {url} failed: {r.text}")
        return r


    @staticmethod
    def list_paths():
        r = MediaMTXService._request(
            "GET",
            f"{MEDIAMTX_API}/v3/config/paths/list",
        )
        return [item["name"] for item in r.json().get("items", [])]


    @staticmethod
    def kick_path(name: str):
        try:
            MediaMTXService._request(
                "POST",
                f"{MEDIAMTX_API}/v3/paths/kick/{name}",
            )
        except Exception:
            pass  # ถ้าไม่มี client ก็ไม่เป็นไร


    @staticmethod
    def upsert_path(name: str, rtsp_url: str):
        payload = {
            "source": rtsp_url,
            "sourceOnDemand": True,
        }

        # Try add first
        r = requests.post(
            f"{MEDIAMTX_API}/v3/config/paths/add/{name}",
            json=payload,
            auth=AUTH,
            timeout=5,
        )

        if r.status_code in (200, 201, 204):
            return  # add สำเร็จ

        # Path มีอยู่แล้ว → patch แทน
        r = requests.patch(        
            f"{MEDIAMTX_API}/v3/config/paths/patch/{name}", 
            json=payload,
            auth=AUTH,
            timeout=5,
        )
        if r.status_code not in (200, 201, 204):
            raise RuntimeError(f"upsert_path failed: {r.text}")


    @staticmethod
    def remove_path(name: str):

        existing = MediaMTXService.list_paths()
        if name not in existing:
            return

        MediaMTXService.kick_path(name)
        time.sleep(0.3)

        MediaMTXService._request(
            "POST",
            f"{MEDIAMTX_API}/v3/config/paths/remove/{name}",
        )