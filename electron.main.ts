import { app, BrowserWindow, shell, ipcMain, session } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

// Remote live URL (auto-updates when updated in AI Studio / Cloud Run)
const LIVE_APP_URL = process.env.AUVIX_APP_URL || 'https://ais-dev-35pdzcucwb65atyfse6vmp-409231544232.us-east1.run.app';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'Auvix',
    backgroundColor: '#0C0D10',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0E0F12',
      symbolColor: '#F27D26',
      height: 36,
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Handle camera, microphone, and screen share permissions for WebRTC
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'notifications', 'display-capture'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Open external links in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Load the remote live app (so updates deployed to AI Studio are instantly received)
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadURL(LIVE_APP_URL).catch(() => {
      // Fallback to local build if offline or remote unreachable
      const indexPath = path.join(__dirname, '../dist/index.html');
      mainWindow?.loadFile(indexPath);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

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
