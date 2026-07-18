# Title: Retire the Camera/YOLO Detection Pipeline and Licensing Infrastructure

Date: 2026-07-17

Status: Accepted

Context: FocusSentinel was originally built as a webcam-based phone-detection tool, architected with a Python/OpenCV/YOLO computer-vision pipeline (ADRs 001, 002, 003, 005, 006) bridged to the Electron main process over stdio, plus a licensing/tiers system (`LicenseManager`, `PremiumGuard`) gating premium features for a hypothetical wider audience. Building it this way — as a product for other users, with the privacy and monetization scaffolding that implies — is what the project's owner identifies as the reason the project stalled and burned them out. Reflecting on the project's purpose, the owner decided this is a personal tool first: success is measured by whether it helps them personally, not by feature breadth, portfolio polish, or marketability. Separately, webcam-based phone detection was always just one proxy for "distraction," and a narrow, easily-defeated one (phone under the desk, phone in another room) — it doesn't cover the more likely source of distraction for someone who works at a computer: browser/app switching on the same machine.

Decision: Remove the Python CV pipeline (`src-python/`, `PythonBridge`, the associated camera-control UI) and the licensing/monetization infrastructure (`LicenseManager`, `PremiumGuard`, `PremiumUpsellBanner`) entirely. This supersedes ADR-001 (stdio child-process IPC — was specifically for the Python CV bridge), ADR-002/003/005/006 (YOLO model selection and switching). ADR-004 (React/Vite/TS frontend migration) and ADR-007 (PromptBuilder decoupling) are unaffected and remain in effect, since neither is coupled to the camera pipeline or licensing.

The local LLM evaluator and `WebSpeechProvider` TTS service are kept — they're reusable for the next phase, which will pair a new distraction signal (planned: desktop/active-window usage tracking rather than a webcam) with a supportive, goal-aware LLM check-in instead of a punitive one.

Consequences:
- Positive: Removes ~1,300 lines of code and an entire subprocess/IPC contract that no longer serves the project's actual goal. Removes monetization scaffolding that had no real use case once the audience is "one person, the owner." Simplifies the architecture (no Python runtime, no camera permissions/privacy surface) ahead of building the actual next signal.
- Negative: The camera-based detection and licensing code is not preserved in the tree (only in git history) — rebuilding either, if ever wanted, starts from scratch rather than picking up where this left off. The `App.tsx` UI is temporarily reduced to a minimal shell (window controls only) until the new distraction signal and goal-input UI are built as their own increments.
