# AI Development Guidelines & Rules

This document specifies the rules, workflows, and standards that AI assistants (such as Gemini) must adhere to when writing code, designing modules, or documenting architectural decisions in the **FocusSentinel** repository.

---

## Core Principles

### 1. Test-Driven Development (TDD)
All feature implementation, bug-fixing, and refactoring must follow a strict **Test-Driven Development (TDD)** ideology:
* Write a failing unit or integration test defining the behavior before writing the logic.
* Implement only the minimal code necessary to make the test pass.
* Refactor to ensure clean code while maintaining a passing test suite.

### 2. Simple Interfaces, Deep Implementation
* Maintain clean, elegant, and minimal interface signatures (classes, functions, APIs).
* Hide complex implementation details behind simple abstraction barriers.
* Avoid leaky abstractions.

---

## Documentation & Configuration Rules

The following conditional rules apply to all development activities:

### Rule 1: New Modules or Services
* **IF** you create a new module or service (e.g., a new subdirectory in python or typescript):
* **THEN** you must generate a `CONTEXT.md` file in that directory detailing its purpose, public interface, usage instructions, and external dependencies.

### Rule 2: Interface & Core Logic Changes
* **IF** you alter a function's parameters, return type, or core business logic:
* **THEN** you must update the corresponding interface contract and documentation inside `[module_name]/CONTEXT.md`.

### Rule 3: Data Flow & Execution Changes
* **IF** you change the flow of data or execution between components:
* **THEN** you must update the Mermaid sequence or state diagram in the module's corresponding `CONTEXT.md`.

### Rule 4: Structural Changes & Dependencies
* **IF** you introduce a new dependency, library, or make a structural architectural pivot:
* **THEN** you must explicitly prompt the user to ask if a new Architectural Decision Record (ADR) should be created in `docs/adr/`.

---

## File Directory Mapping

* **Architectural Decisions:** `docs/adr/` (sequential records, e.g., `001-use-stdio-child-process-spawn-for-ipc.md`)
* **Module Context & Interfaces:** `[module_name]/CONTEXT.md` (explains how to use the module interface and keeps diagrams up to date using Mermaid.js blocks).
