# AI Development Guidelines — FocusSentinel

Rules for Claude when writing code, designing modules, or recording decisions in this repo. This file covers workflow rules. For project philosophy and current architecture, read `context.md` first.

---

## Core Principles

### Test-Driven Development
Write a failing test before you write the logic it checks. Write only enough code to pass it. Refactor after, keeping the suite green.

### Shallow Interfaces, Deep Implementation
Keep interfaces small and plain. Hide complexity behind them. Never let internals leak through an interface.

### Small, Explained, Reviewed Steps
Work in small steps. Say what you're about to change, and why, before you change it. Run the tests after each step, before you start the next. Do not batch-generate large, multi-file changes — this project is built to be learned from, not just shipped.

---

## When To Do X

- **New module or service directory** → add a `CONTEXT.md` there: purpose, public interface, dependencies, and a Mermaid diagram of its flow.
- **Change a function's signature or its core logic** → update that module's `CONTEXT.md` to match.
- **Change how data or control flows between components** → update the Mermaid diagram in that `CONTEXT.md`.
- **Add a dependency, or make a structural or architectural pivot** → ask first whether it needs a new ADR in `docs/adr/`. Don't create one unasked.
- **Add a new IPC message shape, event payload, or command** → define its shape as a TypeScript interface, in a `types.ts` file if one fits. Never pass `any` across a process boundary.

The old stdout rule ("Python CV pipeline logs go to stderr, stdout is telemetry-only") is gone — the Python pipeline was removed. See `docs/adr/008-retire-camera-pipeline-and-licensing.md`.

---

## Writing Style

These guide the prose this project produces: docs, commit messages, ADRs, PR text, chat replies. The goal is direct and clear, not clipped or bare — a full explanation is welcome; padding isn't.

1. Skip the stock metaphor you've seen in print a hundred times — but a fresh one that actually clarifies something is welcome, not banned.
2. Prefer the plain word to the inflated one, without cutting a sentence down past what it needs to read well.
3. Cut words that pad a sentence out; keep words that earn their place, even if that makes the explanation longer.
4. Prefer the active voice; use the passive when it's genuinely the clearer choice.
5. Skip jargon or a foreign phrase when an everyday word says the same thing — but use the precise technical term when it's the correct one.
6. Break any of these the moment following them would make something awkward or unclear. Clarity wins.

---

## File Map

- `context.md` — project philosophy, current architecture, status.
- `docs/adr/` — architectural decisions, in order (`001-...`, `002-...`, ...).
- `[module]/CONTEXT.md` — a module's purpose, interface, and Mermaid diagrams.
