import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { FocusStatusPanel } from './components/FocusStatusPanel';
import { PomodoroCard } from './components/PomodoroCard';
import { Tabs } from './components/Tabs';
import { GoalsPanel } from './components/GoalsPanel';
import { AppsPanel } from './components/AppsPanel';
import { CoachPanel, type CheckInEntry } from './components/CoachPanel';
import { LogConsole } from './components/LogConsole';
import { useFocusTracker } from './services/focus/useFocusTracker';
import { useUsageTracking } from './services/focus/useUsageTracking';
import { useFocusCheckIn } from './services/focus/useFocusCheckIn';
import type { UsageCredit } from './services/focus/AppUsageTracker';
import { usePomodoro } from './services/pomodoro/usePomodoro';
import { useAppState } from './services/session/useAppState';
import { isPreset } from './services/session/appState';
import { useLlmModel } from './services/llm/useLlmModel';
import llmEvaluator from './services/llm/LlmEvaluator';

// A long session would otherwise grow these lists without bound.
const MAX_LOG_LINES = 100;
const MAX_CHECK_INS = 50;

const TABS = ['Goals', 'Apps', 'Coach', 'Log'] as const;
type Tab = (typeof TABS)[number];

const now = () => new Date().toLocaleTimeString();

export default function App() {
  const { state, dispatch, isLoaded, storageError } = useAppState();
  const pomodoro = usePomodoro(state.pomodoro);
  const { status, error, reset, isTracking } = useFocusTracker(state.rules, pomodoro.status.isFocusActive);
  const model = useLlmModel(llmEvaluator, state.modelId, isLoaded);

  const [tab, setTab] = useState<Tab>('Goals');
  const [logs, setLogs] = useState<string[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInEntry[]>([]);

  const appendLog = useCallback(
    (line: string) => setLogs((previous) => [...previous, line].slice(-MAX_LOG_LINES)),
    [],
  );

  useUsageTracking(
    useCallback(
      (credits: UsageCredit[]) =>
        credits.forEach((credit) => dispatch({ type: 'creditUsage', ...credit })),
      [dispatch],
    ),
  );

  const openGoals = useMemo(
    () => state.goals.filter((goal) => !goal.done).map((goal) => goal.text),
    [state.goals],
  );
  const checkIn = useFocusCheckIn(status, llmEvaluator, {
    preset: isPreset(state.persona) ? state.persona : 'Supportive Mentor',
    goals: openGoals,
    timeRemainingSeconds: pomodoro.status.remainingSeconds,
  });

  // One line per change of app or focus state, not one per 2s sample.
  // App name and state only — never a window title.
  useEffect(() => {
    if (!status.currentApp) return;
    appendLog(
      status.isDistracted
        ? `warn|${now()}  ${status.currentApp} — distracted (violations: ${status.violationCount})`
        : `info|${now()}  ${status.currentApp} — focused`,
    );
  }, [status.currentApp, status.isDistracted]);

  useEffect(() => {
    appendLog(
      `info|${now()}  ${pomodoro.status.isFocusActive ? 'Focus block running — tracking distractions' : 'Not in a focus block — distractions paused'}`,
    );
  }, [pomodoro.status.isFocusActive]);

  // Each check-in lands in the Coach tab and the log. Not yet spoken aloud.
  useEffect(() => {
    if (!checkIn) return;
    setCheckIns((previous) =>
      [{ id: Date.now(), time: now(), outcome: checkIn.outcome, text: checkIn.text }, ...previous].slice(0, MAX_CHECK_INS),
    );
    const label = `check-in #${checkIn.episode}`;
    appendLog(
      checkIn.outcome === 'replied'
        ? `info|${now()}  ${label}: ${checkIn.text}`
        : checkIn.outcome === 'skipped'
          ? `warn|${now()}  ${label} skipped by the evaluator (cooldown active)`
          : `warn|${now()}  ${label} failed: ${checkIn.text}`,
    );
  }, [checkIn]);

  const loadModel = (modelId: string) => {
    dispatch({ type: 'setModel', modelId });
    void model.load(modelId);
  };

  return (
    <div className="app-container">
      <Header
        onMinimize={() => window.api.minimize()}
        onMaximize={() => window.api.maximize()}
        onClose={() => window.api.close()}
      />

      {storageError && (
        <div className="storage-error" role="alert">{storageError}</div>
      )}

      <main className="app-main">
        <div className="column">
          <PomodoroCard
            status={pomodoro.status}
            settings={state.pomodoro}
            onStart={pomodoro.start}
            onPause={pomodoro.pause}
            onSkip={pomodoro.skip}
            onReset={pomodoro.reset}
            onSettingsChange={(settings) => dispatch({ type: 'setPomodoro', settings })}
          />
          <FocusStatusPanel status={status} isTracking={isTracking} error={error} onReset={reset} />
        </div>

        <Tabs tabs={TABS} active={tab} onChange={setTab}>
          {tab === 'Goals' && (
            <GoalsPanel
              goals={state.goals}
              onAdd={(text) => dispatch({ type: 'addGoal', id: crypto.randomUUID(), text })}
              onToggle={(id) => dispatch({ type: 'toggleGoal', id })}
              onRemove={(id) => dispatch({ type: 'removeGoal', id })}
              onClearDone={() => dispatch({ type: 'clearDoneGoals' })}
            />
          )}
          {tab === 'Apps' && (
            <AppsPanel
              usage={state.appUsage}
              rules={state.rules}
              onSetCategory={(appName, category) => dispatch({ type: 'setAppCategory', appName, category })}
              onSetBrowserTitles={(titles) => dispatch({ type: 'setBrowserTitles', titles })}
              onClearUsage={() => dispatch({ type: 'clearUsage' })}
            />
          )}
          {tab === 'Coach' && (
            <CoachPanel
              persona={state.persona}
              onPersonaChange={(persona) => dispatch({ type: 'setPersona', persona })}
              modelId={state.modelId}
              modelStatus={model.status}
              onLoadModel={loadModel}
              checkIns={checkIns}
            />
          )}
          {tab === 'Log' && <LogConsole streamLogs={logs} onClearLogs={() => setLogs([])} />}
        </Tabs>
      </main>
    </div>
  );
}
