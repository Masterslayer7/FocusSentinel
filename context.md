# Project Context: FocusSentinel

## Overview
FocusSentinel is a privacy-first, local-only desktop application designed to act as a strict digital study evaluator. It uses real-time computer vision to monitor distraction vectors (head pose, gaze, object detection) and leverages a local Large Language Model (LLM) and Text-to-Speech (TTS) to deliver verbal reprimands or encouragement based on an integrated Pomodoro state machine. 

**Core Philosophy:** Zero data retention. Air-gapped privacy by default. Authoritative but helpful persona.

## Architecture & Tech Stack
The application relies on a multi-process architecture to separate the frontend UI from the heavy computer vision pipeline, communicating strictly via Standard I/O (stdio) to avoid network/port exposure.

### 1. Frontend & Orchestrator (Node.js + Electron)
* **Language:** TypeScript
* **Framework:** Electron (Main Process) + React/HTML/CSS (Render Process)
* **Role:** Manages the UI, controls the Pomodoro state machine, and acts as the master process. It spawns the Python vision pipeline as a child process and listens to its `stdout` for JSON telemetry packets.

### 2. Computer Vision Pipeline (Python)
* **Language:** Python
* **Libraries:** OpenCV (frame capture), MediaPipe (facial landmarks, head pose, EAR), YOLOv8 Nano (lightweight object detection for `cell_phone`).
* **Role:** Runs in the background, extracts spatial vectors, and immediately drops the matrix frames. Emits telemetry (e.g., `yaw`, `pitch`, `phone_detected`) to `stdout`.

### 3. Evaluator Engine (Local AI)
* **LLM Engine:** `node-llama-cpp` running a quantized local model (e.g., Llama 3 8B or Phi-3 Mini) via the Node.js Main Process.
* **TTS Engine:** Piper TTS (local, offline) or Web Speech API.
* **Role:** Receives trigger events from the vision pipeline, generates contextual responses based on the current Pomodoro state, and speaks to the user.

## System States (Pomodoro Master Controller)
The behavior of all processes depends on the active timer state:
* **STATE_FOCUS:** Vision pipeline polls at high frequency. LLM persona is strict and highly reactive to distractions.
* **STATE_BREAK:** Vision pipeline is suspended (camera released, CPU usage drops). LLM persona is relaxed and encourages hydration/stretching.

## Strict Engineering Constraints & Rules for AI Assistants

When generating or modifying code for this project, you MUST adhere strictly to the following rules:

1. **Absolute Privacy (Zero-Data Retention):**
   * Never write code that saves video frames, image matrices, or audio logs to the disk. 
   * Volatile memory only. Once vectors are extracted, the OpenCV frame must be destroyed.
   * Do not implement external telemetry, crash reporting, or cloud analytics.

2. **Network Isolation:**
   * Default to 100% local operation. Do not use `fetch` or `axios` to call OpenAI, Anthropic, or external TTS APIs unless explicitly modifying the "Opt-In Cloud Settings" module.
   * Do not spin up Flask, FastAPI, or Express servers to communicate between Python and Node.js. Communication MUST be handled via `child_process.spawn` and `stdin`/`stdout` JSON streams.

3. **Performance & Throttling:**
   * The Python pipeline must run efficiently. Ensure proper `sys.stdout.flush()` usage so Node.js receives events without buffering delays.
   * Implement debouncing on the Node.js side so the LLM evaluator is not spammed by rapid consecutive vision triggers.

4. **Code Quality:**
   * Use strict TypeScript typing for all IPC (Inter-Process Communication) payloads.
   * Keep Python modules decoupled (e.g., separate classes for `PoseEstimator`, `ObjectDetector`, and `StreamManager`).