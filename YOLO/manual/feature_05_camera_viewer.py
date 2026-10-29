import cv2

URL = "******192.168.1.108:554/cam/realmonitor?channel=1&subtype=1"


def main():
    cap = cv2.VideoCapture(URL)

    if not cap.isOpened():
        print("Could not connect.")
        return

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


if __name__ == "__main__":
    main()
