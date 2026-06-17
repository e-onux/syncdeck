const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rcloneSyncer', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  saveProfile: (profile) => ipcRenderer.invoke('profile:save', profile),
  deleteProfile: (id) => ipcRenderer.invoke('profile:delete', id),
  chooseFolder: () => ipcRenderer.invoke('dialog:choose-folder'),
  runSync: (id) => ipcRenderer.invoke('sync:run', id),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('launch:set', enabled),
  createRemote: (remote) => ipcRenderer.invoke('remote:create', remote),
  listRemote: (remotePath) => ipcRenderer.invoke('remote:list', remotePath),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
  openAbout: () => ipcRenderer.invoke('about:open'),
  onSyncProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('sync:progress', handler);
    return () => ipcRenderer.removeListener('sync:progress', handler);
  },
});
