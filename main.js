// main.js
const { app, BrowserWindow, BrowserView, ipcMain, Menu, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tabs = [];
let currentTabIndex = -1;
let bookmarks = [];
let history = [];

const dataDir = path.join(__dirname, 'data');
const bookmarksPath = path.join(dataDir, 'bookmarks.json');
const historyPath = path.join(dataDir, 'history.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (fs.existsSync(bookmarksPath)) {
  bookmarks = JSON.parse(fs.readFileSync(bookmarksPath));
} else {
  bookmarks = [];
}
if (fs.existsSync(historyPath)) {
  history = JSON.parse(fs.readFileSync(historyPath));
} else {
  history = [];
}

function saveBookmarks() {
  try {
    fs.writeFileSync(bookmarksPath, JSON.stringify(bookmarks, null, 2));
    console.log("Bookmarks saved to:", bookmarksPath);
  } catch (err) {
    console.error("Failed to save bookmarks:", err);
  }
}

function saveHistory() {
  try {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    console.log("History saved to:", historyPath);
  } catch (err) {
    console.error("Failed to save history:", err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "GhostShell",
  });
  mainWindow.loadFile('index.html');
}

function createTab(url) {
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'spoof/spoof.js'),
      contextIsolation: false,
    },
  });

  const index = tabs.length;
  tabs.push({ view, url });

  view.webContents.loadURL(url);
  view.webContents.removeAllListeners('did-navigate');
  view.webContents.on('did-navigate', (_, newUrl) => {
    tabs[index].url = newUrl;
    history.push({ title: newUrl, url: newUrl, date: new Date().toISOString() });
    saveHistory();
  });

  switchTab(index);
}

function switchTab(index) {
  if (!tabs[index]) return;

  if (tabs[currentTabIndex]) {
    mainWindow.removeBrowserView(tabs[currentTabIndex].view);
  }

  currentTabIndex = index;
  const view = tabs[index].view;
  mainWindow.setBrowserView(view);
  const [width, height] = mainWindow.getContentSize();
  view.setBounds({ x: 0, y: 100, width, height: height - 100 });
  view.setAutoResize({ width: true, height: true });
}

function closeTab(index) {
  if (tabs[index] && typeof tabs[index].view.destroy === 'function') {
    mainWindow.removeBrowserView(tabs[index].view);
    tabs[index].view.destroy();
    tabs.splice(index, 1);
    if (tabs.length > 0) {
      switchTab(Math.max(0, index - 1));
    } else {
      currentTabIndex = -1;
    }
  } else {
    console.warn('Invalid tab on close:', index, tabs[index]);
  }
}

function reorderTabs(from, to) {
  const [moved] = tabs.splice(from, 1);
  tabs.splice(to, 0, moved);
  switchTab(to);
}

app.whenReady().then(() => {
  protocol.registerFileProtocol('ghostshell', (request, callback) => {
    let filePath = request.url.replace('ghostshell://', '');
    if (filePath === 'start') filePath = 'start.html';
    const resolvedPath = path.join(__dirname, filePath);
    callback({ path: resolvedPath });
  });

  createWindow();
});

app.on('window-all-closed', () => app.quit());

ipcMain.handle('new-tab', (_, url) => {
  if (currentTabIndex !== -1 && tabs[currentTabIndex]) {
    const view = tabs[currentTabIndex].view;
    view.webContents.loadURL(url);
    tabs[currentTabIndex].url = url;
  } else {
    createTab(url);
  }
});

ipcMain.handle('close-tab', (_, index) => closeTab(index));
ipcMain.handle('switch-tab', (_, index) => switchTab(index));
ipcMain.handle('reorder-tabs', (_, from, to) => reorderTabs(from, to));
ipcMain.handle('get-bookmarks', () => bookmarks);
ipcMain.handle('add-bookmark', (_, data) => {
  if (!bookmarks.find(b => b.url === data.url)) {
    bookmarks.push(data);
    saveBookmarks();
  }
});
ipcMain.handle('get-history', () => history);
ipcMain.handle('context-menu', (_, tabIndex) => {
  const template = [
    { label: 'Close Tab', click: () => closeTab(tabIndex) },
    { label: 'Reload Tab', click: () => tabs[tabIndex]?.view.webContents.reload() },
  ];
  const menu = Menu.buildFromTemplate(template);
  menu.popup();
});
