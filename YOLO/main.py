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
from evaluation_recorder import EvaluationRecorder


FRAME_INTERVAL_SECONDS = float(os.getenv("FRAME_INTERVAL_SECONDS", "10"))
CAMERA_POLL_INTERVAL_SECONDS = float(os.getenv("CAMERA_POLL_INTERVAL_SECONDS", "2"))
EVALUATION_MODE_SETTING = os.getenv("EVALUATION_MODE", "false").strip().lower()
if EVALUATION_MODE_SETTING not in {
    "1",
    "true",
    "yes",
    "on",
    "0",
    "false",
    "no",
    "off",
}:
    raise ValueError("EVALUATION_MODE must be true or false.")
EVALUATION_MODE = EVALUATION_MODE_SETTING in {"1", "true", "yes", "on"}
MAX_EVALUATION_SAMPLES = int(os.getenv("MAX_EVALUATION_SAMPLES", "100"))
EVALUATION_OUTPUT_DIR = os.getenv("EVALUATION_OUTPUT_DIR", "evaluation")
if FRAME_INTERVAL_SECONDS <= 0 or CAMERA_POLL_INTERVAL_SECONDS <= 0:
    raise ValueError("Frame and camera polling intervals must be greater than zero.")
if MAX_EVALUATION_SAMPLES <= 0:
    raise ValueError("MAX_EVALUATION_SAMPLES must be greater than zero.")


def create_worker(config, stop_event, backend, evaluation_recorder=None):
    def run():
        run_camera_worker(
            config,
            stop_event,
            backend,
            CameraSource,
            YOLODetector,
            FRAME_INTERVAL_SECONDS,
            evaluation_recorder,
        )

    return run


def main():
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    backend = BackendClient()
    backend.initialize_camera_service()
    evaluation_recorder = (
        EvaluationRecorder(EVALUATION_OUTPUT_DIR, MAX_EVALUATION_SAMPLES)
        if EVALUATION_MODE
        else None
    )
    if evaluation_recorder is not None:
        logging.info("Evaluation evidence will be saved to %s.", evaluation_recorder.session_dir)

    stop_event = threading.Event()
    manager = CameraManager(
        backend,
        lambda config, event: create_worker(
            config,
            event,
            backend,
            evaluation_recorder,
        ),
    )

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
        if evaluation_recorder is not None:
            evaluation_recorder.close()
        logging.info("Camera workers stopped.")


if __name__ == "__main__":
    main()
