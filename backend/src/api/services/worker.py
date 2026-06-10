import httpx



class WorkerService:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.timeout = 10.0


    def _request(self, method: str, path: str) -> dict:
        url = f"{self.base_url}{path}"
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
            return {"ok": False, "message": "Cannot connect to Worker API. Is it running?"}
        except httpx.TimeoutException:
            return {"ok": False, "message": "Worker API request timed out"}
        except httpx.HTTPStatusError as e:
            return {"ok": False, "message": f"Worker API error: {e.response.text}"}  # ✅ return ไม่ raise
        except Exception as e:
            return {"ok": False, "message": f"Unexpected error: {str(e)}"}


    def get_status(self) -> dict:
        result = self._request("GET", "/status")
        if "ok" in result and not result["ok"]:
            return {"status": "unreachable", "message": result.get("message")}
        return result


    def start(self) -> dict:
        return self._request("POST", "/start")


    def stop(self) -> dict:
        return self._request("POST", "/stop")


    def restart(self) -> dict:
        return self._request("POST", "/restart")