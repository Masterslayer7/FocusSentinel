import React from 'react';
import type { FocusStatus, SamplerError } from '../services/focus/types';

interface FocusStatusPanelProps {
  status: FocusStatus;
  error: SamplerError | null;
  onReset: () => void;
}

// Shows the app name only. FocusStatus carries no window title by design, so
// nothing here can leak one.
export const FocusStatusPanel: React.FC<FocusStatusPanelProps> = ({ status, error, onReset }) => {
  return (
    <section className="card">
      <div className="card-header">
        <h2>Focus</h2>
        <span className="tag tag-live">Live</span>
      </div>
      <p className="section-desc">Watches which window has focus, every 2 seconds. Nothing is saved.</p>

      {error && (
        <div className="sampler-error" role="alert">
          Window tracking is not working ({error.reason}): {error.message}
        </div>
      )}

      <div className="telemetry-grid">
        <div className="metric">
          <span className="metric-label">State</span>
          <span
            className={`metric-status ${status.isDistracted ? 'alert-active' : 'alert-inactive'}`}
            data-testid="focus-state"
          >
            {status.isDistracted ? 'Distracted' : 'Focused'}
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Distracted for</span>
          <span className="metric-value" data-testid="focus-duration">{status.distractionDuration}s</span>
        </div>
        <div className="metric">
          <span className="metric-label">Violations</span>
          <span className="metric-value" data-testid="focus-violations">{status.violationCount}</span>
        </div>
      </div>

      <div className="metric focus-current-app">
        <span className="metric-label">Current app</span>
        <span className="metric-value" data-testid="focus-app">{status.currentApp || '—'}</span>
      </div>

      <button className="btn btn-secondary" onClick={onReset}>Reset session</button>
    </section>
  );
};
