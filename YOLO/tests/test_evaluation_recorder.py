import csv
import tempfile
import unittest
from pathlib import Path

import numpy as np

from evaluation_recorder import EvaluationRecorder


class EvaluationRecorderTests(unittest.TestCase):
    def test_saves_unique_image_pairs_and_blank_ground_truth_until_limit(self):
        with tempfile.TemporaryDirectory() as output_dir:
            recorder = EvaluationRecorder(output_dir, max_samples=1)
            original = np.zeros((8, 8, 3), dtype=np.uint8)
            annotated = np.full((8, 8, 3), 255, dtype=np.uint8)

            try:
                self.assertTrue(recorder.record(7, original, annotated, 2, 12.5))
                self.assertFalse(recorder.record(7, original, annotated, 2, 12.5))
                self.assertTrue(recorder.is_full())

                with recorder.csv_path.open(newline="", encoding="utf-8") as csv_file:
                    rows = list(csv.DictReader(csv_file))

                self.assertEqual(len(rows), 1)
                self.assertEqual(rows[0]["frame_id"], "frame_0001")
                self.assertEqual(rows[0]["camera_id"], "7")
                self.assertEqual(rows[0]["predicted_count"], "2")
                self.assertEqual(rows[0]["inference_time_ms"], "12.500")
                self.assertEqual(rows[0]["ground_truth_count"], "")
                self.assertEqual(rows[0]["absolute_error"], "")
                self.assertEqual(rows[0]["exact_match"], "")
                self.assertTrue((recorder.session_dir / rows[0]["original_image_path"]).is_file())
                self.assertTrue((recorder.session_dir / rows[0]["annotated_image_path"]).is_file())
            finally:
                recorder.close()

    def test_creates_a_new_session_directory_for_each_recorder(self):
        with tempfile.TemporaryDirectory() as output_dir:
            first = EvaluationRecorder(output_dir, max_samples=1)
            second = EvaluationRecorder(output_dir, max_samples=1)
            try:
                self.assertNotEqual(first.session_dir, second.session_dir)
            finally:
                first.close()
                second.close()


if __name__ == "__main__":
    unittest.main()
