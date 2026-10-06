import React, { useState } from 'react';
import { formatDuration } from './format';
import { classifyApp } from '../services/focus/FocusTracker';
import type { AppCategory, FocusRules } from '../services/focus/types';
import type { AppUsageEntry } from '../services/session/types';

interface AppsPanelProps {
  usage: Record<string, AppUsageEntry>;
  rules: FocusRules;
  onSetCategory: (appName: string, category: AppCategory) => void;
  onSetBrowserTitles: (titles: string[]) => void;
  onClearUsage: () => void;
}

const CATEGORY_LABELS: Record<AppCategory, string> = {
  focus: 'Focus',
  distraction: 'Distraction',
  browser: 'Browser: judge by tab',
};

export const AppsPanel: React.FC<AppsPanelProps> = ({ usage, rules, onSetCategory, onSetBrowserTitles, onClearUsage }) => {
  const [confirmingClear, setConfirmingClear] = useState(false);
  const apps = Object.entries(usage).sort(([, a], [, b]) => b.seconds - a.seconds);

  return (
    <div className="panel-stack">
      <p className="section-desc">
        Every app you have used, and how long. Choose how each one counts. Browsers are judged by the tab's title
        against the keywords below. Only app names and times are saved, never titles.
      </p>

      {apps.length === 0 ? (
        <p className="empty-state">Apps appear here as you use them. Switch windows for a few seconds and they will show up.</p>
      ) : (
        <div className="table-scroll">
          <table className="apps-table">
            <thead>
              <tr>
                <th scope="col">App</th>
                <th scope="col" className="num">Time</th>
                <th scope="col">Counts as</th>
              </tr>
            </thead>
            <tbody>
              {apps.map(([name, entry]) => {
                const category = classifyApp(name, rules);
                return (
                  <tr key={name} data-testid={`app-row-${name}`}>
                    <td className="app-name">
                      <span className={`category-dot ${category}`} aria-hidden="true" />
                      {name}
                    </td>
                    <td className="num">{formatDuration(entry.seconds)}</td>
                    <td>
                      <select
                        className="select"
                        aria-label={`How ${name} counts`}
                        value={category}
                        onChange={(event) => onSetCategory(name, event.target.value as AppCategory)}
                      >
                        {(Object.keys(CATEGORY_LABELS) as AppCategory[]).map((option) => (
                          <option key={option} value={option}>{CATEGORY_LABELS[option]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor="browser-titles">Allowed tab keywords, one per line</label>
        <textarea
          id="browser-titles"
          className="input textarea"
          rows={4}
          defaultValue={rules.allowedBrowserTitles.join('\n')}
          key={rules.allowedBrowserTitles.join('\n')}
          onBlur={(event) => onSetBrowserTitles(event.target.value.split('\n'))}
        />
        <span className="field-hint">A browser tab counts as focus when its title contains any of these.</span>
      </div>

      {apps.length > 0 && (
        confirmingClear ? (
          <div className="row-buttons">
            <button className="btn btn-danger btn-compact" onClick={() => { onClearUsage(); setConfirmingClear(false); }}>
              Delete usage history
            </button>
            <button className="btn btn-secondary btn-compact" onClick={() => setConfirmingClear(false)}>Keep it</button>
          </div>
        ) : (
          <button className="btn btn-secondary btn-compact" onClick={() => setConfirmingClear(true)}>Clear usage history…</button>
        )
      )}
    </div>
  );
};
