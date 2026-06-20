const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rcloneSyncer', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  saveProfile: (profile) => ipcRenderer.invoke('profile:save', profile),
  deleteProfile: (id) => ipcRenderer.invoke('profile:delete', id),
  chooseFolder: () => ipcRenderer.invoke('dialog:choose-folder'),
  runSync: (id) => ipcRenderer.invoke('sync:run', id),
  cancelSync: (id) => ipcRenderer.invoke('sync:cancel', id),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('launch:set', enabled),
  createRemote: (remote) => ipcRenderer.invoke('remote:create', remote),
  authorizeRemote: (payload) => ipcRenderer.invoke('remote:authorize', payload),
  testRemote: (target) => ipcRenderer.invoke('remote:test', target),
  deleteRemote: (name) => ipcRenderer.invoke('remote:delete', name),
  aboutRemote: (name) => ipcRenderer.invoke('remote:about', name),
  listRemote: (remotePath) => ipcRenderer.invoke('remote:list', remotePath),
  mkdirRemote: (remotePath) => ipcRenderer.invoke('remote:mkdir', remotePath),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
  openAbout: () => ipcRenderer.invoke('about:open'),
  onSyncProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('sync:progress', handler);
    return () => ipcRenderer.removeListener('sync:progress', handler);
  },
  onStateRefresh: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('state:refresh', handler);
    return () => ipcRenderer.removeListener('state:refresh', handler);
  },
});
