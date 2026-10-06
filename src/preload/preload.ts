import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { SamplerEvent } from '../shared/types';

// Duplicated in main.ts on purpose: a sandboxed preload can require 'electron'
// but not local modules, so this cannot be a runtime import from src/shared/.
const FOCUS_EVENT_CHANNEL = 'focus:event';

contextBridge.exposeInMainWorld('api', {
  /**
   * Subscribe to foreground-window samples from the main process.
   * Returns an unsubscribe function for clean cleanup in UI components.
   */
  onFocusEvent: (callback: (event: SamplerEvent) => void): (() => void) => {
    const subscription = (_event: IpcRendererEvent, value: SamplerEvent) => callback(value);
    ipcRenderer.on(FOCUS_EVENT_CHANNEL, subscription);

    return () => {
      ipcRenderer.removeListener(FOCUS_EVENT_CHANNEL, subscription);
    };
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
