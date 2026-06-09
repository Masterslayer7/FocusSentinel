import sys
import os
import json
import threading
import time
from utils.logger import log

# Thread-safe state variables
state_lock = threading.Lock()
current_state = "BREAK"


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
    global current_state
    action = command.get("action")
    if action == "ping":
        send_response({"type": "pong"})
    elif action == "change_state":
        state = command.get("state")
        with state_lock:
            current_state = state
        log(f"State transition request received: {state}", "INFO")
    elif action == "exit":
        log("Exit command received. Shutting down.", "INFO")
        os._exit(0)
    else:
        log(f"Unknown action received: {action}", "WARNING")

def execute_loop_tick(cap, state):
    """
    Processes a single iteration of the camera capture state machine.
    Returns the updated capture object and any status responses.
    """
    response = None
    if state == "FOCUS":
        if cap is None:
            log("Entering FOCUS mode. Opening camera...", "INFO")
            cap = "MOCK_CAP"  # Placeholder representing camera instance
            response = {"type": "status", "camera": "opened"}
    else:  # state == "BREAK"
        if cap is not None:
            log("Entering BREAK mode. Releasing camera...", "INFO")
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
    global current_state
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
            
            # Execute state machine tick
            cap, status_response = execute_loop_tick(cap, state)
            if status_response:
                send_response(status_response)
            
            if state == "FOCUS":
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
    except Exception as e:
        log(f"Fatal error in main loop: {e}", "ERROR")

if __name__ == "__main__":
    main()
