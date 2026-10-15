import cv2
import json
import time
import state
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

    live_state = state.read_state()
    if live_state.get("_meta", {}).get("demo_mode") is True:
        cv2.imshow("Module 01 - EcoTwin Vision", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
        continue

    next_state = dict(live_state)
    next_state["_meta"] = dict(next_state.get("_meta", {}))
    next_state["lecture_hall_a"] = dict(next_state.get("lecture_hall_a", {}))
    next_state["lecture_hall_a"]["occupancy"] = person_count
    next_state["lecture_hall_a"]["status"] = "normal" if person_count < 12 else "low" if person_count < 25 else "warning" if person_count < 40 else "critical"
    state.write_state(next_state)

    cv2.imshow("Module 01 - EcoTwin Vision", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()