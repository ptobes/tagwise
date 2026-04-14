#!/usr/bin/env node

/**
 * Tagwise — Batch Fix Script
 *
 * Scans a directory for MP3s with missing Year or Cover Art tags,
 * looks them up via MusicBrainz (with iTunes fallback),
 * shows a preview of proposed changes, then writes on confirmation.
 *
 * Usage:
 *   node tagwise-fix.js /path/to/music
 *
 * Requires:
 *   npm install music-metadata node-id3
 */

const mm      = require('music-metadata');
const NodeID3 = require('node-id3');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const readline = require('readline');

const mb      = require('./musicbrainz');
const discogs  = require('./discogs');

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const AMBER  = '\x1b[33m';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase()); }));
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Scanner (same logic as tagwise-scan.js) ──────────────────────────────────

async function getMp3Files(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files   = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getMp3Files(fullPath));
    } else if (entry.name.toLowerCase().endsWith('.mp3')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function scanFile(filePath) {
  try {
    const metadata = await mm.parseFile(filePath, { skipCovers: false });
    const { common } = metadata;
    return {
      file:   filePath,
      tags: {
        title:       common.title   || null,
        artist:      common.artist  || null,
        album:       common.album   || null,
        year:        common.year    || null,
        trackNumber: common.track?.no != null ? String(common.track.no) : null,
        genre:       common.genre?.[0] || null,
        cover:       (common.picture && common.picture.length > 0) ? 'present' : null,
      },
      error: null,
    };
  } catch (err) {
    return { file: filePath, tags: null, error: err.message };
  }
}

// ─── Tag writer ───────────────────────────────────────────────────────────────

async function downloadImageBuffer(imageUrl) {
  return new Promise((resolve) => {
    const parsed  = new URL(imageUrl);
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      headers:  { 'User-Agent': 'Tagwise/0.1' },
    };
    https.get(options, res => {
      if (res.statusCode === 200) {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      } else {
        resolve(null);
      }
    }).on('error', () => resolve(null));
  });
}

function getMimeType(url) {
  if (url.includes('.png')) return 'image/png';
  return 'image/jpeg';
}

async function writeTagsToFile(filePath, updates, coverArtUrl) {
  const tags = {};

  if (updates.year) {
    tags.year = String(updates.year);
  }

  if (coverArtUrl) {
    const imageBuffer = await downloadImageBuffer(coverArtUrl);
    if (imageBuffer) {
      tags.image = {
        mime:        getMimeType(coverArtUrl),
        type:        { id: 3, name: 'front cover' },
        description: 'Front cover',
        imageBuffer: imageBuffer,
      };
    }
  }

  if (Object.keys(tags).length === 0) return { success: false, reason: 'nothing to write' };

  const success = NodeID3.update(tags, filePath);
  return { success: success !== false, reason: success === false ? 'NodeID3 write failed' : null };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// ─── Filename parser ─────────────────────────────────────────────────────────

function parseArtistAlbumFromFilename(filePath) {
  const base  = path.basename(filePath, path.extname(filePath));
  const parts = base.split(/ - /).map(p => p.trim()).filter(Boolean);

  if (parts.length < 3) return null;

  // Strip leading track number if present e.g. "02"
  const firstIsNumber = /^\d+$/.test(parts[0]);
  const meaningful    = firstIsNumber ? parts.slice(1) : parts;

  if (meaningful.length < 3) return null;

  // Pattern: TrackTitle - Artist - Album (last two segments are artist and album)
  const album  = meaningful[meaningful.length - 1];
  const artist = meaningful[meaningful.length - 2];

  if (artist.length < 2 || album.length < 2) return null;
  if (/^\d+$/.test(artist) || /^\d+$/.test(album)) return null;

  return { artist, album };
}

async function main() {
  const targetDir = process.argv[2];

  if (!targetDir || !fs.existsSync(targetDir)) {
    console.error(RED + 'Error: please provide a valid directory path.' + RESET);
    console.error(DIM + 'Usage: node tagwise-fix.js /path/to/music' + RESET);
    process.exit(1);
  }

  console.log('\n' + BOLD + CYAN + '  Tagwise Batch Fix' + RESET);
  console.log(DIM + '  ' + targetDir + RESET + '\n');

  // ── Step 1: Scan ────────────────────────────────────────────────────────────
  process.stdout.write(DIM + '  Scanning MP3 files...' + RESET);
  const files   = await getMp3Files(targetDir);
  const results = await Promise.all(files.map(scanFile));
  console.log(`\r  Scanned ${files.length} files.` + ' '.repeat(20));

  const needsWork = results.filter(r => r.tags && (!r.tags.year || !r.tags.cover));

  if (needsWork.length === 0) {
    console.log(GREEN + '  All files already have Year and Cover Art tags. Nothing to do.' + RESET);
    return;
  }

  // ── Step 2: Group by Artist + Album ─────────────────────────────────────────
  const groups = {};
  for (const r of needsWork) {
    let artist = r.tags.artist || null;
    let album  = r.tags.album  || null;

    if (!artist || !album) {
      const parsed = parseArtistAlbumFromFilename(r.file);
      if (parsed) {
        if (!artist) { artist = parsed.artist; r._artistFromFilename = true; }
        if (!album)  { album  = parsed.album;  r._albumFromFilename  = true; }
        console.log(`  \x1b[2mFilename parse: "${path.basename(r.file)}" -> artist: ${artist}, album: ${album}\x1b[0m`);
      }
    }

    artist = artist || 'Unknown Artist';
    album  = album  || 'Unknown Album';

    const key = `${artist}|||${album}`;
    if (!groups[key]) groups[key] = { artist, album, files: [] };
    groups[key].files.push(r);
  }

  const albumGroups = Object.values(groups);
  const missingYear = needsWork.filter(r => !r.tags.year).length;
  const missingCover = needsWork.filter(r => !r.tags.cover).length;

  console.log(`  ${BOLD}${needsWork.length}${RESET} files across ${BOLD}${albumGroups.length}${RESET} albums need attention:`);
  console.log(`  ${YELLOW}~${RESET} ${missingYear} missing Year   ${YELLOW}~${RESET} ${missingCover} missing Cover Art\n`);

  // ── Step 3: Lookup ──────────────────────────────────────────────────────────
  console.log(DIM + '  Looking up albums on MusicBrainz...\n' + RESET);

  const lookupResults = [];

  for (const group of albumGroups) {
    // Try MusicBrainz — if it fails entirely, fall straight through to Discogs
    let result = { found: false, artist: group.artist, album: group.album };
    try {
      result = await mb.lookupAlbum(group.artist, group.album);
    } catch (err) {
      console.log(`  ${YELLOW}~${RESET} MusicBrainz unavailable (${err.code || err.message}) — trying Discogs...`);
    }

    // If MusicBrainz didn't find it, or is missing year/cover, try Discogs
    const needsDiscogs = !result.found || !result.year || !result.coverArtUrl;
    if (needsDiscogs) {
      if (!result.found) {
        console.log(`  ${YELLOW}~${RESET} MusicBrainz: no match — trying Discogs...`);
      } else {
        console.log(`  ${YELLOW}~${RESET} MusicBrainz: incomplete — trying Discogs for missing fields...`);
      }
      const dResult = await discogs.lookupAlbum(group.artist, group.album);
      if (dResult.found) {
        // Merge — MusicBrainz data takes priority where it exists
        result = {
          ...result,
          found:       true,
          year:        result.year        || dResult.year,
          coverArtUrl: result.coverArtUrl || dResult.coverArtUrl,
          genre:       result.genre       || dResult.genre,
          artist:      result.artist      || dResult.artist,
          album:       result.album       || dResult.album,
        };
      }
    }

    if (!result.found) {
      console.log(`  ${RED}✗${RESET} ${BOLD}${group.artist}${RESET} — ${group.album} ${DIM}(no match on MusicBrainz or Discogs)${RESET}`);
    } else {
      const source   = result.releaseId ? DIM + '[MB]' + RESET : DIM + '[Discogs]' + RESET;
      const yearStr  = result.year        ? GREEN  + result.year + RESET : YELLOW + 'not found' + RESET;
      const coverStr = result.coverArtUrl ? GREEN  + 'found'    + RESET : YELLOW + 'not found' + RESET;
      console.log(`  ${GREEN}✓${RESET} ${BOLD}${result.artist}${RESET} — ${result.album}  year: ${yearStr}  cover: ${coverStr}  ${source}`);
    }

    lookupResults.push({ ...group, lookup: result });
    await wait(5000);
  }

  // Filter to only albums where we found something useful
  const actionable = lookupResults.filter(g =>
    g.lookup.found && (g.lookup.year || g.lookup.coverArtUrl)
  );

  if (actionable.length === 0) {
    console.log('\n' + YELLOW + '  No actionable matches found. Nothing to write.' + RESET);
    return;
  }

  // ── Step 4: Preview ─────────────────────────────────────────────────────────
  console.log('\n' + BOLD + '  Proposed changes' + RESET + DIM + ' — review before applying' + RESET + '\n');

  let totalChanges = 0;

  for (const group of actionable) {
    const { lookup } = group;
    console.log(`  ${BOLD}${lookup.artist} — ${lookup.album}${RESET}  ${DIM}(${group.files.length} track${group.files.length > 1 ? 's' : ''})${RESET}`);

    for (const f of group.files) {
      const rel      = path.relative(targetDir, f.file);
      const changes  = [];

      if (!f.tags.year && lookup.year) {
        changes.push(`year ${DIM}→${RESET} ${GREEN}${lookup.year}${RESET}`);
      }
      if (!f.tags.cover && lookup.coverArtUrl) {
        changes.push(`cover art ${DIM}→${RESET} ${GREEN}added${RESET}`);
      }

      if (changes.length > 0) {
        console.log(`    ${DIM}${rel}${RESET}`);
        console.log(`      ${changes.join('   ')}`);
        totalChanges++;
      }
    }
    console.log();
  }

  console.log(`  ${BOLD}${totalChanges}${RESET} files will be updated.\n`);

  // ── Step 5: Confirm ─────────────────────────────────────────────────────────
  const answer = await prompt(`  Apply these changes? ${DIM}[y/n]${RESET} `);

  if (answer !== 'y' && answer !== 'yes') {
    console.log('\n' + DIM + '  Cancelled. No files were modified.' + RESET + '\n');
    return;
  }

  // ── Step 6: Write ────────────────────────────────────────────────────────────
  console.log('\n' + DIM + '  Writing tags...\n' + RESET);

  let written  = 0;
  let skipped  = 0;
  let failed   = 0;

  for (const group of actionable) {
    const { lookup } = group;

    for (const f of group.files) {
      const rel     = path.relative(targetDir, f.file);
      const updates = {};

      if (!f.tags.year && lookup.year)         updates.year  = lookup.year;
      const writeCover = !f.tags.cover && lookup.coverArtUrl;

      if (Object.keys(updates).length === 0 && !writeCover) {
        skipped++;
        continue;
      }

      const result = await writeTagsToFile(f.file, updates, writeCover ? lookup.coverArtUrl : null);

      if (result.success) {
        const parts = [];
        if (updates.year)  parts.push('year');
        if (writeCover)    parts.push('cover art');
        console.log(`  ${GREEN}✓${RESET} ${DIM}${rel}${RESET}  ${parts.join(', ')}`);
        written++;
      } else {
        console.log(`  ${RED}✗${RESET} ${DIM}${rel}${RESET}  ${RED}${result.reason}${RESET}`);
        failed++;
      }
    }
  }

  // ── Step 7: Summary ──────────────────────────────────────────────────────────
  console.log('\n' + DIM + '  ─────────────────────────────────────' + RESET);
  console.log(BOLD + '  Done' + RESET);
  console.log(`  ${GREEN}✓ Written ${RESET} ${BOLD}${written}${RESET}`);
  if (skipped > 0) console.log(`  ${DIM}~ Skipped  ${skipped}${RESET}`);
  if (failed  > 0) console.log(`  ${RED}✗ Failed   ${failed}${RESET}`);
  console.log();
}

main().catch(err => {
  console.error('\n' + RED + '  Unexpected error: ' + err.message + RESET);
  process.exit(1);
});
