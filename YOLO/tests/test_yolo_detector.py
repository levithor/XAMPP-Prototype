import unittest
from unittest.mock import patch

from detection.yolo_detector import YOLODetector


class FakeBoxes:
    def __init__(self, count):
        self.count = count

    def __len__(self):
        return self.count


class FakeResult:
    def __init__(self, count):
        self.boxes = FakeBoxes(count)
        self.plotted = object()

    def plot(self):
        return self.plotted


class YOLODetectorTests(unittest.TestCase):
    def test_inference_filters_to_person_and_count_matches_annotated_results(self):
        result = FakeResult(2)
        model = unittest.mock.Mock(return_value=[result])
        with patch("detection.yolo_detector.YOLO", return_value=model):
            detector = YOLODetector()

        people, results = detector.detect_people(object())

        model.assert_called_once()
        self.assertEqual(model.call_args.kwargs, {"classes": [0]})
        self.assertEqual(people, len(results[0].boxes))
        self.assertIs(detector.annotate_detections(results), result.plotted)


if __name__ == "__main__":
    unittest.main()
