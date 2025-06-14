const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  createSession: (data) => ipcRenderer.invoke('create-session', data),
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  sendMessage: (data) => ipcRenderer.invoke('send-message', data),
  logoutSession: (sessionId) => ipcRenderer.invoke('logout-session', sessionId),
  importContacts: () => ipcRenderer.invoke('import-contacts'),
  blastMessage: (data) => ipcRenderer.invoke('blast-message', data),
  checkSessionStatus: (sessionId) => ipcRenderer.invoke('check-session-status', sessionId),
  getManagerStatus: () => ipcRenderer.invoke('get-manager-status'),
  
  onSessionsUpdated: (callback) => {
    ipcRenderer.on('sessions-updated', (event, sessions) => callback(sessions))
  },
  
  onQRCodeUpdated: (callback) => {
    ipcRenderer.on('qr-code-updated', (event, data) => callback(data))
  },
  
  onPairingCodeUpdated: (callback) => {
    ipcRenderer.on('pairing-code-updated', (event, data) => callback(data))
  },
  
  onSessionStatusUpdated: (callback) => {
    ipcRenderer.on('session-status-updated', (event, data) => callback(data))
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  }
})