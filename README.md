# Tagwise

A command-line tool for scanning, fixing, and renaming MP3/M4A music libraries.

## Features
- Scan a directory of MP3s and report on tag completeness
- Auto-lookup missing tags via MusicBrainz and Discogs
- Cover art fetching via Cover Art Archive and iTunes
- Batch write missing Year and Cover Art tags
- Rename files to a consistent format: `TrackNumber - Title - Album - Artist.mp3`
- Fix cover art APIC type for car infotainment compatibility (GM/Chevy head units)

## Scripts
- `tagwise-scan.js` — scan and report tag health (MP3, M4A, M4P)
- `tagwise-fix.js` — batch lookup and fix missing tags
- `tagwise-rename.js` — rename files to consistent format
- `tagwise-fix-covertype.js` — fix cover art APIC type for car compatibility
- `musicbrainz.js` — MusicBrainz lookup module
- `discogs.js` — Discogs lookup module

## Setup
```bash
npm install music-metadata node-id3 axios
```

---

## End to End Process

### Prerequisites
- Node.js installed
- Scripts in `~/tagwise/`
- Dependencies installed: `npm install music-metadata node-id3 axios`

### Step 1 — Scan
Run the scanner to assess the tag health of your music files before touching anything.

```bash
node tagwise-scan.js ~/Documents/Music/YourFolder/
```

Review the summary at the bottom. Look for:
- Cover art percentage (critical — affects car playback)
- Year percentage (nice to have)
- Any M4P files flagged as DRM-protected (read-only)
- Any files in `Unknown Album` folders (need manual attention before proceeding)

**Handle Unknown Album files before continuing.** Either move them to the correct album folder in Finder, or delete them if they are duplicates or unneeded. Do not let `tagwise-fix.js` run against them — Discogs will match "Unknown Album" to a real but wrong album.

### Step 2 — Fix Tags
Look up and write missing Year and Cover Art tags via Discogs and iTunes.

```bash
node tagwise-fix.js ~/Documents/Music/YourFolder/
```

Review the proposed changes carefully before typing `y`. Watch for:
- Any album matched to an obviously wrong year or title — type `n` and investigate
- Deluxe/special edition album names that don't match (these often get no match, which is fine — skip them)
- Bootlegs and unofficial releases won't match — that's expected

Type `y` to apply when satisfied.

### Step 3 — Fix Cover Art Type
Rewrite all cover art as APIC type 3 (Front Cover). This is required for compatibility with car infotainment systems including GM/Chevy head units, which show Unknown Artist when cover art is type 0 (Other).

```bash
node tagwise-fix-covertype.js ~/Documents/Music/YourFolder/
```

Type `y` at the prompt. All files with incorrect cover art type will be fixed. Zero failures is the expected outcome.

**Note:** If any album was previously showing as Unknown Artist on your Tahoe and `tagwise-fix.js` did not find cover art for it (so the art was never rewritten), you may need to manually rewrite the cover art on those specific files using a fresh image from iTunes. Refer to the rewrite-cover scripts used during development for the pattern.

### Step 4 — Rename (Dry Run First)
Preview the rename operations before executing.

```bash
node tagwise-rename.js ~/Documents/Music/YourFolder/ --dry-run
```

Review the output for:
- **Collisions** — two files that would get the same name. Resolve these manually in Finder (usually duplicates — keep one, delete the other) before proceeding
- Files marked `(inferred: track number)` — these are missing a track number tag and will be renamed without a leading number. Acceptable for bootlegs and loose tracks
- Any obviously wrong artist or album folder names (would indicate a bad tag that slipped through)

### Step 5 — Rename
Once the dry run looks clean and collisions are resolved, run the real rename.

```bash
node tagwise-rename.js ~/Documents/Music/YourFolder/
```

A backup manifest is written to `.tagwise-rename-manifest.txt` in the music folder. This records every rename in case you need to reverse anything.

**Filename format:** `TrackNumber - Title - Album - Artist.mp3`  
**Folder structure:** `Artist/Album/`

### Step 6 — Final Scan (Optional)
Run the scanner one more time to confirm everything is clean.

```bash
node tagwise-scan.js ~/Documents/Music/YourFolder/
```

Target state: Title 100%, Artist 100%, Album 98%+, Track# 98%+, Cover art 100%.

### Step 7 — Copy to USB and Test
Copy the processed folder to your USB drive and test in the Tahoe. All artists should appear correctly, cover art should display, and no Unknown Artist entries should be present.

---

## Known Limitations
- **M4P files** (DRM) — tags can be read but not written. Re-download from Apple Music as M4A to unlock
- **M4A files** — tags can be read but cover art cannot be written with current tools. Needs `ffmpeg` or `mp4tag` support (planned for desktop app)
- **Bootlegs and unofficial releases** — will not match on Discogs or MusicBrainz. Year and cover art must be added manually
- **Deluxe/special editions** — often don't match due to naming variations. Acceptable to leave year missing on these
- **Duplicate files** — the rename script detects collisions but does not delete duplicates. Handle manually in Finder before renaming
