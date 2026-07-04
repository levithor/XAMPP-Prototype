import os
import time

import cv2

from capture.video_source import VideoSource

FRAME_INTERVAL = 10  # seconds between captured stills
OUTPUT_DIR = "output"


def process_frame(frame, frame_count):
    """Save the frame as a still image, e.g. to simulate a captured shot
    from a live camera feed."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(OUTPUT_DIR, f"frame_{frame_count:04d}.jpg")
    cv2.imwrite(out_path, frame)
    print(f"Captured {out_path}")


def main():
    source = VideoSource("input/demo.mp4", loop=True)

    last_capture = time.time()
    frame_count = 0

    # Reference point for real-time pacing. We compare "how much video
    # time should have elapsed" against "how much wall-clock time has
    # actually elapsed" to avoid drift from read/processing overhead.
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
                process_frame(frame, frame_count)
                last_capture = current_time
    finally:
        source.release()


if __name__ == "__main__":
    main()