import React, { useState } from 'react';
import type { Goal } from '../services/session/types';

interface GoalsPanelProps {
  goals: Goal[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onClearDone: () => void;
}

export const GoalsPanel: React.FC<GoalsPanelProps> = ({ goals, onAdd, onToggle, onRemove, onClearDone }) => {
  const [draft, setDraft] = useState('');
  const hasDone = goals.some((goal) => goal.done);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft('');
  };

  return (
    <div className="panel-stack">
      <p className="section-desc">Your coach sees every unfinished goal at each check-in and points you back to the one that fits.</p>

      <form className="inline-form" onSubmit={submit}>
        <input
          id="new-goal"
          className="input"
          aria-label="New goal"
          placeholder="e.g. Finish the persistence ADR"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-compact">Add goal</button>
      </form>

      {goals.length === 0 ? (
        <p className="empty-state">No goals yet. Add what you want to get done this session.</p>
      ) : (
        <ul className="goal-list">
          {goals.map((goal) => (
            <li key={goal.id} className={`goal-item ${goal.done ? 'done' : ''}`}>
              <input id={`goal-${goal.id}`} type="checkbox" checked={goal.done} onChange={() => onToggle(goal.id)} />
              <label htmlFor={`goal-${goal.id}`}>{goal.text}</label>
              <button className="icon-button" aria-label={`Remove ${goal.text}`} onClick={() => onRemove(goal.id)}>
                &#10005;
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasDone && (
        <button className="btn btn-secondary btn-compact" onClick={onClearDone}>Clear finished goals</button>
      )}
    </div>
  );
};
