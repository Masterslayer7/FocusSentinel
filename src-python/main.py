import sys
import os
import json
import threading
import time
from utils.logger import log

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
    """Processes commands sent by the Electron orchestrator."""
    action = command.get("action")
    if action == "ping":
        send_response({"type": "pong"})
    elif action == "change_state":
        state = command.get("state")
        log(f"State transition request received: {state}", "INFO")
        # In implementation, this will toggle CV modules (e.g. pause camera in break mode)
    elif action == "exit":
        log("Exit command received. Shutting down.", "INFO")
        os._exit(0)
    else:
        log(f"Unknown action received: {action}", "WARNING")

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
    log("Initializing Python CV Pipeline...", "INFO")
    
    # Start stdin reader thread as a daemon so it exits when main exits
    stdin_thread = threading.Thread(target=read_stdin, daemon=True)
    stdin_thread.start()
    
    log("Main loop started. Emitting heartbeat telemetry...", "INFO")
    try:
        while True:
            # Emit telemetry frame to demonstrate active connection
            telemetry = {
                "type": "telemetry",
                "timestamp": time.time(),
                "data": {
                    "yaw": 0.0,
                    "pitch": 0.0,
                    "phone_detected": False
                }
            }
            send_response(telemetry)
            time.sleep(1.0)
    except (KeyboardInterrupt, SystemExit):
        log("Shutting down gracefully.", "INFO")
    except Exception as e:
        log(f"Fatal error in main loop: {e}", "ERROR")

if __name__ == "__main__":
    main()
