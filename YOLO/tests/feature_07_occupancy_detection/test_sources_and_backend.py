from unittest.mock import Mock

import cv2
import pytest
import requests

from api.backend_client import BackendClient
from capture.camera_source import CameraSource
from capture.video_source import VideoSource


def test_camera_source_reads_and_releases_capture(monkeypatch):
    frame = object()
    capture = Mock()
    capture.isOpened.return_value = True
    capture.read.return_value = (True, frame)
    monkeypatch.setattr(
        "capture.camera_source.cv2.VideoCapture",
        Mock(return_value=capture),
    )

    source = CameraSource("rtsp://camera")

    assert source.get_frame() is frame
    source.release()
    capture.release.assert_called_once_with()


def test_camera_source_returns_none_when_frame_is_lost(monkeypatch):
    capture = Mock()
    capture.isOpened.return_value = True
    capture.read.return_value = (False, None)
    monkeypatch.setattr(
        "capture.camera_source.cv2.VideoCapture",
        Mock(return_value=capture),
    )

    assert CameraSource("rtsp://camera").get_frame() is None


def test_camera_source_returns_none_for_an_empty_frame(monkeypatch):
    capture = Mock()
    capture.isOpened.return_value = True
    capture.read.return_value = (True, None)
    monkeypatch.setattr(
        "capture.camera_source.cv2.VideoCapture",
        Mock(return_value=capture),
    )

    assert CameraSource("rtsp://camera").get_frame() is None


def test_camera_source_rejects_unopened_capture(monkeypatch):
    capture = Mock()
    capture.isOpened.return_value = False
    monkeypatch.setattr(
        "capture.camera_source.cv2.VideoCapture",
        Mock(return_value=capture),
    )

    with pytest.raises(Exception, match="Could not connect to camera"):
        CameraSource("rtsp://unavailable")


def test_video_source_loops_back_to_first_frame(monkeypatch):
    frame = object()
    capture = Mock()
    capture.isOpened.return_value = True
    capture.get.return_value = 25
    capture.read.side_effect = [(False, None), (True, frame)]
    monkeypatch.setattr(
        "capture.video_source.cv2.VideoCapture",
        Mock(return_value=capture),
    )

    source = VideoSource("sample.mp4")

    assert source.get_frame() is frame
    capture.set.assert_called_once_with(cv2.CAP_PROP_POS_FRAMES, 0)
    assert source.get_frame_delay() == pytest.approx(1 / 25)


def test_video_source_returns_none_at_end_when_looping_is_disabled(monkeypatch):
    capture = Mock()
    capture.isOpened.return_value = True
    capture.get.return_value = 30
    capture.read.return_value = (False, None)
    monkeypatch.setattr(
        "capture.video_source.cv2.VideoCapture",
        Mock(return_value=capture),
    )

    source = VideoSource("sample.mp4", loop=False)

    assert source.get_frame() is None
    capture.set.assert_not_called()
    source.release()
    capture.release.assert_called_once_with()


def test_video_source_uses_default_fps_when_capture_reports_nonpositive(monkeypatch):
    capture = Mock()
    capture.isOpened.return_value = True
    capture.get.return_value = 0
    monkeypatch.setattr(
        "capture.video_source.cv2.VideoCapture",
        Mock(return_value=capture),
    )

    assert VideoSource("sample.mp4").get_frame_delay() == pytest.approx(1 / 30)


def test_backend_client_gets_camera_and_camera_list(monkeypatch):
    response = Mock()
    response.json.side_effect = [{"camera_id": 4}, [{"camera_id": 4}]]
    get = Mock(return_value=response)
    monkeypatch.setattr("api.backend_client.requests.get", get)
    client = BackendClient()

    assert client.get_camera(4) == {"camera_id": 4}
    assert client.get_cameras() == [{"camera_id": 4}]
    assert get.call_args_list[0].args == (
        "http://localhost:3000/api/cameras/4",
    )
    assert get.call_args_list[1].args == (
        "http://localhost:3000/api/cameras",
    )
    assert all(call.kwargs == {"timeout": 5} for call in get.call_args_list)
    assert response.raise_for_status.call_count == 2


def test_backend_client_posts_occupancy(monkeypatch):
    response = Mock()
    response.json.return_value = {"log_id": 12}
    post = Mock(return_value=response)
    monkeypatch.setattr("api.backend_client.requests.post", post)

    result = BackendClient().send_occupancy(camera_id=4, people=3)

    assert result == {"log_id": 12}
    post.assert_called_once_with(
        "http://localhost:3000/api/occupancy",
        json={"camera_id": 4, "occupancy_count": 3},
        timeout=5,
    )
    response.raise_for_status.assert_called_once_with()


def test_backend_client_propagates_http_errors(monkeypatch):
    response = Mock()
    response.raise_for_status.side_effect = requests.HTTPError("HTTP failure")
    monkeypatch.setattr(
        "api.backend_client.requests.get",
        Mock(return_value=response),
    )

    with pytest.raises(requests.HTTPError, match="HTTP failure"):
        BackendClient().get_cameras()
    response.raise_for_status.assert_called_once_with()


def test_backend_client_propagates_occupancy_http_errors(monkeypatch):
    response = Mock()
    response.raise_for_status.side_effect = requests.HTTPError("service unavailable")
    post = Mock(return_value=response)
    monkeypatch.setattr("api.backend_client.requests.post", post)

    with pytest.raises(requests.HTTPError, match="service unavailable"):
        BackendClient().send_occupancy(camera_id=4, people=3)

    post.assert_called_once()
    response.raise_for_status.assert_called_once_with()


def test_backend_client_propagates_occupancy_timeouts(monkeypatch):
    post = Mock(side_effect=requests.Timeout("request timed out"))
    monkeypatch.setattr("api.backend_client.requests.post", post)

    with pytest.raises(requests.Timeout, match="request timed out"):
        BackendClient().send_occupancy(camera_id=4, people=3)

    assert post.call_args.kwargs["timeout"] == 5
