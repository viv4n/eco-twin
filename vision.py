import cv2
import json
import time
from ultralytics import YOLO

# Load the lightweight YOLOv8 Nano model
model = YOLO('yolov8n.pt')

# Fallback flag (Set to False if stage lighting fails at hackathon venue)
USE_LIVE_CAMERA = True

cap = cv2.VideoCapture(0 if USE_LIVE_CAMERA else 'demo_video.mp4')

print("Vision engine running... Press 'q' to stop.")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Run detection on Class 0 (Person only)
    results = model(frame, imgsz=640, classes=[0], verbose=False)
    person_count = len(results[0].boxes)

    # Display count on frame
    cv2.putText(frame, f"Occupancy: {person_count}", (30, 50),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    cv2.imshow("Module 01 - EcoTwin Vision", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()