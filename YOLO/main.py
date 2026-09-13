import os
import time
import cv2

from api.backend_client import BackendClient
from detection.yolo_detector import YOLODetector
from capture.video_source import VideoSource
from capture.camera_source import CameraSource

CAMERA_ID = 1
FRAME_INTERVAL = 10 
OUTPUT_DIR = "output"
SAVE_DETECTIONS = True

def process_frame(frame, frame_count, detector, backend):
    people, results = detector.detect_people(frame)
    print(f"Frame {frame_count}: {people} people detected")

    if SAVE_DETECTIONS:
        detector.save_detection(
            results,
            f"output/detections/frame_{frame_count:04d}.jpg"
        )

    response = backend.send_occupancy(
        camera_id=1,
        people=people
    )

    print(f"Backend response: {response}")

def main():

    backend = BackendClient()

    # Get camera configuration from the backend/database
    camera = backend.get_camera(CAMERA_ID)

    print("Camera configuration retrieved:")
    print(camera)

    rtsp_url = camera["rtsp_url"]

    if not rtsp_url:
        raise Exception(
            f"Camera {CAMERA_ID} does not have an RTSP URL configured."
        )

    print(f"Connecting to camera {CAMERA_ID}...")

    source = CameraSource(rtsp_url)

    detector = YOLODetector()

    last_capture = time.time()
    frame_count = 0

    try:

        while True:

            frame = source.get_frame()

            if frame is None:
                print("No frame received.")
                continue

            current_time = time.time()

            if current_time - last_capture >= FRAME_INTERVAL:

                frame_count += 1

                process_frame(
                    frame,
                    frame_count,
                    detector,
                    backend,
                    CAMERA_ID
                )

                last_capture = current_time

    finally:
        source.release()


if __name__ == "__main__":
    main()