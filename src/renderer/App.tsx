import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { FocusStatusPanel } from './components/FocusStatusPanel';
import { LogConsole } from './components/LogConsole';
import { useFocusTracker } from './services/focus/useFocusTracker';
import { DEFAULT_RULES } from './services/focus/rules';

// A long session would otherwise grow the activity log without bound.
const MAX_LOG_LINES = 100;

export default function App() {
  const { status, error, reset } = useFocusTracker(DEFAULT_RULES);
  const [logs, setLogs] = useState<string[]>([]);

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
    setLogs((previous) => [...previous, line].slice(-MAX_LOG_LINES));
  }, [status.currentApp, status.isDistracted]);

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
