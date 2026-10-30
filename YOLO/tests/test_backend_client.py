import os
import unittest
from unittest.mock import patch

from api.backend_client import BackendClient, BackendClientError


class FakeResponse:
    def __init__(self, value):
        self.value = value

    def raise_for_status(self):
        return None

    def json(self):
        return self.value


class BackendClientTests(unittest.TestCase):
    def test_service_token_is_sent_as_bearer_header(self):
        with patch.dict(os.environ, {"CAMERA_SERVICE_TOKEN": "test-token"}):
            client = BackendClient()

        with patch(
            "api.backend_client.requests.request",
            return_value=FakeResponse([{
                "camera_id": 8,
                "rtsp_url": "rtsp://camera.local/live",
                "assigned_room_id": 2,
            }]),
        ) as request:
            cameras = client.get_desired_cameras()

        self.assertEqual(len(cameras), 1)
        self.assertEqual(request.call_args.kwargs["headers"]["Authorization"], "Bearer test-token")
        self.assertEqual(request.call_args.kwargs["timeout"], 5)

    def test_missing_service_token_fails_without_logging(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(BackendClientError, "CAMERA_SERVICE_TOKEN is required"):
                BackendClient()


if __name__ == "__main__":
    unittest.main()
