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
│   │   ├── FileTable.jsx       — Sortable/filterable file table with tag dot indicators and row selection
│   │   ├── TagEditorPanel.jsx  — Slide-in tag editor for single files with cover art and filename preview
│   │   ├── BulkEditPanel.jsx   — Slide-in bulk tag editor for multiple selected files
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
3. The tag health dashboard populates with 7-column coverage stats (Title, Artist, Album, Track#, Year, Cover, Genre)
4. After the scan completes, ID3 tags are batch-read for all files via `readTagsBatch`
5. The file table populates with real ID3 values (Track Name, Track #, Artist, Album)
6. Use filter pills to isolate files missing year, cover, genre, or any incomplete files
7. Click rows to select files, then use the **Edit** or **Edit X files** button to open the tag editor

### File Table

- Default sort: Artist → Album → Track # (numeric)
- Click column headers to re-sort (Track Name, Artist, Album)
- Filter pills: all / missing year / missing cover / missing genre / incomplete — with counts
- Checkbox on each row for selection; checkbox in header toggles select all/none
- DRM files (M4P) show a red **DRM** badge
- M4A files show a blue **M4A** badge
- Terminal output hidden by default — use **▸ show output** toggle to expand

### Single File Tag Editor

- Select 1 file and click **Edit** to open
- Reads real ID3 tags from the file on open
- Fields: Title, Artist, Album, Year, Track#, Genre
- Cover art: display current art, drop/click/paste to replace
- **Save Tags** writes immediately via node-id3
- **Save Cover** rewrites cover art as APIC type 3
- **Filename Preview** shows the resulting filename based on current tag values
- Table row updates live after saving — no re-scan needed
- DRM files: Save Tags button is disabled

### Bulk Tag Editor

- Select 2+ files and click **Edit X files** to open
- Fields pre-filled where all selected files share the same value
- Blank fields indicate inconsistent values across the selection
- Only fields the user explicitly edits are written — pre-filled unchanged fields are skipped
- Confirmation step shows exactly which fields will be written to how many files
- Progress bar with X/Y counter during save
- After save, button changes to **Close**
- All affected table rows update live after saving

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

- **M4P files (DRM)** — tags are read-only. Re-download from Apple Music as M4A to unlock. Save Tags button is disabled in the editor for DRM files.
- **M4A files** — cover art cannot be written with node-id3. Other tags work fine.
- **Dashboard stats** — reflect the last scan only; editing tags updates the file table live but not the percentage bars
- **Bootlegs / unofficial releases** — will not match on Discogs in Fix Tags; expected behavior
- **Bulk cover art editing** — not currently supported in the bulk editor; edit cover art per-file using the single file editor
