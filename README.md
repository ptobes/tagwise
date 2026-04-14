# Tagwise

A command-line tool for scanning, fixing, and renaming MP3/M4A music libraries.

## Features
- Scan a directory of MP3s and report on tag completeness
- Auto-lookup missing tags via MusicBrainz and Discogs
- Cover art fetching via Cover Art Archive and iTunes
- Batch write missing Year and Cover Art tags
- Rename files to a consistent format: `TrackNumber - Title - Album - Artist.mp3`

## Scripts
- `tagwise-scan.js` — scan and report tag health
- `tagwise-fix.js` — batch lookup and fix missing tags
- `tagwise-rename.js` — rename files to consistent format
- `musicbrainz.js` — MusicBrainz lookup module
- `discogs.js` — Discogs lookup module

## Setup
```bash
npm install music-metadata node-id3 axios
```

## Usage
```bash
node tagwise-scan.js ~/Music
node tagwise-fix.js ~/Music
node tagwise-rename.js ~/Music --dry-run
node tagwise-rename.js ~/Music
```
