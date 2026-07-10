import cv2

URL = "rtsp://admin:Dahua01$@192.168.1.108:554/cam/realmonitor?channel=1&subtype=1"

cap = cv2.VideoCapture(URL)

if not cap.isOpened():
    print("Could not connect.")
    exit()

while True:

    ret, frame = cap.read()

    if not ret:
        print("No frame")
        break

    cv2.imshow("Camera", frame)

    if cv2.waitKey(1) == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()