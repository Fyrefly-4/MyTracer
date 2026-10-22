const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('materialShell', {
  read: () => ipcRenderer.invoke('material-shell:read'),
  apply: (settings) => ipcRenderer.invoke('material-shell:apply', settings)
})
