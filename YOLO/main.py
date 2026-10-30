import logging
import os
import signal
import threading

os.environ["OPENCV_LOG_LEVEL"] = "SILENT"

from api.backend_client import BackendClient
from camera_manager import CameraManager
from camera_worker import run_camera_worker
from detection.yolo_detector import YOLODetector
from capture.camera_source import CameraSource


FRAME_INTERVAL_SECONDS = float(os.getenv("FRAME_INTERVAL_SECONDS", "10"))
CAMERA_POLL_INTERVAL_SECONDS = float(os.getenv("CAMERA_POLL_INTERVAL_SECONDS", "2"))
if FRAME_INTERVAL_SECONDS <= 0 or CAMERA_POLL_INTERVAL_SECONDS <= 0:
    raise ValueError("Frame and camera polling intervals must be greater than zero.")


def create_worker(config, stop_event, backend):
    def run():
        run_camera_worker(
            config,
            stop_event,
            backend,
            CameraSource,
            YOLODetector,
            FRAME_INTERVAL_SECONDS,
        )

    return run


def main():
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    backend = BackendClient()
    backend.initialize_camera_service()

    stop_event = threading.Event()
    manager = CameraManager(backend, lambda config, event: create_worker(config, event, backend))

    def request_shutdown(signum, frame):
        logging.info("Shutdown requested.")
        stop_event.set()

    signal.signal(signal.SIGINT, request_shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, request_shutdown)

    try:
        manager.run(stop_event, CAMERA_POLL_INTERVAL_SECONDS)
    finally:
        manager.stop_all()
        logging.info("Camera workers stopped.")


if __name__ == "__main__":
    main()
