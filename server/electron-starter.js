const electron = require('electron');
const fs = require('fs');
const Store = require('electron-store');
// 设置服务端端口，避免端口冲突
process.env.SERVER_PORT = 3080;
// 启动服务端
require('./dist/src/app');

// 用于控制应用生命周期的模块
const app = electron.app;
// 用于创建原生浏览器窗口的模块
const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const url = require('url');

// 初始化窗口设置的存储
const store = new Store();

// 保持窗口对象的全局引用，否则当 JavaScript 对象被垃圾回收时窗口会被自动关闭
let mainWindow;

function createWindow() {
  // 读取已保存的窗口尺寸，没有则使用默认值
  const windowState = store.get('windowState', {
    width: 1200,
    height: 800
  });

  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    ...windowState,
    webPreferences: {
      // devTools: true,
      webSecurity: false,
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });

  // 窗口尺寸变化时保存
  mainWindow.on('resize', () => {
    const { width, height } = mainWindow.getBounds();
    store.set('windowState', { width, height });
  });

  // 窗口移动时保存位置
  mainWindow.on('move', () => {
    const { x, y } = mainWindow.getBounds();
    store.set('windowState', { ...store.get('windowState'), x, y });
  });

  // 把 IS_ELECTRON 替换为 yes，因为 axios 使用相对 URL
  const envConfig = path.join(__dirname, './build/env-config.js');
  fs.readFile(envConfig, 'utf8', function (err, files) {
    const result = files.replace(/{{IS_ELECTRON}}/g, 'yes');
    fs.writeFile(envConfig, result, 'utf8', function (err) {
      if (err) {
        console.log(err);
      }
    });
  });

  // 获取系统语言
  mainWindow.webContents.executeJavaScript(`
   localStorage.setItem('lang', '${app.getLocale()}');
  `);
  // mainWindow.maximize();
  // mainWindow.show();
  // 并加载应用的 index.html
  const startUrl =
    process.env.ELECTRON_START_URL ||
    url.format({
      pathname: path.join(__dirname, './build/index.html'),
      protocol: 'file:',
      slashes: true,
    });
  mainWindow.loadURL(startUrl);
  // mainWindow.loadURL('http://127.0.0.1:3000');
  mainWindow.focus();

  // 窗口关闭时触发
  mainWindow.on('closed', function () {
    // 解除窗口对象的引用。如果应用支持多窗口，通常会把窗口保存在
    // 数组中，这时应该删除对应的元素。
    mainWindow = null;
  });
}

// Electron 初始化完成、可以创建浏览器窗口时会调用该方法。
// 部分 API 只能在此事件触发后使用。
app.on('ready', createWindow);

// 所有窗口关闭时退出应用。
app.on('window-all-closed', function () {
  // 在 macOS 上，应用及其菜单栏通常会保持活跃，直到用户显式按下 Cmd + Q 退出
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // 在 macOS 上，当点击 Dock 图标且没有其他窗口打开时，通常会重新创建窗口
  if (mainWindow === null) {
    createWindow();
  }
});
