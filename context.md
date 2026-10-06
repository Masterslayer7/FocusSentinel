# Project Context: FocusSentinel

## Overview
FocusSentinel is a personal, local-only desktop tool built to help its one user (the developer) stay focused during work sessions. It watches for distraction signals, and uses a local Large Language Model (LLM) and Text-to-Speech (TTS) to offer supportive, motivating check-ins tied to the user's own stated goals for the session.

**Core Philosophy:** Built for personal use, not as a product for others. Success is measured by whether it actually helps its one user, not by feature breadth or polish. Local-only and zero-data-retention because that's the simplest, lowest-friction way to build this for oneself — not because it needs to earn a stranger's trust.

> Earlier direction (superseded): this project originally used webcam-based phone detection (YOLO/OpenCV) with a licensing/tiers system aimed at a wider audience. That direction caused scope creep and burnout, and has been retired. See `docs/adr/008-retire-camera-pipeline-and-licensing.md`.

## Where things stand
- **Electron + React shell**: window management, custom title bar — working.
- **Local LLM evaluator** (`src/renderer/services/llm/`): WebGPU-based local inference via `@mlc-ai/web-llm`, decoupled prompt building (see ADR-007). Reusable for the next phase; the existing personas need reframing toward supportive/motivational guidance rather than punitive reprimands.
- **TTS** (`src/renderer/services/tts/`): `WebSpeechProvider` implemented and tested.
- **Desktop usage tracking** (`src/main/WindowSampler.ts`, `src/renderer/services/focus/`): samples the Windows foreground window every 2s via `get-windows`, judges it against an in-memory allowlist (browsers by tab title, other apps by name), and shows live focus state, distraction duration, and violation count. Runs natively on Windows. See `docs/plans/desktop-usage-tracking.md`.
- **Camera/YOLO detection pipeline**: removed.
- **Licensing/tiers**: removed. No monetization plan.

## What's next (not yet built)
- A "goal" input so the user can state what they're working on and why, giving the LLM evaluator real context to be supportive rather than generic.
- Finishing the check-in loop: the focus signal already calls `LlmEvaluator` once per distraction episode, but `evaluate()` still returns a stub, nothing loads the model, `timeRemaining`/goal are placeholders, and replies are logged rather than spoken via TTS. Those remain before the core hypothesis (does a supportive AI check-in actually help) can be tested for real.

## Engineering Constraints & Rules for AI Assistants

1. **Zero-Data Retention:**
   * Never persist screen contents, audio, or other personal activity data to disk. Keep everything in memory for the duration of a session.
   * No external telemetry, crash reporting, or analytics.

2. **Local-First:**
   * No cloud LLM/TTS calls (OpenAI, Anthropic, etc.) unless the user explicitly asks for a cloud-backed option later.
   * Don't stand up local HTTP servers (Flask/Express/etc.) for communication between processes unless there's a real need for it — prefer direct in-process calls or Electron's own IPC.

3. **Code Quality:**
   * Strict TypeScript typing for IPC payloads and service interfaces.
   * Keep services decoupled and single-purpose (see `LlmEvaluator`/`PromptBuilder` split in ADR-007).

4. **Process:**
   * This project is being rebuilt deliberately, in small, explained, reviewed increments — not batch-generated. Don't propose or execute large multi-file autonomous changes; work one reviewable step at a time.
