import httpx, os

from typing import Optional



WORKER_API_BASE_URL = os.getenv("WORKER_API_BASE_URL")



class WorkerController:
    def __init__(self, worker_api_url: str = WORKER_API_BASE_URL):
        self.worker_api_url = worker_api_url
        self.timeout = 10.0


    def _make_request(self, method: str, endpoint: str) -> dict:
        url = f"{self.worker_api_url}{endpoint}"
        
        try:
            with httpx.Client(timeout=self.timeout) as client:
                if method == "GET":
                    response = client.get(url)
                elif method == "POST":
                    response = client.post(url)
                else:
                    return {"ok": False, "message": f"Unsupported method: {method}"}

                response.raise_for_status()
                return response.json()

        except httpx.ConnectError:
            return {
                "ok": False,
                "message": "Cannot connect to Worker API. Is it running?"
            }
        except httpx.TimeoutException:
            return {
                "ok": False,
                "message": "Worker API request timed out"
            }
        except httpx.HTTPStatusError as e:
            return {
                "ok": False,
                "message": f"Worker API error: {e.response.text}"
            }
        except Exception as e:
            return {
                "ok": False,
                "message": f"Unexpected error: {str(e)}"
            }


    def start(self) -> dict:
        return self._make_request("POST", "/start")


    def stop(self) -> dict:
        return self._make_request("POST", "/stop")


    def restart(self) -> dict:
        return self._make_request("POST", "/restart")


    def get_status(self) -> dict:
        result = self._make_request("GET", "/status")
        
        # ถ้าไม่สามารถเชื่อมต่อได้ ให้ return status stopped
        if not result.get("ok", True):  # ถ้ามี key "ok" และเป็น False
            return {
                "status": "unreachable",
                "message": result.get("message", "Cannot connect to Worker API")
            }
        
        return result


    def health_check(self) -> dict:
        return self._make_request("GET", "/health")



worker_controller = WorkerController(worker_api_url = WORKER_API_BASE_URL)