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
  const [cameraIndex, setCameraIndex] = useState(0);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);

  // Query and prompt camera devices permission on mount
  useEffect(() => {
    const initCameraAccess = async () => {
      try {
        // Trigger OS permission dialog via WebRTC getUserMedia, then close immediately
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        appendSystemLog(`Camera permission check: ${err}`);
      }

      // Enumerate available video sources
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputDevices = devices.filter(d => d.kind === 'videoinput');
        setAvailableDevices(videoInputDevices);
        appendSystemLog(`Discovered ${videoInputDevices.length} camera source(s).`);
      } catch (err) {
        appendSystemLog(`Error enumerating camera devices: ${err}`);
      }
    };

    initCameraAccess();
  }, []);

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

  const handleCameraChange = (index: number) => {
    setCameraIndex(index);
    appendSystemLog(`Switching to camera source index ${index}...`);
    window.api.sendCommand('change_camera', { index });
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
          cameraIndex={cameraIndex}
          availableDevices={availableDevices}
          onCameraChange={handleCameraChange}
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
