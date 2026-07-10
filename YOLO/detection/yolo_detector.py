import cv2
import os
from ultralytics import YOLO

class YOLODetector:

    def __init__(self):
        self.model = YOLO("yolov8n.pt")

    def detect_people(self, frame):

        results = self.model(frame)

        people = 0

        for result in results:
            for cls in result.boxes.cls:
                if int(cls) == 0:
                    people += 1

        return people, results
    
    def save_detection(self, results, output_path):

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        annotated = results[0].plot()

        cv2.imwrite(output_path, annotated)