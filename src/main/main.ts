import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { WindowSampler } from './WindowSampler';
import { StateStore } from './StateStore';
import type { PersistedState } from '../shared/types';

// Configure GPU switches to allow hardware acceleration to function inside virtualized/WSL environments or over network shares without context failures
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-unsafe-webgpu');
  app.commandLine.appendSwitch('enable-features', 'Vulkan');
}

const isDev = process.env.ELECTRON_IS_DEV === '1';
let mainWindow: BrowserWindow | null = null;

// Duplicated in preload.ts on purpose — see the note there.
const FOCUS_EVENT_CHANNEL = 'focus:event';
const SAMPLE_INTERVAL_MS = 2000;

// Built once, at module scope: 'activate' can call createWindow() again, and a
// per-window sampler would leave the old interval ticking. The callback reads
// mainWindow when it fires, so it always follows the current window.
const sampler = new WindowSampler(SAMPLE_INTERVAL_MS, (event) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(FOCUS_EVENT_CHANNEL, event);
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173').catch(() => {});
    mainWindow.webContents.on('did-fail-load', () => {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL('http://127.0.0.1:5173').catch(() => {});
        }
      }, 500);
    });
  } else {
    mainWindow.loadFile(path.resolve(__dirname, '../renderer/index.html'));
  }

  // Start only once the renderer can receive: a send that lands before the
  // page has loaded is dropped silently, losing the first sample.
  mainWindow.webContents.once('did-finish-load', () => {
    void sampler.start();
  });

  mainWindow.on('closed', () => {
    sampler.stop();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Saved goals, settings and app usage (ADR-009), in the per-user data folder.
  const store = new StateStore(app.getPath('userData'));
  ipcMain.handle('state:load', () => store.load());
  // The payload is untrusted: StateStore validates it before writing.
  ipcMain.handle('state:save', (_event, state: unknown) => store.save(state as PersistedState));

  createWindow();

  // IPC listeners for custom window controls
  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => sampler.stop());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

