import os
import cv2
import json
import time
import copy
from collections import deque
from ultralytics import YOLO

import demo_payloads

STATE_FILE = "state.json"
TEMP_STATE_FILE = "state.json.tmp"

DEMO_MODE_FILE = "demo_mode.txt"

# Global Venue Protocol Flag: Set to False to run continuous demo_video.mp4 fallback
USE_LIVE_CAMERA = True

# Reference strictly ONLY the 36 DSU building keys
DSU_CAMPUS_BASELINE = demo_payloads.BASELINE_STATE
DSU_BUILDING_KEYS = set(DSU_CAMPUS_BASELINE.keys())

# Global mode tracker: "LIVE" (default)
active_mode = "LIVE"


def get_current_mode() -> str:
    """Checks for external mode trigger written by FastAPI server."""
    global active_mode
    if os.path.exists(DEMO_MODE_FILE):
        try:
            with open(DEMO_MODE_FILE, "r", encoding="utf-8") as f:
                mode = f.read().strip()
                if mode:
                    active_mode = mode
        except Exception:
            pass
    return active_mode


def set_current_mode(mode: str):
    """Sets active mode in memory and persists to demo_mode.txt for cross-module sync."""
    global active_mode
    active_mode = mode
    try:
        with open(DEMO_MODE_FILE, "w", encoding="utf-8") as f:
            f.write(mode)
    except Exception:
        pass


def atomic_write_state(state_dict: dict, max_retries: int = 3, retry_delay: float = 0.01):
    """
    Atomically writes the 36-zone state dictionary to state.json via temporary file.
    Tolerates Windows file locks by catching PermissionError/OSError and retrying.
    Ensures NO metadata keys like 'demo_mode' are stored.
    """
    # Guarantee strictly the 36 DSU building keys
    clean_state = {k: copy.deepcopy(state_dict[k]) for k in DSU_BUILDING_KEYS if k in state_dict}

    for attempt in range(max_retries):
        try:
            with open(TEMP_STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(clean_state, f, indent=2)
                f.flush()
                os.fsync(f.fileno())

            try:
                os.replace(TEMP_STATE_FILE, STATE_FILE)
            except (PermissionError, OSError):
                with open(STATE_FILE, "w", encoding="utf-8") as f:
                    json.dump(clean_state, f, indent=2)
            break
        except (PermissionError, OSError):
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
        except Exception:
            break


def initialize_clean_state():
    """
    Deletes legacy state.json and state.json.tmp on startup,
    writing a clean baseline containing strictly the 36 DSU building keys.
    """
    for file_path in [TEMP_STATE_FILE, STATE_FILE]:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass

    atomic_write_state(DSU_CAMPUS_BASELINE)


def get_video_capture():
    """Returns video capture according to USE_LIVE_CAMERA protocol."""
    if USE_LIVE_CAMERA:
        cap = cv2.VideoCapture(0)
    else:
        cap = cv2.VideoCapture("demo_video.mp4")

    # Request 1280x720 resolution for laptop webcams
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    return cap


def main():
    global active_mode

    # Delete legacy state files and write clean 36 DSU building baseline
    initialize_clean_state()

    # Load YOLOv8 Small model for higher detection accuracy on lower-quality feeds
    model = YOLO("yolov8s.pt")
    cap = get_video_capture()

    if not cap.isOpened():
        print(f"Error: Could not open video source (USE_LIVE_CAMERA={USE_LIVE_CAMERA}).")
        return

    # Enable normal resizing window so display stays scaled gracefully
    cv2.namedWindow("Module 01 - EcoTwin Vision", cv2.WINDOW_NORMAL)

    print("Vision engine running... Press 'q' to stop.")

    prev_time = time.time()
    zero_occupancy_start_time = None

    # 5-frame persistence buffer for smoothing brief occlusion / detection drops
    BUFFER_SIZE = 5
    count_buffer = deque(maxlen=BUFFER_SIZE)

    while True:
        ret, frame = cap.read()
        if not ret:
            # Fallback protocol: Continuous loop if using demo video
            if not USE_LIVE_CAMERA:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            else:
                break

        # Measure YOLOv8s inference latency with conf=0.20 to catch heavy body/face occlusions
        t_infer_start = time.perf_counter()
        results = model(frame, imgsz=640, classes=[0], conf=0.20, verbose=False)
        infer_latency_ms = (time.perf_counter() - t_infer_start) * 1000.0

        raw_person_count = 0

        # Draw green bounding boxes for detected persons
        if results and len(results) > 0:
            boxes = results[0].boxes
            raw_person_count = len(boxes)
            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0])
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                label = f"Person {conf:.2f}"
                cv2.putText(
                    frame,
                    label,
                    (x1, max(y1 - 10, 52)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (0, 255, 0),
                    1,
                    cv2.LINE_AA,
                )

        # Update persistence buffer and derive stable count
        count_buffer.append(raw_person_count)
        # Using max over the 5-frame window prevents transient drops to 0 during head turns/facial occlusion
        effective_person_count = max(count_buffer)

        curr_time = time.time()

        # Critical Energy Waste Logic:
        # Track duration when effective_person_count == 0.
        # If effective_person_count == 0 for > 5 seconds, status is critical_waste.
        is_critical_waste = False
        if effective_person_count == 0:
            if zero_occupancy_start_time is None:
                zero_occupancy_start_time = curr_time
            elif (curr_time - zero_occupancy_start_time) > 5.0:
                is_critical_waste = True
        else:
            zero_occupancy_start_time = None

        # Sync active mode from file or memory
        current_mode = get_current_mode()

        # Dynamic Real-time IoT State Emitting Logic:
        # 1. If current_mode == "LIVE": update soe_lecture_hall_1 within BASELINE_STATE + ambient telemetry drift.
        #    - If person_count == 0 for > 5s -> status = "critical_waste", occupancy = 0
        #    - If person_count > 0 -> status = "normal", occupancy = person_count
        # 2. Else: fetch scenario payload with micro-fluctuations and write it continuously each frame.
        if current_mode == "LIVE":
            state_to_write = demo_payloads.get_scenario("LIVE", curr_time)
            if is_critical_waste:
                state_to_write["soe_lecture_hall_1"]["status"] = "critical_waste"
                state_to_write["soe_lecture_hall_1"]["occupancy"] = 0
            else:
                state_to_write["soe_lecture_hall_1"]["status"] = "normal"
                state_to_write["soe_lecture_hall_1"]["occupancy"] = effective_person_count
            atomic_write_state(state_to_write)
        else:
            scenario_state = demo_payloads.get_scenario(current_mode, curr_time)
            atomic_write_state(scenario_state)

        # Calculate FPS
        fps = 1.0 / (curr_time - prev_time) if (curr_time - prev_time) > 0 else 0.0
        prev_time = curr_time

        # Determine Hall status
        if is_critical_waste:
            status_text = "CRITICAL_WASTE"
            status_color = (0, 0, 255)  # Red
        else:
            status_text = "NORMAL"
            status_color = (0, 255, 0)  # Green

        # ==========================================
        # TOP BANNER OVERLAY (Scales dynamically with frame width)
        # ==========================================
        h, w = frame.shape[:2]
        banner_h = 44
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, banner_h), (18, 18, 18), -1)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)
        cv2.line(frame, (0, banner_h), (w, banner_h), status_color, 2)

        # Top Banner Items: [FPS & Latency] | [Occupancy] | [Status]
        cv2.putText(
            frame,
            f"FPS: {fps:.1f} ({infer_latency_ms:.1f}ms) | Res: {w}x{h}",
            (16, 29),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 230, 255),
            1,
            cv2.LINE_AA,
        )

        center_text = f"SOE HALL 1: {effective_person_count} PERSON{'S' if effective_person_count != 1 else ''}"
        cv2.putText(
            frame,
            center_text,
            (int(w * 0.38), 29),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.58,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )

        cv2.putText(
            frame,
            f"[{status_text}]",
            (w - 230, 29),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.58,
            status_color,
            2,
            cv2.LINE_AA,
        )

        # Bottom telemetry card
        card_w, card_h = 470, 52
        card_y1 = h - card_h - 12
        card_y2 = h - 12
        cv2.rectangle(frame, (12, card_y1), (12 + card_w, card_y2), (24, 24, 24), -1)
        cv2.rectangle(frame, (12, card_y1), (12 + card_w, card_y2), (60, 60, 60), 1)

        cv2.putText(
            frame,
            f"Active Mode: {current_mode} | [w]eak [c]ool [e]nergy [p]ark [r]eset",
            (22, card_y1 + 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.41,
            (200, 240, 200),
            1,
            cv2.LINE_AA,
        )

        hvac_display = "CRITICAL WASTE" if is_critical_waste else "ACTIVE"
        cv2.putText(
            frame,
            f"SOE Hall 1: {hvac_display} | 36 Campus Zones Monitored",
            (22, card_y1 + 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.41,
            (0, 0, 255) if is_critical_waste else (180, 180, 180),
            1,
            cv2.LINE_AA,
        )

        cv2.imshow("Module 01 - EcoTwin Vision", frame)

        # Dynamic Keypress Handlers with Bold Formatted Terminal Logs
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        elif key == ord("w"):
            set_current_mode("water_leak")
            print("\n" + "=" * 70)
            print("[DEMO TRIGGER] Active Mode: WATER_LEAK -> Mutating 'pipe_junction_bwssb_1'")
            print("  Target Zone : pipe_junction_bwssb_1")
            print("  Status      : critical | leak_detected: True | water_pressure_psi: ~13.5-14.8 psi")
            print("=" * 70 + "\n")
        elif key == ord("c"):
            set_current_mode("cooling_failure")
            print("\n" + "=" * 70)
            print("[DEMO TRIGGER] Active Mode: COOLING_FAILURE -> Mutating 'main_server_room' & 'soe_lecture_hall_4'")
            print("  Target Zone 1: main_server_room    -> critical | temp: ~38.0-39.5 C | cooling_failure")
            print("  Target Zone 2: soe_lecture_hall_4  -> warning  | temp: ~28.0-29.5 C | hvac: failed")
            print("=" * 70 + "\n")
        elif key == ord("e"):
            set_current_mode("energy_waste")
            print("\n" + "=" * 70)
            print("[DEMO TRIGGER] Active Mode: ENERGY_WASTE -> Mutating 'soe_center_of_engineering' & 'soe_classroom_b4'")
            print("  Target Zone 1: soe_center_of_engineering -> critical | power: ~84.0-91.0 kW | overconsuming")
            print("  Target Zone 2: soe_classroom_b4          -> critical | co2_ppm: ~1180-1250 ppm")
            print("=" * 70 + "\n")
        elif key == ord("p"):
            set_current_mode("parking_congestion")
            print("\n" + "=" * 70)
            print("[DEMO TRIGGER] Active Mode: PARKING_CONGESTION -> Mutating 'parking_1', 'parking_3', 'parking_5'")
            print("  Target Zones: parking_1 (warning, 92-98%), parking_3 (critical, 95-100%), parking_5 (82-88%)")
            print("=" * 70 + "\n")
        elif key == ord("r"):
            set_current_mode("LIVE")
            print("\n" + "=" * 70)
            print("[DEMO TRIGGER] Active Mode: LIVE -> Resetting to Live Vision Inference")
            print("  Target Zone : soe_lecture_hall_1 (driven by webcam YOLOv8)")
            print("  Background  : 35 campus zones streaming ambient telemetry drift")
            print("=" * 70 + "\n")

    cap.release()
    cv2.destroyAllWindows()
    print("Vision engine stopped cleanly.")


if __name__ == "__main__":
    main()