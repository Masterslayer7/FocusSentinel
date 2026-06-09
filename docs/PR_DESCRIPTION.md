# Pull Request: Support Local Camera Stream Override via Environment Configuration

## Description
This Pull Request implements a clean, production-grade configuration bridge allowing developers (specifically those working on WSL/virtualized environments) to stream their physical webcam feed over the local network into the computer vision pipeline, without affecting production hardware access.

## Key Changes
1. **Clean Configuration Architecture (`main.py`):**
   * Modified the core frame-capture state machine to dynamically resolve the webcam source from `FOCUS_SENTINEL_CAMERA_SRC`.
   * If the environment variable is not defined, the pipeline falls back directly to the native hardware camera index selected in the UI.
   * Added a lightweight, zero-dependency `load_dotenv()` parser that automatically reads local configurations from a `.env` file on startup.

2. **Developer Diagnostic Tooling (`scratch/verify_camera.py`):**
   * Created a generic webcam verification script in the `scratch/` directory.
   * It connects to the configured webcam source (either local or stream URL) and renders a GUI window showing real-time feed metrics, resolution, and FPS.
   * Safely releases locks and closes all windows on exit (`'q'` key or `Ctrl+C`).

3. **Strict Separation of Concerns:**
   * Updated `.gitignore` to prevent any local environment configurations (`.env`) or diagnostic scripts (`scratch/`) from being tracked or bundled into production.
   * Added `.env.example` as a template for other developers to configure their local stream overrides.

4. **Passing Test Suite:**
   * Updated the Python test suite to run in a clean "production-like" context (clearing the dev camera override during tests).
   * Verified all 10 tests run and pass successfully.

## Verification & Testing Instructions

### 1. Automated Tests
Run the Python test suite to ensure no regressions were introduced:
```bash
.venv/bin/python -m pytest
```

### 2. Manual Verification (WSL Developer Mode)
1. Start your Windows webcam streaming server:
   ```cmd
   python webcam_server.py
   ```
2. Copy `.env.example` to `.env` and configure your local Windows streaming IP:
   ```env
   FOCUS_SENTINEL_CAMERA_SRC=http://<Windows-IP>:5000/video_feed
   ```
3. Run the diagnostic tool in WSL to visually verify the stream:
   ```bash
   .venv/bin/python scratch/verify_camera.py
   ```
4. Start the main Electron application to verify telemetry updates in the log console:
   ```bash
   npm run dev
   ```
