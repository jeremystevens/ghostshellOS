// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ghostshell', {
  newTab: (url) => ipcRenderer.invoke('new-tab', url),
  closeTab: (index) => ipcRenderer.invoke('close-tab', index),
  switchTab: (index) => ipcRenderer.invoke('switch-tab', index),
  updateContentWindow: (index) => ipcRenderer.invoke('update-content-window', index),
  reorderTabs: (from, to) => ipcRenderer.invoke('reorder-tabs', from, to),
  navigateCurrentTab: (url) => ipcRenderer.invoke('navigate-current-tab', url),
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  addBookmark: (data) => ipcRenderer.invoke('add-bookmark', data),
  getHistory: () => ipcRenderer.invoke('get-history'),
  contextMenu: (index) => ipcRenderer.invoke('context-menu', index),
  getTabUrl: (index) => ipcRenderer.invoke('get-tab-url', index),
  
  // Set up listener for URL changes
  onUrlChanged: (callback) => {
    // Remove any existing listeners
    ipcRenderer.removeAllListeners('url-changed');
    // Add new listener
    ipcRenderer.on('url-changed', (_, index, url) => {
      callback(index, url);
    });
  }
});