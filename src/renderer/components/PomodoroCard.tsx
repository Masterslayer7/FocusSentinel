import React from 'react';
import { formatClock } from './format';
import type { PomodoroPhase, PomodoroSettings, PomodoroStatus } from '../services/pomodoro/types';

interface PomodoroCardProps {
  status: PomodoroStatus;
  settings: PomodoroSettings;
  onStart: () => void;
  onPause: () => void;
  onSkip: () => void;
  onReset: () => void;
  onSettingsChange: (settings: PomodoroSettings) => void;
}

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
};

const FIELDS: { key: keyof PomodoroSettings; label: string; max: number }[] = [
  { key: 'focusMinutes', label: 'Focus (min)', max: 240 },
  { key: 'shortBreakMinutes', label: 'Short break (min)', max: 240 },
  { key: 'longBreakMinutes', label: 'Long break (min)', max: 240 },
  { key: 'longBreakEvery', label: 'Long break every', max: 12 },
];

export const PomodoroCard: React.FC<PomodoroCardProps> = ({
  status,
  settings,
  onStart,
  onPause,
  onSkip,
  onReset,
  onSettingsChange,
}) => {
  const updateField = (key: keyof PomodoroSettings, max: number, raw: string) => {
    const value = Number(raw);
    if (Number.isInteger(value) && value >= 1 && value <= max) {
      onSettingsChange({ ...settings, [key]: value });
    }
  };

  return (
    <section className="card pomodoro-card">
      <div className="card-header">
        <h2>Timer</h2>
        <span className={`tag ${status.phase === 'focus' ? 'tag-live' : 'tag-break'}`}>{PHASE_LABELS[status.phase]}</span>
      </div>

      <div className="pomodoro-clock" data-testid="pomodoro-clock" aria-live="off">
        {formatClock(status.remainingSeconds)}
      </div>
      <p className="pomodoro-meta">
        {status.completedFocusBlocks} focus {status.completedFocusBlocks === 1 ? 'block' : 'blocks'} done
        {status.phase === 'focus' && !status.isRunning && ' · distractions count once you start'}
      </p>

      <div className="row-buttons">
        {status.isRunning ? (
          <button className="btn btn-secondary" onClick={onPause}>Pause</button>
        ) : (
          <button className="btn btn-primary" onClick={onStart}>Start</button>
        )}
        <button className="btn btn-secondary" onClick={onSkip}>Skip</button>
        <button className="btn btn-secondary" onClick={onReset}>Reset</button>
      </div>

      <details className="settings-details">
        <summary>Timer lengths</summary>
        <div className="settings-grid">
          {FIELDS.map(({ key, label, max }) => (
            <div key={key} className="field">
              <label className="field-label" htmlFor={`pomodoro-${key}`}>{label}</label>
              <input
                id={`pomodoro-${key}`}
                className="input"
                type="number"
                min={1}
                max={max}
                defaultValue={settings[key]}
                key={`${key}-${settings[key]}`}
                onBlur={(event) => updateField(key, max, event.target.value)}
              />
            </div>
          ))}
        </div>
      </details>
    </section>
  );
};
