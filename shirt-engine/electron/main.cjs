const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 650,
    title: 'MD Studios Shirt Mockup Engine',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (!app.isPackaged) {
    win.loadURL('http://127.0.0.1:5173');
  } else {
    win.loadURL(pathToFileURL(path.join(__dirname, '../dist/index.html')).toString());
  }
}
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
