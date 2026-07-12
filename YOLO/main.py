import os
import time
import cv2

from api.backend_client import BackendClient
from detection.yolo_detector import YOLODetector
from capture.video_source import VideoSource
from capture.camera_source import CameraSource


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
        room_id=1,
        camera_id=1,
        people=people
    )

    print(f"Backend response: {response}")

def main():
    # source = VideoSource("input/demo.mp4", loop=True)
    source = CameraSource("rtsp://admin:Dahua01$@192.168.1.108:554/cam/realmonitor?channel=1&subtype=1")
    detector = YOLODetector()
    backend = BackendClient()

    last_capture = time.time()
    frame_count = 0

    try:

        while True:

            frame = source.get_frame()

            # Lost connection?
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
                    backend
                )

                last_capture = current_time
    finally:
        source.release()


if __name__ == "__main__":
    main()