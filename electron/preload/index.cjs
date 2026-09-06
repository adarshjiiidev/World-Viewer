'use strict';

/**
 * WORLD VIEWER — Electron Preload (contextBridge)
 *
 * Exposes a minimal, audited surface to the renderer.
 * No Node.js APIs are exposed directly — only specific
 * IPC invocations through named channels.
 */

const { contextBridge, ipcRenderer } = require('electron');

// ── worldViewerAPI — secure bridge to Electron main ─────────────────────────
contextBridge.exposeInMainWorld('worldViewerAPI', {
  // Clipboard
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  readFromClipboard: () => ipcRenderer.invoke('clipboard:read'),

  // Desktop notifications
  sendNotification: (title, body, urgency = 'normal') =>
    ipcRenderer.invoke('notification:send', { title, body, urgency }),

  // System information
  getSystemInfo: () => ipcRenderer.invoke('system:info'),

  // Open URLs in system browser
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // App version
  appVersion: () => ipcRenderer.invoke('app:version'),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowFullscreen: () => ipcRenderer.invoke('window:fullscreen'),
  windowAlwaysOnTop: (val) => ipcRenderer.invoke('window:alwaysOnTop', val),
  windowHideControls: () => ipcRenderer.invoke('window:hideControls'),
  windowShowControls: () => ipcRenderer.invoke('window:showControls'),

  // Secure credential storage (uses safeStorage with graceful fallback)
  setCredential: (key, value) => ipcRenderer.invoke('credentials:set', key, value),
  getCredential: (key) => ipcRenderer.invoke('credentials:get', key),

  // Environment detection
  isElectron: true,
  platform: process.platform,
});

// ── Signal to renderer that we're running as Electron ───────────────────────
// The renderer can check window.worldViewerAPI?.isElectron === true
// to enable Electron-specific features (native notifications, clipboard, etc.)
