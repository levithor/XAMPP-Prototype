from urllib import response

import requests

class BackendClient:

    def __init__(self):
        self.url = "http://localhost:3000/api/occupancy"

    def send_occupancy(self, room_id, camera_id, people):

        data = {
            "room_id": room_id,
            "camera_id": camera_id,
            "occupancy_count": people
        }

        response = requests.post(self.url, json=data, timeout=5)

        print("Status:", response.status_code)
        print("Headers:", response.headers)
        print("Body:", response.text)

        return response.json()