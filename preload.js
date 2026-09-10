const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getTileServerInfo: () => ipcRenderer.invoke('get-tile-server-info'),
  startPyramidDownload: (params) => ipcRenderer.invoke('start-pyramid-download', params),
  cancelPyramidDownload: () => ipcRenderer.invoke('cancel-pyramid-download'),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, data) => callback(data)),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  startAppUpdate: (params) => ipcRenderer.invoke('start-app-update', params),
  onUpdateProgress: (callback) => ipcRenderer.on('update-download-progress', (event, data) => callback(data)),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getOfflineManifest: () => ipcRenderer.invoke('get-offline-manifest'),
  saveOfflineManifest: (data) => ipcRenderer.invoke('save-offline-manifest', data),
  installAppUpdate: () => ipcRenderer.invoke('install-app-update'),
  getCloudSyncConfig: () => ipcRenderer.invoke('get-cloud-sync-config'),
  saveCloudSyncConfig: (cfg) => ipcRenderer.invoke('save-cloud-sync-config', cfg),
  uploadCloudSyncData: (payload) => ipcRenderer.invoke('upload-cloud-sync-data', payload),
  pullCloudSyncData: (payload) => ipcRenderer.invoke('pull-cloud-sync-data', payload),
  rescanOfflineTiles: () => ipcRenderer.invoke('rescan-offline-tiles'),
  setMapInteractionState: (active) => ipcRenderer.send('map-interaction-state', Boolean(active)),
  onOfflineScanProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('offline-scan-progress', listener);
    return () => ipcRenderer.removeListener('offline-scan-progress', listener);
  },
  onOfflineInventoryUpdated: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('offline-inventory-updated', listener);
    return () => ipcRenderer.removeListener('offline-inventory-updated', listener);
  },
  checkTileUpdates: () => ipcRenderer.invoke('check-tile-updates'),
  searchLocation: (query) => ipcRenderer.invoke('search-location', query),
  onPowerStateChange: (callback) => ipcRenderer.on('power-state-change', (event, data) => callback(data)),
  showMapContextMenu: (params) => ipcRenderer.invoke('show-map-context-menu', params),
  saveFileDialog: (params) => ipcRenderer.invoke('save-file-dialog', params),
  openFileDialog: (params) => ipcRenderer.invoke('open-file-dialog', params),
  writeClipboardText: (text) => ipcRenderer.invoke('write-clipboard-text', text)
});
