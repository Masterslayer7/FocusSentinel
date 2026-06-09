# Title: Use stdio child_process.spawn for Inter-Process Communication

Date: 2026-06-02

Status: Accepted

Context:
FocusSentinel is designed to be a privacy-first, local-only desktop application. We need to run a resource-intensive Python computer vision pipeline in the background and stream telemetry data (e.g., yaw, pitch, phone presence) to the Electron main process in real-time. Traditional IPC mechanisms like local HTTP (Flask/FastAPI) or WebSockets open local network ports, which exposes the application to potential local security exploits, triggers OS firewall prompts that degrade user trust, and can lead to orphan/zombie Python processes holding camera resources if the Electron process terminates abruptly.

Decision:
We will use standard I/O (stdio) streams spawned via Node's `child_process.spawn` for all communication between the Electron orchestrator and the Python vision pipeline. The processes will communicate using Newline Delimited JSON (NDJSON) payloads over `stdin`/`stdout`.

Consequences:
- **Positive:**
  - Absolute privacy and network isolation. No network ports are bound, and no firewall dialogs are triggered.
  - Strict lifecycle coupling. If the Electron process crashes or exits, the stdio pipe is broken, letting the Python process naturally clean up and release the camera.
  - Low performance overhead compared to full HTTP or ASGI loops.
- **Negative/Technical Debt:**
  - Standard output (`stdout`) is strictly reserved for IPC telemetry. We cannot use standard `print()` statements in Python for debugging, as they will corrupt the JSON stream. All logs and debugging output must be routed to standard error (`stderr`).
  - Stdio streams are chunked unpredictably by the OS. We must implement stream buffering and newline splitting (NDJSON) on both ends to prevent JSON parsing crashes on partial payloads.
  - Bypassing standard HTTP means we cannot use API explorers/clients (like Postman or Swagger) for direct testing, requiring custom mocks or CLI test drivers.
