from unittest.mock import Mock

import main


def test_process_frame_sends_detected_occupancy(monkeypatch):
    frame = object()
    results = [object()]
    detector = Mock()
    detector.detect_people.return_value = (3, results)
    backend = Mock()
    backend.send_occupancy.return_value = {"log_id": 12}
    monkeypatch.setattr(main, "SAVE_DETECTIONS", False)

    main.process_frame(frame, 2, detector, backend, 7)

    detector.detect_people.assert_called_once_with(frame)
    detector.save_detection.assert_not_called()
    backend.send_occupancy.assert_called_once_with(camera_id=7, people=3)


def test_process_frame_sends_zero_occupancy(monkeypatch):
    detector = Mock()
    detector.detect_people.return_value = (0, [])
    backend = Mock()
    monkeypatch.setattr(main, "SAVE_DETECTIONS", False)

    main.process_frame(object(), 1, detector, backend, 7)

    backend.send_occupancy.assert_called_once_with(camera_id=7, people=0)


def test_process_frame_saves_detections_when_enabled(monkeypatch, tmp_path):
    results = [object()]
    detector = Mock()
    detector.detect_people.return_value = (1, results)
    backend = Mock()
    output_dir = str(tmp_path / "detections")
    monkeypatch.setattr(main, "SAVE_DETECTIONS", True)
    monkeypatch.setattr(main, "OUTPUT_DIR", output_dir)

    main.process_frame(object(), 3, detector, backend, 7)

    detector.save_detection.assert_called_once_with(
        results, f"{output_dir}/camera_7/frame_0003.jpg"
    )
    backend.send_occupancy.assert_called_once_with(camera_id=7, people=1)
