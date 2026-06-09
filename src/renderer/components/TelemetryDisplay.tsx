import React from 'react';
import { LogConsole } from './LogConsole';

interface TelemetryDisplayProps {
  phoneDetected: boolean;
  streamLogs: string[];
  onClearLogs: () => void;
}

export const TelemetryDisplay: React.FC<TelemetryDisplayProps> = ({
  phoneDetected,
  streamLogs,
  onClearLogs,
}) => {
  return (
    <section className="card telemetry-card">
      <div className="card-header">
        <h2>Computer Vision Telemetry</h2>
        <span className="tag tag-live">Standard Output</span>
      </div>
      <p className="section-desc">Real-time frame metrics streaming directly from the Python stdout channel.</p>
      
      <div className="telemetry-display">
        <div className="telemetry-grid">
          <div className="metric">
            <span className="metric-label">Head Yaw</span>
            <span className="metric-value" id="val-yaw">Disabled</span>
          </div>
          <div className="metric">
            <span className="metric-label">Head Pitch</span>
            <span className="metric-value" id="val-pitch">Disabled</span>
          </div>
          <div className="metric">
            <span className={`metric-status ${phoneDetected ? 'alert-active' : 'alert-inactive'}`} id="val-phone">
              {phoneDetected ? 'Phone Detected!' : 'Distraction Clear'}
            </span>
          </div>
        </div>

        <LogConsole streamLogs={streamLogs} onClearLogs={onClearLogs} />
      </div>
    </section>
  );
};
