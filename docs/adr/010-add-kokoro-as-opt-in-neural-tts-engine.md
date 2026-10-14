# Title: Add Kokoro (kokoro-js) as an Opt-In Neural TTS Engine

Date: 2026-10-14

Status: Accepted

Context: Coach check-ins are now spoken aloud, each persona in its own voice (`src/renderer/services/tts/`). The first engine uses the voices built into the OS through the Web Speech API. On Windows that means three SAPI voices — Microsoft David, Mark and Zira — which work offline and instantly but sound robotic. A Drill Sergeant who sounds like a 2009 GPS undercuts the point of having personas, so the owner wanted a better-sounding option that still fits the project's rules: inference on this machine only, no cloud TTS (`context.md` constraint 2), and no local HTTP servers without a real need.

Three options were weighed:
- **Fish Speech 1.5.** The most expressive, and it can clone a voice from a short reference clip. But it is a Python/PyTorch model served over a local HTTP server, which would bring back the Python runtime ADR-008 removed, add a server process to manage, add several GB to the installer, and compete with the LLM for GPU memory. Its weights are also licensed non-commercial only.
- **Piper.** Small and fast on CPU, but it would need a native binary or a separate WASM build managed by the app, and its voices are a step below Kokoro's.
- **Kokoro-82M through `kokoro-js`.** An 82M-parameter model (Apache-2.0) that runs inside the renderer on the same ONNX/WebGPU stack the browser already provides. No Python, no server, no native code.

A spike in the running app (Electron 42, Windows) settled how it should run. On WASM it generated 4.9 seconds of audio in 8.9 seconds, slower than real time, because the page is not cross-origin isolated and so gets one thread. On WebGPU it generated 4.85 seconds of audio in 0.7 seconds once warm (about 2.5 seconds for the first sentence).

Decision: Add `kokoro-js` as a dependency and a second engine behind the existing `ITtsProvider` interface (`KokoroProvider`), next to the system voices (`WebSpeechProvider`).

- **Opt-in.** The saved speech settings gain an `engine` field, `'system'` by default. Kokoro is chosen on the Coach tab. Nobody downloads a model they did not choose.
- **WebGPU only**, with fp32 weights (`onnx-community/Kokoro-82M-v1.0-ONNX`). The LLM already requires WebGPU, so this adds no new hardware requirement.
- **Loaded lazily.** `kokoro-js` and transformers.js are imported dynamically, so they form their own chunk that loads only when Kokoro is used. The model (~300 MB) and each voice file download once from Hugging Face and are cached by the browser, exactly as web-llm's models are. Only model files come in; check-in text never leaves the machine.
- **Runtime bundled, not fetched.** transformers.js loads its ONNX runtime script from the jsDelivr CDN by default, which the app's Content Security Policy blocks. The runtime's `.mjs` and `.wasm` files are bundled into the app instead, through an `ort-runtime` alias in `vite.config.ts`.
- **Kept out of the installer.** Vite bundles everything the renderer needs, so the installer excludes `kokoro-js` and its dependencies' `node_modules` (about 400 MB, mostly `onnxruntime-node`, which only Node would use).
- Each persona gets a Kokoro voice: Drill Sergeant `am_fenrir`, Sarcastic Critic `bm_fable`, Supportive Mentor `af_heart`, Disappointed Parent `bf_emma`. Kokoro has a speed control but no pitch control, so persona pitch applies only to system voices.

Consequences:
- Positive: Check-ins sound natural, and the four personas are clearly different people. Everything still runs on this machine, and the engine is one class behind an interface the hook already uses, so it can be swapped or removed without touching the UI logic. The system voices remain as an instant, zero-download fallback.
- Negative: Choosing Kokoro costs a one-time ~300 MB download and a few hundred MB of GPU memory alongside the LLM. The installer grows by about 22 MB for the bundled ONNX runtime, whichever engine is used. There is no download-progress display yet: the first "Try voice" or check-in simply waits. The app now depends on two more fast-moving packages (`kokoro-js`, `@huggingface/transformers`), and the `ort-runtime` alias reaches past `@huggingface/transformers`' package exports to file names that may change between versions.
- Neutral: ADR-009's list of saved settings now includes the speech settings (on/off, engine, voice). Voice cloning remains possible later behind the same interface (e.g. a Fish Speech provider that is used only when the owner runs its server), but is not part of this decision.
