import logging
import time

from api.backend_client import BackendClientError
from capture.camera_source import CameraConnectionError


logger = logging.getLogger(__name__)

FRAME_FAILURE_LIMIT = 3
FRAME_FAILURE_DELAY_SECONDS = 0.5
MAX_RECONNECT_DELAY_SECONDS = 30


class FrameUnavailableError(Exception):
    pass


def run_camera_worker(
    config,
    stop_event,
    backend,
    source_factory,
    detector_factory,
    frame_interval_seconds=10,
):
    camera_id = config["camera_id"]
    rtsp_url = config["rtsp_url"]
    reconnect_delay = 1

    while not stop_event.is_set():
        source = None
        try:
            source = source_factory(rtsp_url)
            detector = detector_factory()
            logger.info("Camera %s connected.", camera_id)
            last_detection = time.monotonic()
            frame_failures = 0

            while not stop_event.is_set():
                frame = source.get_frame()
                if frame is None:
                    frame_failures += 1
                    if frame_failures >= FRAME_FAILURE_LIMIT:
                        raise FrameUnavailableError()
                    stop_event.wait(FRAME_FAILURE_DELAY_SECONDS)
                    continue

                reconnect_delay = 1
                frame_failures = 0
                if time.monotonic() - last_detection < frame_interval_seconds:
                    continue

                if stop_event.is_set():
                    break
                try:
                    people, _ = detector.detect_people(frame)
                except Exception as exc:
                    logger.error("Camera %s inference failed (%s).", camera_id, type(exc).__name__)
                    last_detection = time.monotonic()
                    continue

                if stop_event.is_set():
                    break
                try:
                    backend.send_occupancy(camera_id, people)
                    logger.info("Camera %s occupancy count submitted.", camera_id)
                except BackendClientError as exc:
                    logger.error("Camera %s occupancy request failed: %s", camera_id, exc)
                except Exception as exc:
                    logger.error("Camera %s occupancy request failed (%s).", camera_id, type(exc).__name__)
                last_detection = time.monotonic()
        except CameraConnectionError:
            if not stop_event.is_set():
                logger.warning(
                    "Camera %s could not open its RTSP stream; retrying in %s seconds.",
                    camera_id,
                    reconnect_delay,
                )
        except FrameUnavailableError:
            if not stop_event.is_set():
                logger.warning(
                    "Camera %s lost RTSP frames; reconnecting in %s seconds.",
                    camera_id,
                    reconnect_delay,
                )
        except Exception as exc:
            if not stop_event.is_set():
                logger.warning(
                    "Camera %s worker failed (%s); retrying in %s seconds.",
                    camera_id,
                    type(exc).__name__,
                    reconnect_delay,
                )
        finally:
            if source is not None:
                try:
                    source.release()
                except Exception as exc:
                    logger.error("Camera %s capture cleanup failed (%s).", camera_id, type(exc).__name__)

        if stop_event.is_set():
            break
        stop_event.wait(reconnect_delay)
        reconnect_delay = min(reconnect_delay * 2, MAX_RECONNECT_DELAY_SECONDS)

    logger.info("Camera %s worker exited.", camera_id)
