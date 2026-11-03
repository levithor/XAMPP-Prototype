import threading
import unittest
from unittest.mock import patch

from camera_manager import CameraManager
from camera_worker import run_camera_worker
from capture.camera_source import CameraConnectionError, CameraSource


def camera(camera_id, url="rtsp://camera.local/live", room_id=1):
    return {
        "camera_id": camera_id,
        "rtsp_url": url,
        "assigned_room_id": room_id,
        "desired_connection_state": "connected",
    }


class FakeBackend:
    def __init__(self, cameras):
        self.cameras = cameras

    def get_desired_cameras(self):
        return self.cameras


class CameraManagerTests(unittest.TestCase):
    def test_starts_each_camera_once_and_stops_only_removed_worker(self):
        backend = FakeBackend([camera(1), camera(2)])
        started = []

        def worker_factory(config, stop_event):
            started.append(config["camera_id"])
            return lambda: stop_event.wait()

        manager = CameraManager(backend, worker_factory)
        manager.reconcile()
        manager.reconcile()

        self.assertCountEqual(started, [1, 2])
        first_event = manager.workers[1]["stop_event"]
        second_event = manager.workers[2]["stop_event"]

        backend.cameras = [camera(2)]
        manager.reconcile()

        self.assertTrue(first_event.is_set())
        self.assertFalse(second_event.is_set())
        self.assertTrue(manager.workers[2]["thread"].is_alive())
        manager.stop_all()

    def test_changed_url_restarts_worker_without_duplicate(self):
        backend = FakeBackend([camera(1)])
        started = []

        def worker_factory(config, stop_event):
            started.append(config["rtsp_url"])
            return lambda: stop_event.wait()

        manager = CameraManager(backend, worker_factory)
        manager.reconcile()
        old_thread = manager.workers[1]["thread"]
        backend.cameras = [camera(1, "rtsp://camera.local/updated")]
        manager.reconcile()
        self.assertTrue(manager.workers[1]["stopping"])
        old_thread.join(timeout=1)
        manager.reconcile()

        self.assertEqual(
            started,
            ["rtsp://camera.local/live", "rtsp://camera.local/updated"],
        )
        self.assertTrue(manager.workers[1]["thread"].is_alive())
        manager.stop_all()

    def test_rejects_missing_room_or_malformed_url(self):
        backend = FakeBackend([
            camera(1, room_id=None),
            camera(2, "not-a-url"),
        ])
        started = []
        manager = CameraManager(
            backend,
            lambda config, stop_event: started.append(config["camera_id"]),
        )

        manager.reconcile()

        self.assertEqual(started, [])
        self.assertEqual(manager.workers, {})

    def test_failed_camera_does_not_block_another_and_deleted_camera_releases_capture(self):
        backend = FakeBackend([camera(1), camera(2)])
        second_started = threading.Event()
        second_released = threading.Event()

        class WaitingSource:
            def get_frame(self):
                return None

            def release(self):
                second_released.set()

        def worker_factory(config, stop_event):
            def run():
                if config["camera_id"] == 1:
                    def fail_connection(url):
                        stop_event.set()
                        raise CameraConnectionError("test connection failure")

                    run_camera_worker(config, stop_event, None, fail_connection, lambda: None)
                    return

                second_started.set()
                run_camera_worker(
                    config,
                    stop_event,
                    None,
                    lambda url: WaitingSource(),
                    lambda: None,
                )

            return run

        manager = CameraManager(backend, worker_factory)
        manager.reconcile()
        self.assertTrue(second_started.wait(timeout=1))
        manager.workers[1]["thread"].join(timeout=1)

        self.assertFalse(manager.workers[1]["thread"].is_alive())
        self.assertTrue(manager.workers[2]["thread"].is_alive())

        backend.cameras = []
        manager.reconcile()
        manager.workers[2]["thread"].join(timeout=1)

        self.assertFalse(manager.workers[2]["thread"].is_alive())
        self.assertTrue(second_released.is_set())
        manager.workers.clear()


class CameraWorkerTests(unittest.TestCase):
    def test_stops_before_another_occupancy_post_and_releases_capture(self):
        stop_event = threading.Event()
        sent = []

        class FakeSource:
            released = False

            def get_frame(self):
                return object()

            def release(self):
                self.released = True

        source = FakeSource()

        class FakeDetector:
            def detect_people(self, frame):
                return 3, None

        class FakeBackend:
            def send_occupancy(self, camera_id, people):
                sent.append((camera_id, people))
                stop_event.set()

        run_camera_worker(
            camera(3),
            stop_event,
            FakeBackend(),
            lambda url: source,
            FakeDetector,
            frame_interval_seconds=0,
        )

        self.assertEqual(sent, [(3, 3)])
        self.assertTrue(source.released)

    def test_backend_reporting_continues_after_evaluation_sample_limit(self):
        stop_event = threading.Event()
        sent = []

        class FakeSource:
            def get_frame(self):
                return object()

            def release(self):
                pass

        class FakeDetector:
            def detect_people(self, frame):
                return 1, None

        class FullRecorder:
            def is_full(self):
                return True

            def record(self, *args):
                raise AssertionError("A full recorder must not be used.")

        class FakeBackend:
            def send_occupancy(self, camera_id, people):
                sent.append((camera_id, people))
                stop_event.set()

        run_camera_worker(
            camera(4),
            stop_event,
            FakeBackend(),
            lambda url: FakeSource(),
            FakeDetector,
            frame_interval_seconds=0,
            evaluation_recorder=FullRecorder(),
        )

        self.assertEqual(sent, [(4, 1)])


class CameraSourceTests(unittest.TestCase):
    def test_opens_with_rtsp_timeouts_and_releases(self):
        class FakeCapture:
            def __init__(self):
                self.released = False

            def isOpened(self):
                return True

            def read(self):
                return True, "frame"

            def release(self):
                self.released = True

        capture = FakeCapture()
        with patch("capture.camera_source.cv2.VideoCapture", return_value=capture) as open_capture:
            source = CameraSource("rtsp://camera.local/live")

        self.assertEqual(open_capture.call_args.args[0], "rtsp://camera.local/live")
        self.assertIn(
            CameraSource.OPEN_TIMEOUT_MS,
            open_capture.call_args.args[2],
        )
        self.assertIn(
            CameraSource.READ_TIMEOUT_MS,
            open_capture.call_args.args[2],
        )
        self.assertEqual(source.get_frame(), "frame")
        source.release()
        self.assertTrue(capture.released)

    def test_failed_open_does_not_echo_rtsp_credentials(self):
        class FailedCapture:
            released = False

            def isOpened(self):
                return False

            def release(self):
                self.released = True

        capture = FailedCapture()
        url = "rtsp://user:secret@camera.local/live"
        with patch("capture.camera_source.cv2.VideoCapture", return_value=capture):
            with self.assertRaisesRegex(CameraConnectionError, "^Could not open RTSP capture\\.$") as error:
                CameraSource(url)

        self.assertNotIn("secret", str(error.exception))
        self.assertTrue(capture.released)


if __name__ == "__main__":
    unittest.main()
