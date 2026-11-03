import csv
import logging
import threading
from datetime import datetime
from pathlib import Path

import cv2


logger = logging.getLogger(__name__)

CSV_COLUMNS = (
    "frame_id",
    "timestamp",
    "camera_id",
    "predicted_count",
    "inference_time_ms",
    "original_image_path",
    "annotated_image_path",
    "ground_truth_count",
    "absolute_error",
    "exact_match",
)


class EvaluationRecorder:
    def __init__(self, output_dir, max_samples):
        if max_samples <= 0:
            raise ValueError("Maximum evaluation samples must be greater than zero.")

        self.max_samples = max_samples
        self._sample_count = 0
        self._lock = threading.Lock()

        session_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        self.session_dir = Path(output_dir) / f"session_{session_id}"
        self.original_dir = self.session_dir / "original"
        self.annotated_dir = self.session_dir / "annotated"
        self.original_dir.mkdir(parents=True, exist_ok=False)
        self.annotated_dir.mkdir(parents=True, exist_ok=False)

        self.csv_path = self.session_dir / "evaluation.csv"
        self._csv_file = self.csv_path.open("w", newline="", encoding="utf-8")
        self._writer = csv.DictWriter(self._csv_file, fieldnames=CSV_COLUMNS)
        self._writer.writeheader()
        self._csv_file.flush()

    def is_full(self):
        with self._lock:
            return self._sample_count >= self.max_samples

    def record(
        self,
        camera_id,
        original_frame,
        annotated_frame,
        predicted_count,
        inference_time_ms,
    ):
        with self._lock:
            if self._sample_count >= self.max_samples:
                return False

            frame_id = f"frame_{self._sample_count + 1:04d}"
            original_path = self.original_dir / f"{frame_id}.jpg"
            annotated_path = self.annotated_dir / f"{frame_id}.jpg"
            paths_written = []

            try:
                for image_path, image in (
                    (original_path, original_frame),
                    (annotated_path, annotated_frame),
                ):
                    if not cv2.imwrite(str(image_path), image):
                        raise OSError(f"Could not write evaluation image: {image_path}")
                    paths_written.append(image_path)

                self._writer.writerow(
                    {
                        "frame_id": frame_id,
                        "timestamp": datetime.now().astimezone().isoformat(timespec="seconds"),
                        "camera_id": camera_id,
                        "predicted_count": predicted_count,
                        "inference_time_ms": f"{inference_time_ms:.3f}",
                        "original_image_path": original_path.relative_to(self.session_dir).as_posix(),
                        "annotated_image_path": annotated_path.relative_to(self.session_dir).as_posix(),
                        "ground_truth_count": "",
                        "absolute_error": "",
                        "exact_match": "",
                    }
                )
                self._csv_file.flush()
            except Exception:
                for image_path in paths_written:
                    if image_path.exists():
                        image_path.unlink()
                raise

            self._sample_count += 1
            if self._sample_count == self.max_samples:
                logger.info(
                    "Evaluation sample limit of %s reached; no further samples will be saved. "
                    "Backend occupancy reporting continues.",
                    self.max_samples,
                )
            return True

    def close(self):
        with self._lock:
            if not self._csv_file.closed:
                self._csv_file.close()
