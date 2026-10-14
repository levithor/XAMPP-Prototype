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


def camera_worker(camera, backend, stop_event):
    camera_id = camera["camera_id"]
    rtsp_url = camera.get("rtsp_url")

    if not rtsp_url or not rtsp_url.strip():
        print(f"Camera {camera_id}: missing RTSP URL")
        return

    detector = YOLODetector()

    while not stop_event.is_set():
        source = None

        try:
            source = CameraSource(rtsp_url.strip())
            print(f"Camera {camera_id}: connected")

            last_capture = time.monotonic()
            frame_count = 0

            while not stop_event.is_set():
                frame = source.get_frame()

                if frame is None:
                    raise RuntimeError("Camera frame lost")

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
            if not stop_event.is_set():
                print(f"Camera {camera_id}: {error}")
                stop_event.wait(5)

        finally:
            if source is not None:
                source.release()

    print(f"Camera {camera_id}: worker stopped")


def main():
    backend = BackendClient()

    # camera_id -> (thread, stop_event)
    workers = {}

    try:
        while True:
            cameras = backend.get_cameras()

            desired_ids = {
                camera["camera_id"]
                for camera in cameras
                if camera.get("connection_enabled")
                and camera.get("rtsp_url")
            }

            # Stop workers that are no longer enabled.
            for camera_id in list(workers):
                thread, stop_event = workers[camera_id]

                if camera_id not in desired_ids:
                    stop_event.set()
                    thread.join(timeout=3)

                    if not thread.is_alive():
                        del workers[camera_id]
                    else:
                        print(
                            f"Camera {camera_id}: "
                            "waiting for worker to stop"
                        )

            # Start workers for newly enabled cameras.
            for camera in cameras:
                camera_id = camera["camera_id"]

                if camera_id not in desired_ids:
                    continue

                if camera_id not in workers:
                    stop_event = threading.Event()

                    thread = threading.Thread(
                        target=camera_worker,
                        args=(camera, backend, stop_event),
                        name=f"Camera-{camera_id}",
                        daemon=True
                    )

                    workers[camera_id] = (thread, stop_event)
                    thread.start()

            time.sleep(3)

    except KeyboardInterrupt:
        print("Stopping all camera workers...")

    finally:
        for thread, stop_event in workers.values():
            stop_event.set()

        for thread, stop_event in workers.values():
            thread.join(timeout=3)


if __name__ == "__main__":
    main()