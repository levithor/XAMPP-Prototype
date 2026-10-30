
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from detection.yolo_detector import YOLODetector


@pytest.fixture
def detector():
    instance = YOLODetector.__new__(YOLODetector)
    instance.model = Mock()
    return instance


def test_counts_three_people(detector):
    frame = Mock()
    result = SimpleNamespace(
        boxes=SimpleNamespace(cls=[0, 0, 0, 2])
    )
    results = [result]
    detector.model.return_value = results

    count, actual_results = detector.detect_people(frame)

    assert (count, actual_results) == (3, results)
    detector.model.assert_called_once_with(frame)


def test_counts_zero_people(detector):
    results = [
        SimpleNamespace(boxes=SimpleNamespace(cls=[2, 5]))
    ]
    detector.model.return_value = results

    assert detector.detect_people(Mock()) == (0, results)


def test_counts_zero_people_when_model_returns_no_results(detector):
    detector.model.return_value = []

    assert detector.detect_people(Mock()) == (0, [])


def test_invalid_frame_model_error_propagates(detector):
    detector.model.side_effect = ValueError("invalid frame")

    with pytest.raises(ValueError, match="invalid frame"):
        detector.detect_people(None)
