// Electron renderer script for FocusSentinel

interface Window {
  api: {
    onTelemetry: (callback: (data: any) => void) => () => void;
    sendCommand: (action: string, data?: Record<string, any>) => void;
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const btnPing = document.getElementById('btn-ping');
  const btnFocus = document.getElementById('btn-focus');
  const btnBreak = document.getElementById('btn-break');
  const btnClear = document.getElementById('btn-clear');
  const statusBadge = document.getElementById('status-badge');

  const winMin = document.getElementById('win-min');
  const winMax = document.getElementById('win-max');
  const winClose = document.getElementById('win-close');
  
  const valYaw = document.getElementById('val-yaw');
  const valPitch = document.getElementById('val-pitch');
  const valPhone = document.getElementById('val-phone');
  const logBody = document.getElementById('log-body');

  function appendLog(text: string, type: 'telemetry' | 'system' | 'cmd' | 'pong' = 'telemetry') {
    if (!logBody) return;
    const logLine = document.createElement('div');
    logLine.classList.add('log-line');
    
    if (type === 'system') logLine.classList.add('system-msg');
    if (type === 'cmd') logLine.classList.add('cmd-sent');
    if (type === 'pong') logLine.classList.add('pong-msg');

    logLine.textContent = text;
    logBody.appendChild(logLine);
    
    // Auto scroll to bottom
    logBody.scrollTop = logBody.scrollHeight;
  }

  // Bind Control Board buttons
  btnPing?.addEventListener('click', () => {
    appendLog('[UI] Sending Command: ping', 'cmd');
    window.api.sendCommand('ping');
  });

  btnFocus?.addEventListener('click', () => {
    appendLog('[UI] Sending Command: change_state -> FOCUS', 'cmd');
    window.api.sendCommand('change_state', { state: 'FOCUS' });
  });

  btnBreak?.addEventListener('click', () => {
    appendLog('[UI] Sending Command: change_state -> BREAK', 'cmd');
    window.api.sendCommand('change_state', { state: 'BREAK' });
  });

  btnClear?.addEventListener('click', () => {
    if (logBody) logBody.innerHTML = '';
  });

  // Bind custom Window Controls
  winMin?.addEventListener('click', () => {
    window.api.minimize();
  });

  winMax?.addEventListener('click', () => {
    window.api.maximize();
  });

  winClose?.addEventListener('click', () => {
    window.api.close();
  });

  // Start listening to the Python telemetry stream
  let connected = false;
  window.api.onTelemetry((payload) => {
    if (!connected && statusBadge) {
      connected = true;
      statusBadge.classList.add('connected');
      statusBadge.innerHTML = '<span class="pulse-dot"></span> Pipeline Stream Active';
      appendLog('[Bridge] Connected to Python CV stream!', 'system');
    }

    // Handle telemetry heartbeat
    if (payload.type === 'telemetry' && payload.data) {
      if (valYaw) valYaw.textContent = `${payload.data.yaw.toFixed(1)}°`;
      if (valPitch) valPitch.textContent = `${payload.data.pitch.toFixed(1)}°`;
      
      if (valPhone) {
        if (payload.data.phone_detected) {
          valPhone.textContent = 'Phone Detected!';
          valPhone.className = 'metric-status alert-active';
        } else {
          valPhone.textContent = 'Distraction Clear';
          valPhone.className = 'metric-status alert-inactive';
        }
      }
      
      appendLog(`[Telemetry] ${JSON.stringify(payload)}`);
    } else if (payload.type === 'pong') {
      appendLog('[Python Response] PONG received!', 'pong');
    } else {
      appendLog(`[Response] ${JSON.stringify(payload)}`);
    }
  });
});
