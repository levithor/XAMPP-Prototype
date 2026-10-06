import time
import threading

from api.backend_client import BackendClient
from detection.yolo_detector import YOLODetector
from capture.camera_source import CameraSource

FRAME_INTERVAL = 10
SAVE_DETECTIONS = False
OUTPUT_DIR = "output"


def process_frame(frame, frame_count, detector, backend, camera_id):
    people, results = detector.detect_people(frame)

    print(
        f"Camera {camera_id} | "
        f"Frame {frame_count} | "
        f"People detected: {people}"
    )

    if SAVE_DETECTIONS:
        detector.save_detection(
            results,
            f"{OUTPUT_DIR}/camera_{camera_id}/"
            f"frame_{frame_count:04d}.jpg"
        )

    response = backend.send_occupancy(
        camera_id=camera_id,
        people=people
    )

    print(f"Camera {camera_id} | Backend response: {response}")


def camera_worker(camera, backend):
    camera_id = camera["camera_id"]
    camera_name = camera["camera_name"]
    rtsp_url = camera.get("rtsp_url")

    if not rtsp_url or not rtsp_url.strip():
        print(
            f"Camera {camera_id} ({camera_name}) skipped: "
            "no RTSP URL configured."
        )
        return

    detector = YOLODetector()

    while True:
        source = None

        try:
            print(
                f"Camera {camera_id} ({camera_name}): "
                "connecting..."
            )

            source = CameraSource(rtsp_url.strip())

            print(f"Camera {camera_id}: connected.")

            frame_count = 0
            last_capture = time.monotonic()

            while True:
                frame = source.get_frame()

                if frame is None:
                    raise RuntimeError("Camera frame lost.")

                now = time.monotonic()

                if now - last_capture >= FRAME_INTERVAL:
                    frame_count += 1

                    process_frame(
                        frame,
                        frame_count,
                        detector,
                        backend,
                        camera_id
                    )

                    last_capture = time.monotonic()

        except Exception as error:
            print(f"Camera {camera_id} error: {error}")
            print(f"Camera {camera_id}: retrying in 5 seconds.")

            time.sleep(5)

        finally:
            if source is not None:
                source.release()


def main():
    backend = BackendClient()

    cameras = backend.get_cameras()

    print(f"Found {len(cameras)} cameras in the database.")

    threads = []

    for camera in cameras:
        thread = threading.Thread(
            target=camera_worker,
            args=(camera, backend),
            name=f"Camera-{camera['camera_id']}",
            daemon=True
        )

        thread.start()
        threads.append(thread)

    if not threads:
        print("No cameras found.")
        return

    print(f"Started {len(threads)} camera workers.")

    try:
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("Stopping OccuVision camera workers...")


if __name__ == "__main__":
    main()