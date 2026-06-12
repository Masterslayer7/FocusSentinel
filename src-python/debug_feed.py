import os
import sys
import time
import cv2
from core.detector import ObjectDetector
from main import resolve_model_path

def main():
    print("====================================================")
    print("   FocusSentinel Vision Debug Feed & Calibration")
    print("====================================================")
    print("Controls:")
    print("  - Use the Trackbar at the top to adjust threshold.")
    print("  - Press 'n' to switch to YOLO Nano (yolo26n.pt).")
    print("  - Press 's' to switch to YOLO Small (yolo26s.pt).")
    print("  - Press 'm' to switch to YOLO Medium (yolo11m.pt).")
    print("  - Press 'l' to switch to YOLO Large (yolo11l.pt).")
    print("  - Press 'x' to switch to YOLO Extra Large (yolo11x.pt).")
    print("  - Press '1' to set vision range to 640px (Standard).")
    print("  - Press '2' to set vision range to 960px (Extended).")
    print("  - Press '3' to set vision range to 1280px (Maximum).")
    print("  - Press 'q' or 'ESC' to exit.")
    print("====================================================")

    # 1. Read local environment configuration
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

    # 2. Resolve camera source
    camera_source = os.environ.get("FOCUS_SENTINEL_CAMERA_SRC", 0)
    try:
        camera_source = int(camera_source)
    except (ValueError, TypeError):
        pass

    # 3. Initialize video capture
    print(f"Connecting to camera source: {camera_source}...")
    cap = cv2.VideoCapture(camera_source)
    if not cap.isOpened():
        print(f"Error: Could not open camera source: {camera_source}")
        sys.exit(1)

    # 4. Initialize detector with default Large model
    model_name = "yolo11l.pt"
    model_path = resolve_model_path(model_name)
    print(f"Loading detector weights: {model_path}...")
    detector = ObjectDetector(model_path=model_path, threshold=0.75)
    detector._model_name = model_name

    window_name = "FocusSentinel Calibration Tool"
    cv2.namedWindow(window_name)

    # Callback function for trackbar changes
    def on_trackbar_change(val):
        threshold = val / 100.0
        detector.set_threshold(threshold)
        print(f"Threshold adjusted to: {threshold:.2f}")

    # Create trackbar for adjusting threshold (20% to 90%)
    cv2.createTrackbar("Threshold (%)", window_name, 75, 90, on_trackbar_change)
    cv2.setTrackbarMin("Threshold (%)", window_name, 20)

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Warning: Failed to read frame from camera. Retrying...")
                time.sleep(0.1)
                continue

            # Copy frame for overlays
            debug_frame = frame.copy()

            # Run YOLO inference
            results = detector.model(frame, verbose=False)
            
            phone_detected = False
            for r in results:
                if r.boxes is not None:
                    # Get box coordinates, class IDs, and confidence values
                    boxes = r.boxes.xyxy.cpu().numpy()
                    classes = r.boxes.cls.cpu().numpy()
                    confidences = r.boxes.conf.cpu().numpy()
                    
                    for box, cls_id, conf in zip(boxes, classes, confidences):
                        # COCO class 67 is cell_phone
                        if int(cls_id) == 67:
                            x1, y1, x2, y2 = map(int, box)
                            is_above_threshold = conf >= detector.threshold
                            # Green if active detection, Red if below current threshold
                            color = (0, 255, 0) if is_above_threshold else (0, 0, 255)
                            if is_above_threshold:
                                phone_detected = True
                            
                            # Draw bounding box
                            cv2.rectangle(debug_frame, (x1, y1), (x2, y2), color, 2)
                            
                            # Label with confidence
                            label = f"Cell Phone: {conf:.2f}"
                            cv2.putText(debug_frame, label, (x1, y1 - 10),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            # Draw calibration overlay info box
            status_text = "PHONE DETECTED" if phone_detected else "SCANNING..."
            status_color = (0, 255, 0) if phone_detected else (255, 255, 255)
            
            # Status card background
            cv2.rectangle(debug_frame, (0, 0), (340, 95), (15, 23, 42), -1)
            cv2.putText(debug_frame, f"Status: {status_text}", (10, 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
            cv2.putText(debug_frame, f"Threshold: {detector.threshold:.2f}", (10, 48),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            cv2.putText(debug_frame, f"Range/Res: {detector.imgsz}px", (10, 68),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (220, 220, 220), 1)
            cv2.putText(debug_frame, f"Model: {detector._model_name}", (10, 85),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (180, 180, 180), 1)

            # Show the output frame
            cv2.imshow(window_name, debug_frame)

            # Process key triggers
            key = cv2.waitKey(30) & 0xFF
            if key == ord('q') or key == 27:  # 'q' or ESC to quit
                break
            elif key == ord('n'):
                # Switch to YOLO Nano
                nano_model = "yolo26n.pt"
                nano_path = resolve_model_path(nano_model)
                print(f"Loading YOLO Nano weights: {nano_path}...")
                detector.set_model(nano_path)
                detector._model_name = nano_model
            elif key == ord('s'):
                # Switch to YOLO Small
                small_model = "yolo26s.pt"
                small_path = resolve_model_path(small_model)
                print(f"Loading YOLO Small weights: {small_path}...")
                detector.set_model(small_path)
                detector._model_name = small_model
            elif key == ord('m'):
                # Switch to YOLO Medium
                med_model = "yolo11m.pt"
                med_path = resolve_model_path(med_model)
                print(f"Loading YOLO Medium weights: {med_path}...")
                detector.set_model(med_path)
                detector._model_name = med_model
            elif key == ord('l'):
                # Switch to YOLO Large
                large_model = "yolo11l.pt"
                large_path = resolve_model_path(large_model)
                print(f"Loading YOLO Large weights: {large_path}...")
                detector.set_model(large_path)
                detector._model_name = large_model
            elif key == ord('x'):
                # Switch to YOLO Extra Large
                xl_model = "yolo11x.pt"
                xl_path = resolve_model_path(xl_model)
                print(f"Loading YOLO Extra Large weights: {xl_path}...")
                detector.set_model(xl_path)
                detector._model_name = xl_model
            elif key == ord('1'):
                print("Setting resolution to 640px...")
                detector.set_imgsz(640)
            elif key == ord('2'):
                print("Setting resolution to 960px...")
                detector.set_imgsz(960)
            elif key == ord('3'):
                print("Setting resolution to 1280px...")
                detector.set_imgsz(1280)
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("Debug feed stopped. Resources released.")

if __name__ == "__main__":
    main()
