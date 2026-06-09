import React from 'react';

interface ControlBoardProps {
  focusMode: boolean;
  onToggleFocus: (checked: boolean) => void;
  onPing: () => void;
  cameraIndex: number;
  availableDevices: MediaDeviceInfo[];
  onCameraChange: (index: number) => void;
}

export const ControlBoard: React.FC<ControlBoardProps> = ({
  focusMode,
  onToggleFocus,
  onPing,
  cameraIndex,
  availableDevices,
  onCameraChange,
}) => {
  return (
    <section className="card control-card">
      <div className="card-header">
        <h2>IPC Control Board</h2>
        <span className="tag">Standard Input</span>
      </div>
      <p className="section-desc">Transmit control payloads to the Python child process stdio stream.</p>
      <div className="button-group">
        <button id="btn-ping" className="btn btn-primary" onClick={onPing}>
          <span className="btn-icon">⚡</span> Send Ping Command
        </button>
        
        <div className="switch-container">
          <div className="switch-text">
            <span className="switch-title">Focus Mode</span>
            <span className={`switch-status ${focusMode ? 'active' : ''}`} id="switch-status">
              {focusMode ? 'Active (Camera On)' : 'Inactive (Camera Off)'}
            </span>
          </div>
          <label className="switch">
            <input 
              type="checkbox" 
              id="focus-switch" 
              checked={focusMode} 
              onChange={(e) => onToggleFocus(e.target.checked)} 
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="camera-select-container">
          <label htmlFor="camera-select" className="camera-select-label">Active Camera Source</label>
          <select
            id="camera-select"
            className="camera-select-dropdown"
            value={cameraIndex}
            onChange={(e) => onCameraChange(Number(e.target.value))}
          >
            {availableDevices.length > 0 ? (
              availableDevices.map((device, idx) => (
                <option key={device.deviceId || idx} value={idx}>
                  {device.label || `Camera ${idx}`}
                </option>
              ))
            ) : (
              <option value={0}>Camera 0 (Default)</option>
            )}
          </select>
        </div>
      </div>
    </section>
  );
};
