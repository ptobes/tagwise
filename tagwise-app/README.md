# Tagwise Desktop App

An Electron + React desktop interface for the Tagwise music library toolkit. Wraps the existing CLI scripts in a dark, industrial UI for scanning, editing, and managing MP3/M4A tag health.

---

## Prerequisites

- Node.js installed
- Existing Tagwise CLI scripts in `~/tagwise/`:
  - `tagwise-scan.js`
  - `tagwise-fix.js`
  - `tagwise-fix-covertype.js`
  - `tagwise-rename.js`
  - `musicbrainz.js`
  - `discogs.js`
- CLI dependencies installed: `npm install music-metadata node-id3 axios` (in `~/tagwise/`)

---

## Setup

```bash
cd ~/tagwise/tagwise-app
npm install
```

## Development

```bash
NODE_ENV=development npm run dev
```

Starts Vite on port 5173 and launches the Electron window pointing at it. Hot-reload is active for all React components. Changes to `electron/main.js` or `electron/preload.js` require a full restart.

---

## Architecture

```
tagwise-app/
├── electron/
│   ├── main.js         — Electron main process: BrowserWindow, IPC handlers, child_process script runner
│   └── preload.js      — Context bridge: exposes window.tagwise API to the renderer
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx         — Navigation + directory picker
│   │   ├── ScanView.jsx        — Scan dashboard, tag health grid, file table
│   │   ├── FileTable.jsx       — Sortable/filterable file table with tag dot indicators
│   │   ├── TagEditorPanel.jsx  — Slide-in tag editor with cover art, filename preview
│   │   ├── Terminal.jsx        — Streaming script output pane with y/n confirm buttons
│   │   ├── FixView.jsx         — Fix Tags view (tagwise-fix.js)
│   │   ├── CoverTypeView.jsx   — Cover Type fix view (tagwise-fix-covertype.js)
│   │   └── RenameView.jsx      — Rename view with dry-run support (tagwise-rename.js)
│   ├── hooks/
│   │   └── useScript.js        — React hook for running scripts with streaming IPC output
│   ├── lib/
│   │   └── parseOutput.js      — Parses tagwise-scan.js stdout into structured data
│   ├── App.jsx                 — Root component, view routing
│   └── index.css               — Global dark theme (IBM Plex Mono/Sans)
├── index.html
└── vite.config.js
```

---

## IPC API

The preload exposes `window.tagwise` to the renderer with the following methods:

| Method | Description |
|--------|-------------|
| `openDirectory()` | Opens a native directory picker dialog |
| `runScript(script, args)` | Spawns a tagwise CLI script, returns `{ id }` |
| `sendInput(id, input)` | Writes to stdin of a running script (e.g. `"y\n"`) |
| `killScript(id)` | Kills a running script |
| `onOutput(callback)` | Subscribes to streaming script output, returns unsubscribe function |
| `readTags(filePath)` | Reads ID3 tags from a single file |
| `readTagsBatch(filePaths)` | Reads ID3 tags from multiple files, returns `{ [path]: tags }` |
| `writeTags(filePath, tags)` | Writes ID3 tags to a file |
| `readCoverArt(filePath)` | Reads cover art, returns `{ dataUrl }` |
| `writeCoverArt(filePath, dataUrl)` | Writes cover art as APIC type 3 |

---

## Scan View

The primary view. Workflow:

1. Select a music folder via the `⌂` button in the sidebar
2. Click **Run Scan** to run `tagwise-scan.js`
3. The tag health dashboard populates with 7-column coverage stats
4. After the scan completes, ID3 tags are batch-read for all files
5. The file table populates with real tag values (Track Name, Track #, Artist, Album)
6. Use filter pills to isolate files missing year, cover, genre, or any incomplete files
7. Click any row to open the **Tag Editor** panel

### File Table

- Default sort: Artist → Album → Track # (numeric)
- Click column headers to re-sort
- Filter pills: all / missing year / missing cover / missing genre / incomplete
- DRM files (M4P) show a red **DRM — Read Only** badge
- M4A files show a blue **M4A** badge

### Tag Editor Panel

- Opens on row click, closes on Escape or backdrop click
- Reads real ID3 tags from the file on open
- Falls back to filename parsing if tags are missing
- Fields: Title, Artist, Album, Year, Track#, Genre
- Cover art: drop, click, or paste from clipboard
- **Save Tags** writes immediately via node-id3
- **Save Cover** rewrites cover art as APIC type 3
- Table updates live after saving — no re-scan needed
- DRM files: Save Tags button is disabled

---

## Fix Tags View

Runs `tagwise-fix.js` against the selected folder. Looks up missing Year and Cover Art via Discogs and iTunes. The terminal pane detects `[y/n]` prompts and surfaces **Yes / No** buttons for confirmation.

**Before running:** resolve any "Unknown Album" folders in Finder. Discogs will match them to wrong albums.

---

## Cover Type View

Runs `tagwise-fix-covertype.js`. Rewrites all cover art as APIC type 3 (Front Cover), required for GM/Chevy head unit compatibility. Prompts for confirmation before writing.

---

## Rename View

Runs `tagwise-rename.js`. Always run **Dry Run** first to check for collisions. Resolve duplicate files in Finder before running the live rename.

Filename format: `TrackNumber - Title - Album - Artist.mp3`

A backup manifest is written to `.tagwise-rename-manifest.txt` in the music folder.

---

## Known Limitations

- **M4P files (DRM)** — tags are read-only. Re-download from Apple Music as M4A to unlock
- **M4A files** — cover art cannot be written with node-id3. Other tags work fine
- **Dashboard stats** — reflect the last scan only; editing tags updates the file table live but not the percentage bars
- **Bootlegs / unofficial releases** — will not match on Discogs in Fix Tags; expected behavior
