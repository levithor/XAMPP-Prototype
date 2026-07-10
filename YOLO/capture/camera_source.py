import cv2

class CameraSource:

    def __init__(self, rtsp_url):

        self.cap = cv2.VideoCapture(rtsp_url)

        if not self.cap.isOpened():
            raise Exception("Could not connect to camera.")

    def get_frame(self):

        ret, frame = self.cap.read()

        if not ret:
            print("Camera frame lost.")
            return None

        return frame

    def release(self):
        self.cap.release()