import os

os.environ["OPENCV_LOG_LEVEL"] = "SILENT"

import cv2
from capture.camera_source import CameraConnectionError, CameraSource


rtsp_url = os.getenv("RTSP_TEST_URL")


def main():
    if not rtsp_url:
        raise SystemExit("Set RTSP_TEST_URL to a camera stream before running this manual test.")

    try:
        source = CameraSource(rtsp_url)
    except CameraConnectionError:
        raise SystemExit("Could not connect to camera.") from None

    try:
        while True:
            frame = source.get_frame()
            if frame is None:
                print("No frame")
                break

            cv2.imshow("Camera", frame)

            if cv2.waitKey(1) == ord("q"):
                break
    finally:
        source.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
