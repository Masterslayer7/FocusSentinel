# Title: Persist Goals, Settings, and App Usage to a Local File

Date: 2026-10-06

Status: Accepted

Context: `context.md` constraint 1 said nothing personal is written to disk: everything lives in memory for one session. That suited a tracker with a hard-coded allowlist and no user input. The next increment adds things the owner sets up by hand and expects to keep: a list of session goals, a choice of AI personality, Pomodoro lengths, a per-app rule (focus, distraction, or browser judged by tab title), the chosen local model, and a running list of which apps were used and for how long. Re-entering all of that on every launch would make the tool tedious enough not to use, which is the failure this personal-tool pivot (ADR-008) exists to avoid. The owner chose to save all of it, including goals and app usage history.

Decision: The main process saves one JSON file, `focussentinel-state.json`, in Electron's per-user data directory (`app.getPath('userData')`, e.g. `%APPDATA%\focussentinel\` on Windows). The renderer loads and saves it through two typed IPC calls (`state:load`, `state:save`); it never touches the filesystem itself. Writes go to a temporary file that is then renamed over the real one, so a crash mid-write cannot leave a half-written file. On load, the file is validated field by field: anything missing or malformed falls back to its default rather than failing the app.

What is saved: goals (text and done flag), per-app rules keyed by app display name, allowed browser tab-title keywords, persona, Pomodoro lengths, chosen model id, and per-app total seconds with a last-seen time.

What is still never saved: window titles. Tab titles reveal the most (what you read, who you message) and nothing in this increment needs them stored; they are compared in memory and dropped, as before. Nothing leaves the machine — no network calls, no telemetry. Constraint 1 in `context.md` is amended to say exactly this.

Consequences:
- Positive: Goals, rules and preferences survive restarts, so the tool is set up once. App usage history accumulates across sessions, which is what makes the per-app list useful for deciding what to allow.
- Negative: There is now a file of personal activity data (which apps, for how long) on disk, in plain text. Deleting it means deleting that file by hand; there is no in-app "clear history" yet. The persisted shape is now a contract: a future change to it needs a migration or a tolerant loader (the `version` field and per-field validation exist for this).
- Neutral: The main process gains a second responsibility besides window management and sampling. It stays small: one store module with no rules of its own.
