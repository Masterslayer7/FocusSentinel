import React from 'react';

interface HeaderProps {
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onMinimize,
  onClose,
  onMaximize,
}) => {
  return (
    <header className="app-header">
      <div className="logo">
        <span className="logo-icon">👁️</span>
        <span className="logo-text">Focus<span className="logo-accent">Sentinel</span></span>
      </div>
      <div className="header-right">
        <div className="status-badge connected" id="status-badge">
          <span className="pulse-dot"></span> Ready
        </div>
        <div className="window-controls">
          <button id="win-min" className="win-btn" title="Minimize" onClick={onMinimize}>&#8212;</button>
          <button id="win-max" className="win-btn" title="Maximize" onClick={onMaximize}>&#9633;</button>
          <button id="win-close" className="win-btn win-btn-close" title="Close" onClick={onClose}>&#10005;</button>
        </div>
      </div>
    </header>
  );
};
