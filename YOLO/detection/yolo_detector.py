import cv2
import os
from ultralytics import YOLO

class YOLODetector:

    def __init__(self):
        self.model = YOLO("yolov8n.pt")

    def detect_people(self, frame):
        results = self.model(frame, classes=[0])
        people = sum(len(result.boxes) for result in results if result.boxes is not None)

        return people, results

    @staticmethod
    def annotate_detections(results):
        return results[0].plot()

    def save_detection(self, results, output_path):
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        cv2.imwrite(output_path, self.annotate_detections(results))