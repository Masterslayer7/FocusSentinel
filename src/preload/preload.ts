import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  /**
   * Listen for real-time telemetry updates broadcast from the Python child process.
   */
  onTelemetry: (callback: (data: any) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('python-telemetry', subscription);
    
    // Return unsubscribe function for clean cleanup in UI components
    return () => {
      ipcRenderer.removeListener('python-telemetry', subscription);
    };
  },

  /**
   * Send a control command from the UI down to the Python subprocess.
   */
  sendCommand: (action: string, data: Record<string, any> = {}) => {
    ipcRenderer.send('send-to-python', { action, data });
  },

  /**
   * Custom window operation commands
   */
  minimize: () => {
    ipcRenderer.send('window-minimize');
  },
  maximize: () => {
    ipcRenderer.send('window-maximize');
  },
  close: () => {
    ipcRenderer.send('window-close');
  }
});
