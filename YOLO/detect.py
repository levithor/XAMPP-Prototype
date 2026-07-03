import cv2

video = cv2.VideoCapture("videos/classroom.mp4")
fps = video.get(cv2.CAP_PROP_FPS)
frame_interval = int(fps * 10)
frame_number = 0

while True:
    success, frame = video.read()
    if not success:
        break
    if frame_number % frame_interval == 0:
        filename = f"frames/frame_{frame_number}.jpg"
        cv2.imwrite(filename, frame)
        print(filename)
    frame_number += 1

video.release()