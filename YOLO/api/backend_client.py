import os

import requests


class BackendClientError(Exception):
    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


class BackendClient:
    def __init__(self):
        self.base_url = os.getenv("OCCUVISION_API_URL", "http://localhost:3000/api").rstrip("/")
        token = os.getenv("CAMERA_SERVICE_TOKEN")
        if not token:
            raise BackendClientError("CAMERA_SERVICE_TOKEN is required.")
        self.headers = {"Authorization": f"Bearer {token}"}

    def _request(self, method, path, **kwargs):
        try:
            response = requests.request(
                method,
                f"{self.base_url}{path}",
                headers=self.headers,
                timeout=5,
                **kwargs,
            )
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            status_text = f" HTTP {status}" if status else ""
            raise BackendClientError(f"Backend request failed.{status_text}", status) from None

    def initialize_camera_service(self):
        self._request("POST", "/camera-service/startup")

    def get_desired_cameras(self):
        try:
            cameras = self._request("GET", "/camera-service/cameras").json()
        except ValueError:
            raise BackendClientError("Backend returned invalid camera configuration.") from None
        if not isinstance(cameras, list) or any(not isinstance(camera, dict) for camera in cameras):
            raise BackendClientError("Backend returned invalid camera configuration.")
        return cameras

    def get_cameras(self):
        url = f"{self.base_url}/cameras"

        response = requests.get(url, timeout=5)
        response.raise_for_status()

        return response.json()

    def send_occupancy(self, camera_id, people):
        response = self._request(
            "POST",
            "/occupancy",
            json={"camera_id": camera_id, "occupancy_count": people},
        )
        try:
            return response.json()
        except ValueError:
            raise BackendClientError("Backend returned an invalid occupancy response.") from None