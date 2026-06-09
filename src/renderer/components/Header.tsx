import React from 'react';

interface HeaderProps {
  cameraStatus: 'connecting' | 'active' | 'released';
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cameraStatus,
  onMinimize,
  onClose,
  onMaximize,
}) => {
  const renderStatusBadge = () => {
    if (cameraStatus === 'active') {
      return (
        <div className="status-badge connected" id="status-badge">
          <span className="pulse-dot"></span> Pipeline Stream Active
        </div>
      );
    } else if (cameraStatus === 'released') {
      return (
        <div className="status-badge" id="status-badge">
          <span className="pulse-dot" style={{ backgroundColor: 'var(--color-warning)', boxShadow: '0 0 10px var(--color-warning)' }}></span> Camera Released (Low Power)
        </div>
      );
    } else {
      return (
        <div className="status-badge" id="status-badge">
          <span className="pulse-dot" style={{ backgroundColor: 'var(--color-warning)', boxShadow: '0 0 10px var(--color-warning)' }}></span> Pipeline Connecting...
        </div>
      );
    }
  };

  return (
    <header className="app-header">
      <div className="logo">
        <span className="logo-icon">👁️</span>
        <span className="logo-text">Focus<span className="logo-accent">Sentinel</span></span>
      </div>
      <div className="header-right">
        {renderStatusBadge()}
        <div className="window-controls">
          <button id="win-min" className="win-btn" title="Minimize" onClick={onMinimize}>&#8212;</button>
          <button id="win-max" className="win-btn" title="Maximize" onClick={onMaximize}>&#9633;</button>
          <button id="win-close" className="win-btn win-btn-close" title="Close" onClick={onClose}>&#10005;</button>
        </div>
      </div>
    </header>
  );
};
