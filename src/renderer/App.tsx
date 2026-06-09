import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ControlBoard } from './components/ControlBoard';
import { TelemetryDisplay } from './components/TelemetryDisplay';

interface Window {
  api: {
    onTelemetry: (callback: (data: any) => void) => () => void;
    sendCommand: (action: string, data?: Record<string, any>) => void;
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
}

declare const window: Window;

export default function App() {
  const [connected, setConnected] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'connecting' | 'active' | 'released'>('connecting');
  const [phoneDetected, setPhoneDetected] = useState(false);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);

  useEffect(() => {
    appendSystemLog('System initialized. Waiting for pipeline stream...');

    // Subscribe to IPC telemetry stream broadcast by the main process
    const unsubscribe = window.api.onTelemetry((payload) => {
      setConnected(true);

      // Handle telemetry heartbeats
      if (payload.type === 'telemetry' && payload.data) {
        setPhoneDetected(payload.data.phone_detected);
        appendTelemetryLog(payload);
      } 
      // Handle camera status messages
      else if (payload.type === 'status' && payload.camera) {
        if (payload.camera === 'opened') {
          setCameraStatus('active');
          appendSystemLog('Camera Initialized and Active');
        } else if (payload.camera === 'released') {
          setCameraStatus('released');
          appendSystemLog('Camera Released successfully');
        }
      } 
      // Handle pong command responses
      else if (payload.type === 'pong') {
        appendLog('PONG received!', 'pong-msg');
      } 
      // Handle generic responses
      else {
        appendLog(JSON.stringify(payload));
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const appendLog = (message: string, typeClass = '') => {
    setStreamLogs((prev) => [...prev, `${typeClass}|${message}`]);
  };

  const appendSystemLog = (message: string) => {
    appendLog(`[Bridge] ${message}`, 'system-msg');
  };

  const appendTelemetryLog = (payload: any) => {
    appendLog(`[Telemetry] ${JSON.stringify(payload)}`);
  };

  const handlePing = () => {
    appendLog('[UI] Sending Command: ping', 'cmd-sent');
    window.api.sendCommand('ping');
  };

  const handleToggleFocus = (checked: boolean) => {
    setFocusMode(checked);
    
    if (checked) {
      appendSystemLog('Activating Focus Mode (Starting Camera)...');
      window.api.sendCommand('change_state', { state: 'FOCUS' });
    } else {
      appendSystemLog('Deactivating Focus Mode (Releasing Camera)...');
      window.api.sendCommand('change_state', { state: 'BREAK' });
      setPhoneDetected(false); // Reset warning indicators
    }
  };

  const handleClearLogs = () => {
    setStreamLogs([]);
  };

  return (
    <div className="app-container">
      <Header
        cameraStatus={cameraStatus}
        onMinimize={() => window.api.minimize()}
        onMaximize={() => window.api.maximize()}
        onClose={() => window.api.close()}
      />

      <main className="app-main">
        <ControlBoard
          focusMode={focusMode}
          onToggleFocus={handleToggleFocus}
          onPing={handlePing}
        />

        <TelemetryDisplay
          phoneDetected={phoneDetected}
          streamLogs={streamLogs}
          onClearLogs={handleClearLogs}
        />
      </main>
    </div>
  );
}
