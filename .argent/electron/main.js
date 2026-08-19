const { app, BrowserWindow } = require('electron');
const os = require('os');
const path = require('path');

const HEIGHT = 800;
const SITE_URL = process.env.SITE_URL || 'http://127.0.0.1:8765/';
const WIDTH = 1280;
const useSwiftShader = process.env.ARGENT_ELECTRON_SWIFTSHADER === '1'
  || process.platform === 'linux';

// Must run before ready. GPU and SwiftShader need separate userData so a
// software-GL run cannot poison Metal (and the reverse).
app.setPath(
  'userData',
  path.join(
    os.tmpdir(),
    useSwiftShader
      ? 'tinyastronomer-argent-electron-swiftshader'
      : 'tinyastronomer-argent-electron-gpu',
  ),
);

app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
if (useSwiftShader) {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('use-gl', 'angle');
}

const createWindow = () => {
  const win = new BrowserWindow({
    autoHideMenuBar: true,
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
