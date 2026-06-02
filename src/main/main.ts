import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { PythonBridge } from './pythonBridge';

let mainWindow: BrowserWindow | null = null;
let pythonBridge: PythonBridge | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

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
