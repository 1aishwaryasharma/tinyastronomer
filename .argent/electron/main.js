const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HEIGHT = 800;
const SITE_URL = process.env.SITE_URL || 'http://127.0.0.1:8765/';
const WIDTH = 1280;
const useSwiftShader = process.env.ARGENT_ELECTRON_SWIFTSHADER === '1'
  || process.platform === 'linux';

// Must run before ready. A prior disable-gpu launch poisons Chromium's GPUCache
// under userData, so later boots keep failing WebGL even after that flag is gone.
const userData = path.join(os.tmpdir(), 'tinyastronomer-argent-electron');
fs.rmSync(path.join(userData, 'GPUCache'), { force: true, recursive: true });
app.setPath('userData', userData);

app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
if (useSwiftShader) {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('use-gl', 'angle');
}

const createWindow = () => {
  const win = new BrowserWindow({
    backgroundColor: '#050810',
    height: HEIGHT,
    show: true,
    useContentSize: true,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'argent-qa',
      webgl: true,
    },
    width: WIDTH,
  });
  win.setMenuBarVisibility(false);
  win.loadURL(SITE_URL);
};

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
