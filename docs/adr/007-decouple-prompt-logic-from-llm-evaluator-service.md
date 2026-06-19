# Title: Decouple Prompt Compiler from LLM Evaluator Service

Date: 2026-06-19

Status: Accepted

Context: The `LlmEvaluator` service acts as a singleton managing WebGPU adapter mapping, VRAM state initialization, model downloads, and browser cache clearing. As we introduced persona presets (Drill Sergeant, Sarcastic Critic, Supportive Mentor, Disappointed Parent) and dynamic telemetry parsing, the `LlmEvaluator` class began accumulating complex prompt formatting logic. This code bloat compromised the "shallow interface" design of the service, exposing internal prompt compilation parameters, and tightly coupled the unit tests to the evaluator class file, making the service code harder to maintain and prone to regression errors during future sensor integrations.

Decision: We will decouple all prompt template construction, preset system instructions, metadata title-casing, and text trimmings from [LlmEvaluator.ts](file:///home/yugp/projects/FocusSentinel/src/renderer/services/LlmEvaluator.ts) into a standalone internal helper module, [PromptBuilder.ts](file:///home/yugp/projects/FocusSentinel/src/renderer/services/PromptBuilder.ts). The `LlmPreset` and `EvaluatorContext` types will be declared in `PromptBuilder.ts` (to avoid circular dependency loops) and imported/re-exported by `LlmEvaluator.ts`.

Consequences:
- Positive: [LlmEvaluator.ts](file:///home/yugp/projects/FocusSentinel/src/renderer/services/LlmEvaluator.ts) retains a shallow public interface (exposing only the singleton instance and types for callers), prompt compilation logic is isolated and easily maintainable in a single file, and unit tests can verify prompt layouts directly without setting up complex MLC engine mocks.
- Negative: Splitting logic into two files introduces module import overhead and requires maintaining re-exports in the root service file to avoid circular imports.
