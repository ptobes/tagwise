const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tagwise', {
  openDirectory:    () => ipcRenderer.invoke('dialog:openDirectory'),
  runScript:        (script, args)        => ipcRenderer.invoke('script:run',           { script, args }),
  sendInput:        (id, input)           => ipcRenderer.invoke('script:stdin',         { id, input }),
  killScript:       (id)                  => ipcRenderer.invoke('script:kill',          { id }),
  onOutput: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('script:output', handler)
    return () => ipcRenderer.removeListener('script:output', handler)
  },
  readTags:         (filePath)            => ipcRenderer.invoke('file:readTags',        { filePath }),
  readTagsBatch:    (filePaths)           => ipcRenderer.invoke('file:readTagsBatch',   { filePaths }),
  writeTags:        (filePath, tags)      => ipcRenderer.invoke('file:writeTags',       { filePath, tags }),
  readCoverArt:     (filePath)            => ipcRenderer.invoke('file:readCoverArt',    { filePath }),
  writeCoverArt:    (filePath, dataUrl)   => ipcRenderer.invoke('file:writeCoverArt',   { filePath, dataUrl }),
})
