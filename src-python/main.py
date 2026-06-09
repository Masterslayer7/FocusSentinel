import sys
import os
import json
import threading
import time
import cv2
from utils.logger import log

# Thread-safe state variables
state_lock = threading.Lock()
current_state = "BREAK"
current_camera_index = 0
active_camera_index = 0


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
    global current_state, current_camera_index
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

def execute_loop_tick(cap, state, target_camera_index=0):
    """
    Processes a single iteration of the camera capture state machine.
    Returns the updated capture object and any status responses.
    """
    global active_camera_index
    response = None
    
    # Resolve the camera source: check env variable first, fall back directly to target index
    camera_source = os.environ.get("FOCUS_SENTINEL_CAMERA_SRC", target_camera_index)
        
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
            
            log(f"Opening camera source {camera_source}...", "INFO")
            cap_obj = cv2.VideoCapture(camera_source)
            if cap_obj.isOpened():
                cap = cap_obj
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
    global current_state, current_camera_index
    log("Initializing Python CV Pipeline...", "INFO")
    
    # Start stdin reader thread as a daemon so it exits when main exits
    stdin_thread = threading.Thread(target=read_stdin, daemon=True)
    stdin_thread.start()
    
    log("Main loop started.", "INFO")
    cap = None
    try:
        while True:
            with state_lock:
                state = current_state
                target_camera_index = current_camera_index
            
            # Execute state machine tick
            cap, status_response = execute_loop_tick(cap, state, target_camera_index)
            if status_response:
                send_response(status_response)
            
            if state == "FOCUS":
                # Try reading a frame from camera if active (to pump connection)
                if cap is not None:
                    try:
                        ret, frame = cap.read()
                        if not ret:
                            log("Failed to read frame from active camera", "WARNING")
                    except Exception as e:
                        log(f"Exception while reading frame: {e}", "WARNING")
                
                # Emit telemetry frame to demonstrate active connection
                telemetry = {
                    "type": "telemetry",
                    "timestamp": time.time(),
                    "data": {
                        "phone_detected": False
                    }
                }
                send_response(telemetry)
                time.sleep(1.0)
            else:
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
