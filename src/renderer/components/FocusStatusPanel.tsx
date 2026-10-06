import React from 'react';
import type { FocusStatus, SamplerError } from '../services/focus/types';

interface FocusStatusPanelProps {
  status: FocusStatus;
  isTracking: boolean;
  error: SamplerError | null;
  onReset: () => void;
}

// Shows the app name only. FocusStatus carries no window title by design, so
// nothing here can leak one.
export const FocusStatusPanel: React.FC<FocusStatusPanelProps> = ({ status, isTracking, error, onReset }) => {
  const stateLabel = !isTracking ? 'Paused' : status.isDistracted ? 'Distracted' : 'Focused';
  const stateClass = !isTracking ? 'paused' : status.isDistracted ? 'alert-active' : 'alert-inactive';

  return (
    <section className="card">
      <div className="card-header">
        <h2>Focus</h2>
        <span className={`tag ${isTracking ? 'tag-live' : ''}`}>{isTracking ? 'Live' : 'Paused'}</span>
      </div>
      <p className="section-desc">
        {isTracking
          ? 'Checking which window has focus every 2 seconds.'
          : 'Distractions only count during a running focus block. App time is still recorded.'}
      </p>

      {error && (
        <div className="sampler-error" role="alert">
          Window tracking is not working ({error.reason}): {error.message}
        </div>
      )}

      <div className="telemetry-grid">
        <div className="metric">
          <span className="metric-label">State</span>
          <span className={`metric-status ${stateClass}`} data-testid="focus-state">
            {stateLabel}
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
