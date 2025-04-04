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
  
  // Listen for navigation events to update URL
  view.webContents.on('did-navigate', (_, newUrl) => {
    tabs[index].url = newUrl;
    history.push({ title: newUrl, url: newUrl, date: new Date().toISOString() });
    saveHistory();
    
    // Notify renderer of URL change
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('url-changed', index, newUrl);
    }
  });
  
  // Also listen for in-page navigations (hash changes, etc.)
  view.webContents.on('did-navigate-in-page', (_, newUrl) => {
    tabs[index].url = newUrl;
    
    // Notify renderer of URL change
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('url-changed', index, newUrl);
    }
  });

  currentTabIndex = index;
  setActiveTabView(view);
  return index;
}

function setActiveTabView(view) {
  if (!mainWindow) return;
  mainWindow.getBrowserViews().forEach(v => mainWindow.removeBrowserView(v));
  mainWindow.setBrowserView(view);
  const [width, height] = mainWindow.getContentSize();
  view.setBounds({ x: 0, y: 100, width, height: height - 100 });
  view.setAutoResize({ width: true, height: true });
}

function switchTab(index) {
  if (!tabs[index]) return;
  currentTabIndex = index;
  setActiveTabView(tabs[index].view);
  
  // Return the current URL for this tab so renderer can update address bar
  return tabs[index].url;
}

function closeTab(index) {
  if (tabs[index] && typeof tabs[index].view.destroy === 'function') {
    mainWindow.removeBrowserView(tabs[index].view);
    tabs[index].view.destroy();
    tabs.splice(index, 1);

    if (tabs.length === 0) {
      mainWindow.setBrowserView(null);
      currentTabIndex = -1;
    } else {
      const newIndex = Math.max(0, index - 1);
      switchTab(newIndex);
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

function navigateCurrentTab(url) {
  if (currentTabIndex !== -1 && tabs[currentTabIndex]) {
    const view = tabs[currentTabIndex].view;
    view.webContents.loadURL(url);
    tabs[currentTabIndex].url = url;
    
    // Return true to indicate success
    return true;
  }
  return false;
}

function updateContentWindow(index) {
  // This function is called when the renderer asks to update the content window
  if (index !== currentTabIndex && tabs[index]) {
    switchTab(index);
    return true;
  }
  return false;
}

// Handle window resize to properly adjust tab views
function handleResize() {
  if (mainWindow && currentTabIndex !== -1 && tabs[currentTabIndex]) {
    const [width, height] = mainWindow.getContentSize();
    tabs[currentTabIndex].view.setBounds({ 
      x: 0, 
      y: 100, 
      width, 
      height: height - 100 
    });
  }
}

app.whenReady().then(() => {
  protocol.registerFileProtocol('ghostshell', (request, callback) => {
    let filePath = request.url.replace('ghostshell://', '');
    if (filePath === 'start') filePath = 'start.html';
    const resolvedPath = path.join(__dirname, filePath);
    callback({ path: resolvedPath });
  });

  createWindow();
  
  // Listen for window resize events
  if (mainWindow) {
    mainWindow.on('resize', handleResize);
  }
});

app.on('window-all-closed', () => app.quit());

// IPC Handlers
ipcMain.handle('new-tab', (_, url) => {
  const index = createTab(url);
  return index;
});

ipcMain.handle('navigate-current-tab', (_, url) => navigateCurrentTab(url));
ipcMain.handle('close-tab', (_, index) => closeTab(index));

ipcMain.handle('switch-tab', (_, index) => {
  const url = switchTab(index);
  return url;
});

ipcMain.handle('update-content-window', (_, index) => updateContentWindow(index));
ipcMain.handle('reorder-tabs', (_, from, to) => reorderTabs(from, to));
ipcMain.handle('get-bookmarks', () => bookmarks);
ipcMain.handle('add-bookmark', (_, data) => {
  if (!bookmarks.find(b => b.url === data.url)) {
    bookmarks.push(data);
    saveBookmarks();
    return true;
  }
  return false;
});

ipcMain.handle('get-history', () => history);
ipcMain.handle('get-tab-url', (_, index) => {
  if (tabs[index]) {
    return tabs[index].url;
  }
  return null;
});

ipcMain.handle('context-menu', (_, tabIndex) => {
  const template = [
    { label: 'Close Tab', click: () => closeTab(tabIndex) },
    { label: 'Reload Tab', click: () => {
      if (tabs[tabIndex]?.view.webContents) {
        tabs[tabIndex].view.webContents.reload();
      }
    }},
    { type: 'separator' },
    { label: 'View Page Source', click: () => {
      if (tabs[tabIndex]?.view.webContents) {
        const url = tabs[tabIndex].url;
        createTab(`view-source:${url}`);
      }
    }}
  ];
  
  const menu = Menu.buildFromTemplate(template);
  menu.popup();
});