from ultralytics import YOLO

model = YOLO("yolov8n.pt")

results = model("sample.jpg")

results[0].save("output.jpg")

people = 0

for result in results:

    for cls in result.boxes.cls:

        if int(cls) == 0:
            people += 1

print("People:", people)