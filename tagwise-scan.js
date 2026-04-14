#!/usr/bin/env node

/**
 * Tagwise — Music File Scanner
 * Scans MP3, M4A, and M4P files and reports on tag completeness.
 * Usage: node tagwise-scan.js /path/to/your/music
 *
 * Requires: npm install music-metadata
 */

const mm = require('music-metadata');
const fs = require('fs');
const path = require('path');

const TAGS = ['title', 'artist', 'album', 'year', 'trackNumber', 'genre', 'cover'];
const CRITICAL_TAGS = ['title', 'artist', 'album', 'trackNumber', 'cover'];
const TAG_LABELS = {
  title:       'Title',
  artist:      'Artist',
  album:       'Album',
  year:        'Year',
  trackNumber: 'Track #',
  genre:       'Genre',
  cover:       'Cover art',
};

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';

function colorStatus(status) {
  if (status === 'Complete') return GREEN + status + RESET;
  if (status === 'Partial')  return YELLOW + status + RESET;
  return RED + status + RESET;
}

function padEnd(str, len) {
  const plain = str.replace(/\x1b\[[0-9;]*m/g, '');
  return str + ' '.repeat(Math.max(0, len - plain.length));
}

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.m4p'];

function getFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.m4p') return 'M4P (DRM-protected)';
  if (ext === '.m4a') return 'M4A';
  return 'MP3';
}

async function getMp3Files(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getMp3Files(fullPath));
    } else if (AUDIO_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractTags(metadata) {
  const { common, format } = metadata;
  return {
    title:       common.title   || null,
    artist:      common.artist  || null,
    album:       common.album   || null,
    year:        common.year    || null,
    trackNumber: common.track?.no != null ? String(common.track.no) : null,
    genre:       common.genre?.[0] || null,
    cover:       (common.picture && common.picture.length > 0) ? 'present' : null,
  };
}

function getStatus(tags) {
  const criticalPresent = CRITICAL_TAGS.filter(t => tags[t] !== null).length;
  if (criticalPresent === CRITICAL_TAGS.length) return 'Complete';
  if (criticalPresent === 0)                    return 'Missing';
  return 'Partial';
}

function buildRenamePath(tags, originalFile) {
  const sanitize = s => s
    .replace(/[/\\]/g, '-')
    .replace(/:/g,     '-')
    .replace(/[*?"<>|]/g, '')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .trim() || '_';

  const artist  = tags.artist      ? sanitize(tags.artist)  : 'Unknown Artist';
  const album   = tags.album       ? sanitize(tags.album)   : 'Unknown Album';
  const ext     = path.extname(originalFile);
  const origBase = path.basename(originalFile, ext);

  let filename;
  if (tags.trackNumber && tags.title) {
    const num = String(tags.trackNumber).padStart(2, '0');
    filename = `${num} - ${sanitize(tags.title)}${ext}`;
  } else if (tags.title) {
    filename = `${sanitize(tags.title)}${ext}`;
  } else {
    filename = `${origBase}${ext}`;
  }

  const inferred = [];
  if (!tags.artist)      inferred.push('artist');
  if (!tags.album)       inferred.push('album');
  if (!tags.trackNumber) inferred.push('track number');
  if (!tags.title)       inferred.push('title');

  return { renamePath: path.join(artist, album, filename), inferred };
}

async function main() {
  const targetDir = process.argv[2];

  if (!targetDir) {
    console.error(RED + 'Error: please provide a directory path.' + RESET);
    console.error(DIM + 'Usage: node tagwise-scan.js /path/to/music' + RESET);
    process.exit(1);
  }

  if (!fs.existsSync(targetDir)) {
    console.error(RED + `Error: directory not found — ${targetDir}` + RESET);
    process.exit(1);
  }

  console.log('\n' + BOLD + CYAN + '  Tagwise Music Scanner' + RESET);
  console.log(DIM + '  ' + targetDir + RESET + '\n');

  const files = await getMp3Files(targetDir);
  if (files.length === 0) {
    console.log(YELLOW + '  No audio files found in that directory.' + RESET);
    process.exit(0);
  }

  const mp3s = files.filter(f => f.toLowerCase().endsWith('.mp3'));
  const m4as = files.filter(f => f.toLowerCase().endsWith('.m4a'));
  const m4ps = files.filter(f => f.toLowerCase().endsWith('.m4p'));

  console.log(DIM + `  Found ${files.length} audio files (${mp3s.length} MP3, ${m4as.length} M4A, ${m4ps.length} M4P) — scanning...\n` + RESET);

  if (m4ps.length > 0) {
    console.log(YELLOW + `  Note: ${m4ps.length} M4P file${m4ps.length === 1 ? '' : 's'} found. These are DRM-protected iTunes purchases.` + RESET);
    console.log(DIM + '  Tags can be read but not modified. Re-download from Apple Music as M4A to unlock.' + RESET + '\n');
  }

  const results = [];

  for (const file of files) {
    try {
      const metadata = await mm.parseFile(file, { skipCovers: false });
      const tags     = extractTags(metadata);
      const status   = getStatus(tags);
      const missing  = TAGS.filter(t => tags[t] === null).map(t => TAG_LABELS[t]);
      const { renamePath, inferred } = buildRenamePath(tags, file);
      results.push({ file, tags, status, missing, renamePath, inferred, error: null });
    } catch (err) {
      results.push({ file, tags: null, status: 'Error', missing: [], renamePath: null, inferred: [], error: err.message });
    }
  }

  // Print per-file results
  for (const r of results) {
    const rel = path.relative(targetDir, r.file);
    const fmt = getFormat(r.file);
    const fmtBadge = fmt === 'M4P (DRM-protected)'
      ? ' ' + YELLOW + '[M4P — DRM]' + RESET
      : fmt === 'M4A' ? ' ' + DIM + '[M4A]' + RESET : '';
    console.log(BOLD + '  ' + rel + RESET + fmtBadge);

    if (r.error) {
      console.log('    ' + RED + 'Could not read file: ' + r.error + RESET);
      console.log();
      continue;
    }

    console.log('    Status : ' + colorStatus(r.status));

    // Tag grid
    const row1 = TAGS.slice(0, 4).map(t => {
      const val = r.tags[t];
      const label = TAG_LABELS[t];
      if (val) return GREEN  + '✓ ' + RESET + DIM + label + RESET;
      else     return RED    + '✗ ' + RESET + DIM + label + RESET;
    }).join('   ');
    const row2 = TAGS.slice(4).map(t => {
      const val = r.tags[t];
      const label = TAG_LABELS[t];
      if (val) return GREEN  + '✓ ' + RESET + DIM + label + RESET;
      else     return RED    + '✗ ' + RESET + DIM + label + RESET;
    }).join('   ');
    console.log('    Tags   : ' + row1);
    console.log('             ' + row2);

    if (r.missing.length > 0) {
      console.log('    Missing: ' + RED + r.missing.join(', ') + RESET);
    }

    // Rename preview
    const inferredNote = r.inferred.length > 0
      ? DIM + '  (inferred: ' + r.inferred.join(', ') + ')' + RESET
      : '';
    console.log('    Rename : ' + CYAN + r.renamePath + RESET + inferredNote);
    console.log();
  }

  // Summary
  const total    = results.length;
  const complete = results.filter(r => r.status === 'Complete').length;
  const partial  = results.filter(r => r.status === 'Partial').length;
  const missing  = results.filter(r => r.status === 'Missing').length;
  const errors   = results.filter(r => r.status === 'Error').length;

  console.log(DIM + '  ─────────────────────────────────────' + RESET);
  console.log(BOLD + '  Summary' + RESET);
  console.log('  Total files : ' + BOLD + total + RESET + DIM + ` (${mp3s.length} MP3, ${m4as.length} M4A, ${m4ps.length} M4P)` + RESET);
  console.log('  ' + padEnd(GREEN  + '✓ Complete' + RESET, 22) + BOLD + complete + RESET);
  console.log('  ' + padEnd(YELLOW + '~ Partial'  + RESET, 22) + BOLD + partial  + RESET);
  console.log('  ' + padEnd(RED    + '✗ Missing'  + RESET, 22) + BOLD + missing  + RESET);
  if (errors > 0) {
    console.log('  ' + padEnd(RED  + '! Errors'   + RESET, 22) + BOLD + errors   + RESET);
  }
  console.log();

  // Tag-level breakdown
  const tagCounts = {};
  for (const tag of TAGS) {
    tagCounts[tag] = results.filter(r => r.tags && r.tags[tag] !== null).length;
  }

  console.log(BOLD + '  Tag coverage — critical' + RESET);
  for (const tag of CRITICAL_TAGS) {
    const count = tagCounts[tag];
    const pct   = Math.round((count / total) * 100);
    const bar   = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
    const color = pct === 100 ? GREEN : pct >= 50 ? YELLOW : RED;
    console.log('  ' + padEnd(DIM + TAG_LABELS[tag] + RESET, 14) + color + bar + RESET + '  ' + pct + '%  (' + count + '/' + total + ')');
  }

  const niceTags = TAGS.filter(t => !CRITICAL_TAGS.includes(t));
  console.log('\n' + BOLD + '  Tag coverage — nice to have' + RESET);
  for (const tag of niceTags) {
    const count = tagCounts[tag];
    const pct   = Math.round((count / total) * 100);
    const bar   = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
    const color = pct === 100 ? GREEN : pct >= 50 ? YELLOW : RED;
    console.log('  ' + padEnd(DIM + TAG_LABELS[tag] + RESET, 14) + color + bar + RESET + '  ' + pct + '%  (' + count + '/' + total + ')');
  }
  console.log();
}

main().catch(err => {
  console.error(RED + 'Unexpected error: ' + err.message + RESET);
  process.exit(1);
});
