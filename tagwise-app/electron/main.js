const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const os = require('os')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const SCRIPTS_DIR = path.join(os.homedir(), 'tagwise')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 950,
    minWidth: 960,
    minHeight: 700,
    backgroundColor: '#0f0f0e',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Select Music Folder' })
  return result.canceled ? null : result.filePaths[0]
})

const activeChildren = new Map()

function runScript(scriptName, args, event) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName)
  const child = spawn('node', [scriptPath, ...args], { cwd: SCRIPTS_DIR, env: { ...process.env } })
  child.stdout.on('data', (data) => event.sender.send('script:output', { type: 'stdout', data: data.toString() }))
  child.stderr.on('data', (data) => event.sender.send('script:output', { type: 'stderr', data: data.toString() }))
  child.on('close', (code) => event.sender.send('script:output', { type: 'done', code }))
  child.on('error', (err) => event.sender.send('script:output', { type: 'error', data: err.message }))
  return child
}

ipcMain.handle('script:run', async (event, { script, args = [] }) => {
  const child = runScript(script, args, event)
  const id = Date.now().toString()
  activeChildren.set(id, child)
  child.on('close', () => activeChildren.delete(id))
  return { id }
})

ipcMain.handle('script:stdin', async (_event, { id, input }) => {
  const child = activeChildren.get(id)
  if (child && child.stdin) { child.stdin.write(input); return true }
  return false
})

ipcMain.handle('script:kill', async (_event, { id }) => {
  const child = activeChildren.get(id)
  if (child) { child.kill(); activeChildren.delete(id); return true }
  return false
})

// ── IPC: Write tags to a single file ────────────────────────────────────────
const id3 = require('node-id3')
const fs  = require('fs')

ipcMain.handle('file:writeTags', async (_event, { filePath, tags }) => {
  try {
    const result = id3.update(tags, filePath)
    if (result === true) return { ok: true }
    return { ok: false, error: String(result) }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('file:readCoverArt', async (_event, { filePath }) => {
  try {
    const tags = id3.read(filePath)
    const img  = tags?.image
    if (!img || !img.imageBuffer) return null
    const b64 = img.imageBuffer.toString('base64')
    const mime = img.mime || 'image/jpeg'
    return { dataUrl: `data:${mime};base64,${b64}` }
  } catch (e) {
    return null
  }
})

ipcMain.handle('file:writeCoverArt', async (_event, { filePath, dataUrl }) => {
  try {
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/)
    if (!matches) return { ok: false, error: 'Invalid image data' }
    const mime   = matches[1]
    const buffer = Buffer.from(matches[2], 'base64')
    const result = id3.update({
      image: { mime, type: { id: 3, name: 'front cover' }, description: '', imageBuffer: buffer }
    }, filePath)
    return result === true ? { ok: true } : { ok: false, error: String(result) }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('file:readTags', async (_event, { filePath }) => {
  try {
    const tags = id3.read(filePath)
    return {
      title:  tags.title        || '',
      artist: tags.artist       || '',
      album:  tags.album        || '',
      year:   tags.year         || '',
      track:  tags.trackNumber  || '',
      genre:  tags.genre        || '',
    }
  } catch (e) {
    return { title: '', artist: '', album: '', year: '', track: '', genre: '' }
  }
})

ipcMain.handle('file:readTagsBatch', async (_event, { filePaths }) => {
  const results = {}
  for (const filePath of filePaths) {
    try {
      const tags = id3.read(filePath)
      results[filePath] = {
        title:  tags.title       || '',
        artist: tags.artist      || '',
        album:  tags.album       || '',
        year:   tags.year        || '',
        track:  tags.trackNumber || '',
        genre:  tags.genre       || '',
      }
    } catch (e) {
      results[filePath] = { title: '', artist: '', album: '', year: '', track: '', genre: '' }
    }
  }
  return results
})
