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
    
    def save_detection(self, results, filename):
        results[0].save(filename)