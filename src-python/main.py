import sys
import os
import json
import threading
import time
import cv2
import collections
from utils.logger import log
from core.detector import ObjectDetector

# Thread-safe state variables
state_lock = threading.Lock()
current_state = "BREAK"
current_camera_index = 0
active_camera_index = 0
current_threshold = 0.75
current_model_name = "yolo11l.pt"
current_imgsz = 640


def read_stdin():
    """
    Reads JSON commands from stdin in a separate thread.
    This prevents blocking the main computer vision/telemetry loop.
    """
    log("Stdin reader thread started.", "INFO")
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                # EOF reached: Parent process has closed its end of the pipe or exited.
                log("Stdin pipe closed (EOF). Exiting Python process.", "INFO")
                break
            
            line = line.strip()
            if not line:
                continue
            
            try:
                command = json.loads(line)
                log(f"Command received: {command}", "DEBUG")
                handle_command(command)
            except json.JSONDecodeError:
                log(f"Invalid JSON received on stdin: {line}", "ERROR")
        except Exception as e:
            log(f"Error in stdin reader: {e}", "ERROR")
            break

def handle_command(command):
    """Processes commands [Json] sent by the Electron orchestrator."""
    global current_state, current_camera_index, current_threshold, current_model_name, current_imgsz
    action = command.get("action")
    if action == "ping":
        send_response({"type": "pong"})
    elif action == "change_state":
        state = command.get("state")
        with state_lock:
            current_state = state
        log(f"State transition request received: {state}", "INFO")
    elif action == "change_camera":
        index = command.get("index", 0)
        with state_lock:
            current_camera_index = index
        log(f"Camera change request received: index {index}", "INFO")
    elif action == "change_threshold":
        threshold = command.get("threshold", 0.45)
        with state_lock:
            current_threshold = float(threshold)
        log(f"Threshold change request received: {threshold}", "INFO")
    elif action == "change_model":
        model = command.get("model", "yolo26n.pt")
        with state_lock:
            current_model_name = model
        log(f"Model change request received: {model}", "INFO")
    elif action == "change_imgsz":
        imgsz = command.get("imgsz", 640)
        with state_lock:
            current_imgsz = int(imgsz)
        log(f"Inference resolution change request received: {imgsz}", "INFO")
    elif action == "exit":
        log("Exit command received. Shutting down.", "INFO")
        os._exit(0)
    else:
        log(f"Unknown action received: {action}", "WARNING")

# retruns dummy values of a real cv2.videoCapture in the case that no camera is found 
class MockVideoCapture:
    def __init__(self, idx):
        self.idx = idx
    def isOpened(self):
        return True
    def read(self):
        return True, None
    def release(self):
        pass

def _try_open_camera(source, result_dict):
    """Attempt to open cv2.VideoCapture in a background thread."""
    try:
        cap_obj = cv2.VideoCapture(source)
        if cap_obj.isOpened():
            if result_dict.get("timed_out", False):
                log(f"Background camera open succeeded after timeout for source {source}. Releasing...", "WARNING")
                cap_obj.release()
            else:
                result_dict["cap"] = cap_obj
                result_dict["success"] = True
        else:
            result_dict["success"] = False
    except Exception as e:
        log(f"Error in background camera opening thread: {e}", "ERROR")
        result_dict["success"] = False

def execute_loop_tick(cap, state, target_camera_index=0):
    """
    Processes a single iteration of the camera capture state machine.
    Returns the updated capture object and any status responses.
    """
    global active_camera_index
    response = None
    
    # Resolve the camera source: check env variable first if default index is requested
    if target_camera_index == 0:
        camera_source = os.environ.get("FOCUS_SENTINEL_CAMERA_SRC", 0)
    else:
        camera_source = target_camera_index
        
    try:
        # If it's a numeric string or digit-like, convert to int
        camera_source = int(camera_source)
    except (ValueError, TypeError):
        # Otherwise keep it as a string (e.g., URL stream)
        pass

    if state == "FOCUS":
        # Open camera if not already open, or switch if the source changed
        if cap is None or active_camera_index != camera_source:
            if cap is not None:
                log(f"Switching camera from {active_camera_index} to {camera_source}. Releasing old...", "INFO")
                if hasattr(cap, "release"):
                    cap.release()
                cap = None
            
            log(f"Opening camera source {camera_source} in a background thread...", "INFO")
            result_dict = {"cap": None, "success": False, "timed_out": False}
            t = threading.Thread(
                target=_try_open_camera,
                args=(camera_source, result_dict),
                daemon=True
            )
            t.start()
            t.join(timeout=2.0)
            
            if t.is_alive():
                result_dict["timed_out"] = True
                log(f"Opening camera source {camera_source} timed out after 2.0s. Falling back to mock camera.", "WARNING")
                cap = MockVideoCapture(camera_source)
                active_camera_index = camera_source
                response = {"type": "status", "camera": "opened", "camera_index": target_camera_index}
            else:
                if result_dict["success"]:
                    cap = result_dict["cap"]
                    active_camera_index = camera_source
                    response = {"type": "status", "camera": "opened", "camera_index": target_camera_index}
                else:
                    log(f"Failed to open camera source {camera_source}. Falling back to mock camera.", "WARNING")
                    cap = MockVideoCapture(camera_source)
                    active_camera_index = camera_source
                    response = {"type": "status", "camera": "opened", "camera_index": target_camera_index}
    else:  # state == "BREAK"
        if cap is not None:
            log("Entering BREAK mode. Releasing camera...", "INFO")
            if hasattr(cap, "release"):
                cap.release()
            cap = None
            response = {"type": "status", "camera": "released"}
    return cap, response

def resolve_model_path(model_name):
    """Resolves the path to the model, downloading and caching it in models/ if necessary."""
    models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, model_name)
    
    if not os.path.exists(model_path):
        log(f"Model {model_name} not found locally at {model_path}. Downloading from Ultralytics...", "INFO")
        try:
            # We import YOLO inside this function to avoid slow startup for other commands
            from ultralytics import YOLO
            # Load by name so it downloads to root directory
            temp_model = YOLO(model_name)
            
            # Locate the downloaded file in cwd and move it to models/
            if os.path.exists(model_name):
                os.rename(model_name, model_path)
                log(f"Model {model_name} successfully cached at {model_path}", "INFO")
            elif os.path.exists(os.path.join(os.getcwd(), model_name)):
                os.rename(os.path.join(os.getcwd(), model_name), model_path)
                log(f"Model {model_name} successfully cached at {model_path}", "INFO")
            else:
                log(f"Could not find downloaded file '{model_name}' to move. Attempting to use default fallback.", "WARNING")
        except Exception as e:
            log(f"Error downloading model {model_name}: {e}", "ERROR")
            
    return model_path

def send_response(payload):
    """
    Writes a JSON payload to stdout followed by a newline,
    and flushes stdout immediately to prevent buffering delays.
    """
    try:
        sys.stdout.write(json.dumps(payload) + "\n")
        sys.stdout.flush()
    except Exception as e:
        log(f"Failed to write to stdout: {e}", "ERROR")

def main():
    global current_state, current_camera_index, current_threshold, current_model_name, current_imgsz
    log("Initializing Python CV Pipeline...", "INFO")
    
    # Start stdin reader thread as a daemon so it exits when main exits
    stdin_thread = threading.Thread(target=read_stdin, daemon=True)
    stdin_thread.start()
    
    log("Main loop started.", "INFO")
    cap = None
    detector = None
    detection_history = collections.deque(maxlen=5)
    
    try:
        while True:
            with state_lock:
                state = current_state
                target_camera_index = current_camera_index
                target_threshold = current_threshold
                target_model_name = current_model_name
                target_imgsz = current_imgsz
            
            # Execute state machine tick
            cap, status_response = execute_loop_tick(cap, state, target_camera_index)
            if status_response:
                send_response(status_response)
            
            if state == "FOCUS":
                # Lazy-load YOLO detector when entering FOCUS mode, or if the model changed
                if detector is None or getattr(detector, "_model_name", None) != target_model_name:
                    log(f"Loading YOLO detector with model: {target_model_name}...", "INFO")
                    model_path = resolve_model_path(target_model_name)
                    detector = ObjectDetector(model_path=model_path, threshold=target_threshold, imgsz=target_imgsz)
                    detector._model_name = target_model_name
                
                # Update resolution dynamically if it changed
                if getattr(detector, "imgsz", 640) != target_imgsz:
                    log(f"Updating detector resolution (imgsz) to {target_imgsz}", "INFO")
                    detector.set_imgsz(target_imgsz)
                
                # Update threshold dynamically if it changed
                if detector.threshold != target_threshold:
                    log(f"Updating detector threshold to {target_threshold}", "INFO")
                    detector.set_threshold(target_threshold)
                
                phone_detected_raw = False
                if cap is not None:
                    try:
                        ret, frame = cap.read()
                        if ret:
                            # Run real frame inference to detect mobile phone
                            phone_detected_raw = detector.detect_phone(frame)
                        else:
                            log("Failed to read frame from active camera", "WARNING")
                    except Exception as e:
                        log(f"Exception while reading or processing frame: {e}", "WARNING")
                
                # Append raw result to history and compute rolling window filter
                detection_history.append(phone_detected_raw)
                if len(detection_history) >= 3:
                    phone_detected = (sum(detection_history) >= 3)
                else:
                    phone_detected = phone_detected_raw
                
                # Emit telemetry frame with smoothed phone detection state
                telemetry = {
                    "type": "telemetry",
                    "timestamp": time.time(),
                    "data": {
                        "phone_detected": phone_detected
                    }
                }
                send_response(telemetry)
                time.sleep(1.0)
            else:
                # Clear detection history when in BREAK mode
                detection_history.clear()
                # Sleep and wait in BREAK mode (low CPU usage)
                time.sleep(0.5)
    except (KeyboardInterrupt, SystemExit):
        log("Shutting down gracefully.", "INFO")
        if cap is not None:
            if hasattr(cap, "release"):
                cap.release()
    except Exception as e:
        log(f"Fatal error in main loop: {e}", "ERROR")
        if cap is not None:
            if hasattr(cap, "release"):
                cap.release()

# Does nothing if there is no .env file indicating not development enviorment and do nothing
def load_dotenv():
    """Reads a local .env file at the project root if it exists and populates os.environ."""
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

if __name__ == "__main__":
    load_dotenv()
    main()
