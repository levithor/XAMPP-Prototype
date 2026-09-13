import requests

class BackendClient:

    def __init__(self):
        self.base_url = "http://localhost:3000/api"

    def get_camera(self, camera_id):
        url = f"{self.base_url}/cameras/{camera_id}"

        response = requests.get(url, timeout=5)

        print("Camera API status:", response.status_code)
        print("Camera response:", response.text)

        response.raise_for_status()

        return response.json()

    def send_occupancy(self, camera_id, people):
        url = f"{self.base_url}/occupancy"

        data = {
            "camera_id": camera_id,
            "occupancy_count": people
        }

        response = requests.post(
            url,
            json=data,
            timeout=5
        )

        print("Occupancy API status:", response.status_code)
        print("Occupancy response:", response.text)

        response.raise_for_status()

        return response.json()