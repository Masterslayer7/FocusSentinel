# Preload Module Context

The preload script acts as a secure, type-safe gateway exposing isolated Electron IPC channels from the Main process to the Renderer process without granting full Node.js API privileges.

---

## 1. Directory Manifest & Boundaries

*   **Directory Manifest:**
    *   `preload.ts`: Exposes safe Main-process messaging APIs to the global `window.api` namespace via `contextBridge`.
*   **Integration Boundaries:**
    *   **Electron Context Bridge:** Relies on `contextBridge` to expose functions to the UI securely.
    *   **IPC Communication:** Communicates with the Electron Main process via `ipcRenderer`.

> **Orphaned channels:** `onTelemetry`/`'python-telemetry'` and `sendCommand`/`'send-to-python'` are still exposed here but have no producer or consumer as of `docs/adr/008-retire-camera-pipeline-and-licensing.md` — the Python subprocess that emitted `'python-telemetry'` is gone, and `main.ts` no longer listens for `'send-to-python'`. They're not currently called from `App.tsx`. Left in place because the next feature (a new distraction signal, wired to the LLM/TTS services) will likely repurpose this same telemetry/command shape rather than invent a new one — but that repurposing hasn't happened yet, so treat these two as dead code until it does.

---

## 2. Architecture & Flow

```mermaid
graph LR
    Renderer[Renderer Window] -- window.api.minimize/maximize/close --> Preload[Preload Context Bridge]
    Preload -- ipcRenderer.send --> Main[Main Process]

    Renderer -. window.api.sendCommand .-> Preload
    Preload -. ipcRenderer.send: send-to-python .-> Void1[No listener]
    Preload -. window.api.onTelemetry .-> Void2[No emitter: python-telemetry]

    style Void1 fill:#6b7280,stroke:#374151,color:#fff
    style Void2 fill:#6b7280,stroke:#374151,color:#fff
```

---

## 3. Public Interfaces & Contracts

The Main World context exposes the following methods on the global `window.api` object:

### `window.api.minimize()`
*   **Input:** None
*   **Output:** `void`
*   **Description:** Requests the main process to minimize the application window. Sends `'window-minimize'`.

### `window.api.maximize()`
*   **Input:** None
*   **Output:** `void`
*   **Description:** Requests the main process to maximize/restore the application window. Sends `'window-maximize'`.

### `window.api.close()`
*   **Input:** None
*   **Output:** `void`
*   **Description:** Requests the main process to close the application window. Sends `'window-close'`.

### `window.api.onTelemetry(callback)` — currently orphaned, see note above
*   **Input:** `callback: (data: any) => void`
*   **Output:** `() => void` (Unsubscribe function)
*   **Description:** Subscribes a listener to the `'python-telemetry'` IPC channel. Nothing currently sends on this channel.

### `window.api.sendCommand(action, data)` — currently orphaned, see note above
*   **Input:** `action: string`, `data?: Record<string, any>`
*   **Output:** `void`
*   **Description:** Sends `{ action, data }` on the `'send-to-python'` IPC channel. Nothing currently listens on this channel.
