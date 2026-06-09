import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { PythonBridge } from './pythonBridge';

// Configure GPU switches to allow hardware acceleration to function inside virtualized/WSL environments without context failures
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

const isDev = process.env.ELECTRON_IS_DEV === '1';
let mainWindow: BrowserWindow | null = null;
let pythonBridge: PythonBridge | null = null;

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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Initialize and start the Python CV standard I/O bridge
  pythonBridge = new PythonBridge();
  
  pythonBridge.on('message', (payload) => {
    console.log('[Electron Main] Stdio message parsed:', payload);
    
    // Relay the telemetry down to the renderer UI
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('python-telemetry', payload);
    }
  });

  pythonBridge.start();

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

  // IPC listener for renderer commands
  ipcMain.on('send-to-python', (_event, command) => {
    if (pythonBridge) {
      pythonBridge.sendCommand(command.action, command.data || {});
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Ensure the child process is torn down when quitting the app
  if (pythonBridge) {
    pythonBridge.stop();
  }
});
