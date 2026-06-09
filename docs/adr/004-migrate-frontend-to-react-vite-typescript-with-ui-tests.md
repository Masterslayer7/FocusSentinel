# Title: Migrate Frontend to React with Vite and TypeScript

Date: 2026-06-09

Status: Accepted

Context: The previous implementation of the FocusSentinel Electron renderer process was built using vanilla HTML and TypeScript. While functional for a basic dashboard, it suffered from scaling and maintainability issues. As the UI expands to support stateful toggles, real-time metrics, and dynamic logs, manual DOM manipulation (`document.getElementById`, direct HTML injection, and manual listener management) becomes highly verbose and prone to synchronization bugs. Furthermore, compiling the browser-centric renderer files with the same target-agnostic compiler configuration (`tsc`) as the Electron main process constrained configuration flexibility and prevented utilizing modern asset-bundling optimizations. There was also no mechanism to run automated tests on UI components in isolation.

Decision: We will migrate the Electron renderer process to React + Vite + TypeScript. Vite will serve as the specialized bundler/compiler for the browser assets, while the UI will be structured into distinct, modular functional components (Header, ControlBoard, TelemetryDisplay, and LogConsole). Additionally, we will introduce a dedicated UI test suite using Vitest, JSDOM, and React Testing Library to test component rendering and IPC triggers in isolation using mocked global bridges.

Consequences:
- Positive: Improves frontend modularity, separating standard inputs (control switches) from standard outputs (telemetry display metrics). Vite offers instant Hot Module Replacement (HMR) and optimal asset chunking. React components are testable using standard Testing Library wrappers without requiring the Electron main process or the Python backend to be active.
- Negative: Introduces additional framework packages (`react`, `react-dom`) and build tooling (`vite`, `@vitejs/plugin-react`), which increases `node_modules` size and overall project dependency footprint. Introduces React runtime overhead for virtual DOM diffing and state reconciliation. Developer dev startup now requires running Vite concurrently with Electron.
