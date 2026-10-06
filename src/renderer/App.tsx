import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { FocusStatusPanel } from './components/FocusStatusPanel';
import { LogConsole } from './components/LogConsole';
import { useFocusTracker } from './services/focus/useFocusTracker';
import { DEFAULT_RULES } from './services/focus/rules';
import { useFocusCheckIn } from './services/focus/useFocusCheckIn';
import llmEvaluator from './services/llm/LlmEvaluator';

// A long session would otherwise grow the activity log without bound.
const MAX_LOG_LINES = 100;

export default function App() {
  const { status, error, reset } = useFocusTracker(DEFAULT_RULES);
  const checkIn = useFocusCheckIn(status, llmEvaluator, {
    preset: 'Supportive Mentor',
    goals: [],
    timeRemainingSeconds: 25 * 60,
  });
  const [logs, setLogs] = useState<string[]>([]);

  const appendLog = (line: string) =>
    setLogs((previous) => [...previous, line].slice(-MAX_LOG_LINES));

  // One line per change of app or focus state, not one per 2s sample.
  // App name and state only — never a window title.
  useEffect(() => {
    if (!status.currentApp) {
      return;
    }
    const time = new Date().toLocaleTimeString();
    const line = status.isDistracted
      ? `warn|${time}  ${status.currentApp} — distracted (violations: ${status.violationCount})`
      : `info|${time}  ${status.currentApp} — focused`;
    appendLog(line);
  }, [status.currentApp, status.isDistracted]);

  // One line per check-in attempt. Not yet spoken aloud — piping replies into
  // TTS is the next increment.
  useEffect(() => {
    if (!checkIn) {
      return;
    }
    const time = new Date().toLocaleTimeString();
    const label = `check-in #${checkIn.episode}`;
    if (checkIn.outcome === 'replied') {
      appendLog(`info|${time}  ${label}: ${checkIn.text}`);
    } else if (checkIn.outcome === 'skipped') {
      appendLog(`warn|${time}  ${label} skipped by the evaluator (cooldown active)`);
    } else {
      appendLog(`warn|${time}  ${label} failed: ${checkIn.text}`);
    }
  }, [checkIn]);

  return (
    <div className="app-container">
      <Header
        onMinimize={() => window.api.minimize()}
        onMaximize={() => window.api.maximize()}
        onClose={() => window.api.close()}
      />

      <main className="app-main">
        <FocusStatusPanel status={status} error={error} onReset={reset} />
        <LogConsole streamLogs={logs} onClearLogs={() => setLogs([])} />
      </main>
    </div>
  );
}
