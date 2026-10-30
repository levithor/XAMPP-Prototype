import logging
import threading
from urllib.parse import urlsplit


logger = logging.getLogger(__name__)


def valid_camera_config(config):
    if not config.get("assigned_room_id"):
        return False
    rtsp_url = config.get("rtsp_url")
    if not isinstance(rtsp_url, str):
        return False
    try:
        parsed = urlsplit(rtsp_url)
        if parsed.scheme.lower() != "rtsp" or not parsed.hostname or any(char.isspace() for char in rtsp_url):
            return False
        parsed.port
        return True
    except ValueError:
        return False


class CameraManager:
    def __init__(self, backend, worker_factory):
        self.backend = backend
        self.worker_factory = worker_factory
        self.workers = {}
        self._invalid_configs = {}

    @staticmethod
    def _signature(config):
        return config.get("rtsp_url"), config.get("assigned_room_id")

    def _request_stop(self, camera_id, handle):
        if not handle["stopping"]:
            logger.info("Stopping camera worker %s.", camera_id)
            handle["stop_event"].set()
            handle["stopping"] = True

    def reconcile(self):
        desired = self.backend.get_desired_cameras()
        desired_by_id = {
            int(config["camera_id"]): config
            for config in desired
            if str(config.get("camera_id", "")).isdigit()
        }

        for camera_id, handle in list(self.workers.items()):
            config = desired_by_id.get(camera_id)
            if (
                config is None
                or self._signature(config) != handle["signature"]
                or not handle["thread"].is_alive()
            ):
                if handle["thread"].is_alive():
                    self._request_stop(camera_id, handle)
                else:
                    del self.workers[camera_id]

        self._invalid_configs = {
            camera_id: signature
            for camera_id, signature in self._invalid_configs.items()
            if camera_id in desired_by_id
        }

        for camera_id, config in desired_by_id.items():
            handle = self.workers.get(camera_id)
            if handle:
                if handle["stopping"] or handle["signature"] != self._signature(config):
                    continue
                if handle["thread"].is_alive():
                    continue
                del self.workers[camera_id]

            if not valid_camera_config(config):
                signature = self._signature(config)
                if self._invalid_configs.get(camera_id) != signature:
                    logger.error(
                        "Camera %s is requested to connect but has no valid RTSP URL or room assignment.",
                        camera_id,
                    )
                    self._invalid_configs[camera_id] = signature
                continue

            self._invalid_configs.pop(camera_id, None)
            stop_event = threading.Event()
            target = self.worker_factory(config, stop_event)
            thread = threading.Thread(
                target=target,
                name=f"camera-worker-{camera_id}",
                daemon=False,
            )
            handle = {
                "signature": self._signature(config),
                "stop_event": stop_event,
                "thread": thread,
                "stopping": False,
            }
            thread.start()
            self.workers[camera_id] = handle
            logger.info("Started camera worker %s.", camera_id)

    def run(self, stop_event, poll_interval_seconds):
        while not stop_event.is_set():
            try:
                self.reconcile()
            except Exception as exc:
                logger.error("Camera configuration polling failed (%s).", type(exc).__name__)
            stop_event.wait(poll_interval_seconds)

    def stop_all(self):
        for camera_id, handle in self.workers.items():
            self._request_stop(camera_id, handle)
        for handle in self.workers.values():
            handle["thread"].join()
        self.workers.clear()
