# Main Process Context

This module manages the Electron Main Process: window lifecycle, GPU flags for the local WebGPU LLM, and custom window-control IPC.

---

## 1. Directory Manifest & Boundaries

*   **Directory Manifest:**
    *   `main.ts`: Main process entry point. Handles window creation, Vite dev-server auto-retries, GPU flags configuration, and IPC listeners setup.
*   **Integration Boundaries:**
    *   **IPC Communication:** Intercepts UI requests from the Preload context bridge (via Electron `ipcMain` channels).

> The previous Python computer-vision subprocess (`PythonBridge`, stdio NDJSON contract) has been removed as part of the pivot away from camera-based detection. See `docs/adr/008-retire-camera-pipeline-and-licensing.md`. The next distraction signal (planned: desktop/active-window usage tracking) is expected to run in-process rather than via a spawned subprocess, but that's not yet built.

---

## 2. Public Interfaces & Contracts

### Main IPC Listeners (Preload Channel Gating)
The main process intercepts the following message events from the renderer process:
*   **`'window-minimize'`**: Minimizes the desktop application window.
*   **`'window-maximize'`**: Toggles maximized/restored desktop window frame state.
*   **`'window-close'`**: Closes the application frame.
