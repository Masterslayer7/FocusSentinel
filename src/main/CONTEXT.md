# Main Process Context

This module manages the Electron Main Process. It acts as the master system orchestrator, handles the desktop window lifecycle, and manages the execution and standard input/output pipes of the Python computer vision subprocess.

## Interfaces & API

### `PythonBridge` Class
The bridge communicates with Python using standard I/O (stdio) streams with Newline Delimited JSON (NDJSON) serialization.

#### Public Methods
* **`start(): void`**
  * Spawns the Python process (`python3 -u main.py`).
  * Establishes event listeners on `stdout` (telemetry parsing) and `stderr` (log capture).
* **`sendCommand(action: string, data?: Record<string, any>): void`**
  * Serializes `{ action, ...data }` to a JSON line and writes it to Python's `stdin` (terminated by `\n`).
  * Supported actions include `ping`, `change_state` (transitioning the vision loop between `FOCUS` and `BREAK`), and `change_camera` (e.g. `{ index: 1 }` to swap camera indexes in real time).
* **`stop(): void`**
  * Sends an `{ action: "exit" }` shutdown payload to Python.
  * Starts a 2-second timeout. If the child process does not close within the window, it executes `child.kill('SIGKILL')`.

#### Events Emitted (Extends `EventEmitter`)
* **`'message' (payload: any)`**: Triggered when a complete JSON object is parsed from the Python standard output stream.
* **`'close' (code: number | null)`**: Triggered when the Python process exits.
* **`'error' (err: Error)`**: Triggered if the process fails to spawn.

### IPC Window Control Listeners
The main process intercepts the following desktop window commands from the renderer via the preload bridge:
* **`window-minimize`**: Minimizes the desktop window.
* **`window-maximize`**: Toggles standard maximized and unmaximized window sizes.
* **`window-close`**: Triggers a window close operation, which subsequently tears down the active PythonBridge connection.

### Window Loading & Dev Server Retry
During development, the main process manages potential timing race conditions when loading the UI:
* If `process.env.ELECTRON_IS_DEV === '1'` is set, Electron attempts to connect to the Vite dev server at `http://127.0.0.1:5173`.
* A listener on the `did-fail-load` event catches connection failures (e.g., if Vite is still booting up) and automatically retries loading the URL after a 500ms delay.
* If the flag is not set, it loads the pre-compiled production bundle directly from the filesystem at `dist/renderer/index.html`.

### Graphics Acceleration & GPU Configuration
To ensure hardware-accelerated rendering compatibility across development setups (especially WSL2/WSLg and virtual displays) without throwing graphics context errors:
* **`disable-gpu-sandbox`**: Bypasses the GPU process sandbox to allow Electron to bind directly to virtual graphics nodes (like `/dev/dxg` or `/dev/dri/card*`).
* **`ignore-gpu-blocklist`**: Bypasses Chromium's GPU driver blacklist to prevent falling back to slow software-based rasterizers.

---

## Data & Process Flow

```mermaid
sequenceDiagram
    autonumber
    participant Electron Main as Main Process (JS)
    participant Bridge as PythonBridge (JS)
    participant Python as Python CV Pipeline (Py)

    Electron Main->>Bridge: start()
    Bridge->>Python: spawn (python3 -u main.py)
    activate Python
    Python-->>Bridge: stdout: telemetry (NDJSON heartbeat)
    Bridge-->>Electron Main: emit 'message' (telemetry)
    
    Electron Main->>Bridge: sendCommand("ping")
    Bridge->>Python: stdin: {"action": "ping"}\n
    Python-->>Bridge: stdout: {"type": "pong"}\n
    Bridge-->>Electron Main: emit 'message' (pong)

    Electron Main->>Bridge: sendCommand("change_camera", { index: 1 })
    Bridge->>Python: stdin: {"action": "change_camera", "index": 1}\n
    Python-->>Bridge: stdout: {"type": "status", "camera": "opened", "camera_index": 1}\n
    Bridge-->>Electron Main: emit 'message' (status)

    Electron Main->>Bridge: stop()
    Bridge->>Python: stdin: {"action": "exit"}\n
    Note over Python: os._exit(0)
    Python-->>Bridge: stdout/stdin pipes close
    deactivate Python
    Bridge-->>Electron Main: emit 'close' (0)
```

## Dependencies
* Node.js `child_process.spawn`
* Node.js `events.EventEmitter`
* Python Entrypoint: [main.py](file:///home/yugp/projects/FocusSentinel/src-python/main.py)
