import React from 'react';

interface ControlBoardProps {
  focusMode: boolean;
  onToggleFocus: (checked: boolean) => void;
  onPing: () => void;
  cameraIndex: number;
  availableDevices: MediaDeviceInfo[];
  onCameraChange: (index: number) => void;
  threshold: number;
  onThresholdChange: (val: number) => void;
  model: string;
  onModelChange: (val: string) => void;
  imgsz: number;
  onImgszChange: (val: number) => void;
}

export const ControlBoard: React.FC<ControlBoardProps> = ({
  focusMode,
  onToggleFocus,
  onPing,
  cameraIndex,
  availableDevices,
  onCameraChange,
  threshold,
  onThresholdChange,
  model,
  onModelChange,
  imgsz,
  onImgszChange,
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

        <div className="vision-settings-row">
          <div className="slider-container">
            <div className="slider-header">
              <label htmlFor="threshold-slider" className="slider-label">Detection Confidence</label>
              <span className="slider-value">{(threshold * 100).toFixed(0)}%</span>
            </div>
            <input
              id="threshold-slider"
              type="range"
              min="0.20"
              max="0.90"
              step="0.05"
              value={threshold}
              onChange={(e) => onThresholdChange(Number(e.target.value))}
              className="settings-slider"
            />
          </div>

          <div className="model-select-container">
            <label htmlFor="model-select" className="model-select-label">Vision Model Weights</label>
            <select
              id="model-select"
              className="model-select-dropdown"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
            >
              <option value="yolo26n.pt">YOLO Nano (Low CPU)</option>
              <option value="yolo26s.pt">YOLO Small (Medium CPU)</option>
              <option value="yolo11m.pt">YOLO Medium (High Accuracy)</option>
              <option value="yolo11l.pt">YOLO Large (Very High Accuracy)</option>
              <option value="yolo11x.pt">YOLO X-Large (Max Accuracy)</option>
            </select>
          </div>

          <div className="model-select-container">
            <label htmlFor="imgsz-select" className="model-select-label">Detection Range (Resolution)</label>
            <select
              id="imgsz-select"
              className="model-select-dropdown"
              value={imgsz}
              onChange={(e) => onImgszChange(Number(e.target.value))}
            >
              <option value={640}>Standard (640px)</option>
              <option value={960}>Extended (960px)</option>
              <option value={1280}>Maximum (1280px)</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  );
};
