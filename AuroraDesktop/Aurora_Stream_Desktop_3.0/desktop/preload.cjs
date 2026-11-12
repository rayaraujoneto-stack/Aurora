'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('AuroraDesktop', Object.freeze({
  isDesktop: true,
  fetchText: (url) => ipcRenderer.invoke('aurora:fetch-text', String(url)),
  playWithMPV: (url, title) => ipcRenderer.invoke('aurora:play-mpv', { url: String(url), title: String(title || '') }),
  isMPVInstalled: () => ipcRenderer.invoke('aurora:mpv-installed'),
  openMPVInstallPage: () => ipcRenderer.invoke('aurora:open-mpv-page'),
  getAppVersion: () => ipcRenderer.invoke('aurora:app-version'),
  onCommand: (callback) => {
    if (typeof callback !== 'function') return;
    const handler = (_event, command) => callback(command);
    ipcRenderer.on('aurora:command', handler);
    return () => ipcRenderer.removeListener('aurora:command', handler);
  }
}));
