import os
import time
import cv2

from api.backend_client import BackendClient
from detection.yolo_detector import YOLODetector
from capture.video_source import VideoSource

FRAME_INTERVAL = 10 
OUTPUT_DIR = "output"


def process_frame(frame, frame_count, detector, backend):
    people, results = detector.detect_people(frame)
    print(f"Frame {frame_count}: {people} people detected")

    # Optional: save annotated image for debugging
    # detector.save_detection(
    #     results,
    #     f"output/detections/frame_{frame_count:04d}.jpg"
    # )

    response = backend.send_occupancy(
        room_id=1,
        camera_id=1,
        people=people
    )

    print(f"Backend response: {response}")

def main():
    source = VideoSource("input/demo.mp4", loop=True)
    detector = YOLODetector()
    backend = BackendClient()

    last_capture = time.time()
    frame_count = 0

    playback_start = time.time()
    frame_index = 0
    frame_delay = source.get_frame_delay()

    try:
        while True:
            frame = source.get_frame()
            if frame is None:
                break

            frame_index += 1
            expected_elapsed = frame_index * frame_delay
            actual_elapsed = time.time() - playback_start
            sleep_time = expected_elapsed - actual_elapsed

            if sleep_time > 0:
                time.sleep(sleep_time)

            current_time = time.time()
            if current_time - last_capture >= FRAME_INTERVAL:
                frame_count += 1
                process_frame(frame, frame_count, detector, backend)
                last_capture = current_time
    finally:
        source.release()


if __name__ == "__main__":
    main()