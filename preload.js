// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ghostshell', {
  newTab: (url) => ipcRenderer.invoke('new-tab', url),
  closeTab: (index) => ipcRenderer.invoke('close-tab', index),
  switchTab: (index) => ipcRenderer.invoke('switch-tab', index),
  reorderTabs: (from, to) => ipcRenderer.invoke('reorder-tabs', from, to),
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  addBookmark: (data) => ipcRenderer.invoke('add-bookmark', data),
  getHistory: () => ipcRenderer.invoke('get-history'),
  contextMenu: (tabIndex) => ipcRenderer.invoke('context-menu', tabIndex)
});
