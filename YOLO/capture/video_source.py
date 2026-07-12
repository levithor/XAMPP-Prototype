import cv2

class VideoSource:
    def __init__(self, video_path, loop=True):
        self.cap = cv2.VideoCapture(video_path)
        if not self.cap.isOpened():
            raise Exception(f"Could not open video: {video_path}")

        self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        if self.fps <= 0:
            self.fps = 30

        self.loop = loop

    def get_frame(self):
        """Reads the next frame. No sleeping here -- pacing is the
        caller's responsibility, otherwise you double up on delays."""
        ret, frame = self.cap.read()

        if not ret:
            if not self.loop:
                return None
            # Try to loop back to the start
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = self.cap.read()
            if not ret:
                # Video is genuinely unreadable, even after rewind
                return None

        return frame

    def get_frame_delay(self):
        return 1.0 / self.fps

    def release(self):
        self.cap.release()