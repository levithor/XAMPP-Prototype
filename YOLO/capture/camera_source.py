import logging
import os

os.environ["OPENCV_LOG_LEVEL"] = "SILENT"

import cv2


logger = logging.getLogger(__name__)

class CameraConnectionError(Exception):
    pass


class CameraSource:
    OPEN_TIMEOUT_MS = 5000
    READ_TIMEOUT_MS = 5000

    def __init__(self, rtsp_url):
        try:
            params = [
                cv2.CAP_PROP_OPEN_TIMEOUT_MSEC,
                self.OPEN_TIMEOUT_MS,
                cv2.CAP_PROP_READ_TIMEOUT_MSEC,
                self.READ_TIMEOUT_MS,
            ]
            self.cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG, params)
        except (AttributeError, TypeError, cv2.error):
            logger.warning("OpenCV RTSP timeout parameters are unavailable; using backend defaults.")
            self.cap = cv2.VideoCapture(rtsp_url)

        if not self.cap.isOpened():
            self.cap.release()
            raise CameraConnectionError("Could not open RTSP capture.")

    def get_frame(self):
        ret, frame = self.cap.read()
        return frame if ret else None

    def release(self):
        self.cap.release()