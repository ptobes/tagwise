#!/usr/bin/env node

/**
 * Tagwise — Rename Script
 *
 * Renames and reorganises MP3 files into:
 *   /Artist/Album/TrackNumber - TrackTitle - Album - Artist.mp3
 *
 * Features:
 *   - Preview all changes before applying
 *   - Sanitizes all path segments
 *   - Graceful fallbacks for missing tags
 *   - Collision detection
 *   - Backup manifest of old -> new paths
 *   - Dry run mode: --dry-run
 *   - Limit: --limit=N (process N files max)
 *
 * Usage:
 *   node tagwise-rename.js /path/to/music
 *   node tagwise-rename.js /path/to/music --dry-run
 *   node tagwise-rename.js /path/to/music --limit=50
 *
 * Requires: npm install music-metadata
 */

const mm       = require('music-metadata');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args      = process.argv.slice(2);
const targetDir = args.find(a => !a.startsWith('--'));
const DRY_RUN   = args.includes('--dry-run');
const limitArg  = args.find(a => a.startsWith('--limit='));
const LIMIT     = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

// ─── Colours ──────────────────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW= '\x1b[33m';
const RED   = '\x1b[31m';
const CYAN  = '\x1b[36m';
const DIM   = '\x1b[2m';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase()); }));
}

function padEnd(str, len) {
  const plain = str.replace(/\x1b\[[0-9;]*m/g, '');
  return str + ' '.repeat(Math.max(0, len - plain.length));
}

// ─── Sanitize ─────────────────────────────────────────────────────────────────

function sanitize(str) {
  if (!str) return null;
  return str
    .replace(/[/\\]/g,    '-')
    .replace(/:/g,        '-')
    .replace(/[*?"<>|]/g, '')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .trim() || null;
}

// ─── Scanner ─────────────────────────────────────────────────────────────────

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

async function readTags(filePath) {
  try {
    const metadata = await mm.parseFile(filePath, { skipCovers: true });
    const { common } = metadata;
    return {
      title:       common.title   || null,
      artist:      common.artist  || null,
      album:       common.album   || null,
      trackNumber: common.track?.no != null ? common.track.no : null,
      trackTotal:  common.track?.of != null ? common.track.of : null,
    };
  } catch {
    return { title: null, artist: null, album: null, trackNumber: null, trackTotal: null };
  }
}

// ─── Build target path ────────────────────────────────────────────────────────

function buildTargetPath(filePath, tags, albumTrackTotal) {
  const ext      = path.extname(filePath);
  const origBase = path.basename(filePath, ext);

  const artist = sanitize(tags.artist) || 'Unknown Artist';
  const album  = sanitize(tags.album)  || 'Unknown Album';
  const title  = sanitize(tags.title)  || origBase;

  const inferred = [];
  if (!tags.artist)      inferred.push('artist');
  if (!tags.album)       inferred.push('album');
  if (!tags.title)       inferred.push('title');
  if (tags.trackNumber == null) inferred.push('track number');

  // Determine track number padding based on total tracks in album
  let trackPrefix = '';
  if (tags.trackNumber != null) {
    const total   = albumTrackTotal || tags.trackTotal || 99;
    const padLen  = total >= 100 ? 3 : 2;
    trackPrefix   = String(tags.trackNumber).padStart(padLen, '0') + ' - ';
  }

  const filename    = `${trackPrefix}${title} - ${album} - ${artist}${ext}`;
  const targetPath  = path.join(artist, album, filename);

  return { targetPath, artist, album, title, trackPrefix, inferred };
}

// ─── Collision detection ──────────────────────────────────────────────────────

function detectCollisions(renames) {
  const seen      = {};
  const collisions = [];

  for (const r of renames) {
    const key = r.absoluteTarget.toLowerCase();
    if (seen[key]) {
      collisions.push({ target: r.absoluteTarget, files: [seen[key].source, r.source] });
    } else {
      seen[key] = r;
    }
  }
  return collisions;
}

// ─── Write backup manifest ────────────────────────────────────────────────────

function writeManifest(renames, targetDir) {
  const lines     = ['# Tagwise rename manifest', `# Generated: ${new Date().toISOString()}`, ''];
  for (const r of renames) {
    lines.push(`${r.source}`);
    lines.push(`  -> ${r.absoluteTarget}`);
    lines.push('');
  }
  const manifestPath = path.join(targetDir, '.tagwise-rename-manifest.txt');
  fs.writeFileSync(manifestPath, lines.join('\n'), 'utf8');
  return manifestPath;
}

// ─── Execute renames ──────────────────────────────────────────────────────────

async function executeRename(source, absoluteTarget) {
  try {
    const targetFolder = path.dirname(absoluteTarget);

    // Create target directory if needed
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    // Check target doesn't already exist (safety net beyond collision detection)
    if (fs.existsSync(absoluteTarget) && absoluteTarget.toLowerCase() !== source.toLowerCase()) {
      return { success: false, reason: 'target already exists' };
    }

    fs.renameSync(source, absoluteTarget);
    return { success: true };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!targetDir || !fs.existsSync(targetDir)) {
    console.error(RED + 'Error: please provide a valid directory path.' + RESET);
    console.error(DIM + 'Usage: node tagwise-rename.js /path/to/music [--dry-run] [--limit=N]' + RESET);
    process.exit(1);
  }

  console.log('\n' + BOLD + CYAN + '  Tagwise Rename' + RESET);
  console.log(DIM + '  ' + targetDir + RESET);
  if (DRY_RUN) console.log(YELLOW + '  [dry run — no files will be moved]' + RESET);
  if (LIMIT)   console.log(DIM + `  [limit: ${LIMIT} files]` + RESET);
  console.log();

  // ── Step 1: Scan ────────────────────────────────────────────────────────────
  process.stdout.write(DIM + '  Scanning MP3 files...' + RESET);
  let files = await getMp3Files(targetDir);
  if (LIMIT) files = files.slice(0, LIMIT);
  console.log(`\r  Found ${files.length} MP3 files.` + ' '.repeat(20));

  // ── Step 2: Read tags ───────────────────────────────────────────────────────
  process.stdout.write(DIM + '  Reading tags...' + RESET);
  const tagged = [];
  for (const file of files) {
    const tags = await readTags(file);
    tagged.push({ file, tags });
  }
  console.log(`\r  Read tags for ${tagged.length} files.` + ' '.repeat(20) + '\n');

  // ── Step 3: Count tracks per album (for padding) ────────────────────────────
  const albumCounts = {};
  for (const { tags } of tagged) {
    const key = `${tags.artist || 'Unknown'}|||${tags.album || 'Unknown'}`;
    albumCounts[key] = (albumCounts[key] || 0) + 1;
  }

  // ── Step 4: Build rename plan ───────────────────────────────────────────────
  const renames = [];
  for (const { file, tags } of tagged) {
    const key   = `${tags.artist || 'Unknown'}|||${tags.album || 'Unknown'}`;
    const total = albumCounts[key];
    const { targetPath, artist, album, title, trackPrefix, inferred } = buildTargetPath(file, tags, total);
    const absoluteTarget = path.join(targetDir, targetPath);
    const unchanged      = path.normalize(file) === path.normalize(absoluteTarget);

    renames.push({
      source:         file,
      absoluteTarget,
      targetPath,
      artist,
      album,
      title,
      trackPrefix,
      inferred,
      unchanged,
    });
  }

  // ── Step 5: Collision detection ─────────────────────────────────────────────
  const actionable  = renames.filter(r => !r.unchanged);
  const collisions  = detectCollisions(actionable);

  if (collisions.length > 0) {
    console.log(RED + BOLD + `  ${collisions.length} collision(s) detected — these files would overwrite each other:` + RESET);
    for (const c of collisions) {
      console.log(`\n  ${RED}Target:${RESET} ${c.target}`);
      for (const f of c.files) {
        console.log(`    ${DIM}${path.relative(targetDir, f)}${RESET}`);
      }
    }
    console.log('\n' + YELLOW + '  Please resolve collisions manually before renaming.' + RESET + '\n');
  }

  // Remove colliding files from actionable set
  const collidingTargets = new Set(collisions.flatMap(c => [c.target.toLowerCase()]));
  const safeRenames      = actionable.filter(r => !collidingTargets.has(r.absoluteTarget.toLowerCase()));
  const skipped          = renames.filter(r => r.unchanged).length;

  if (safeRenames.length === 0) {
    console.log(GREEN + '  Nothing to rename — all files already match the target format.' + RESET + '\n');
    return;
  }

  // ── Step 6: Preview ─────────────────────────────────────────────────────────
  console.log(BOLD + '  Proposed renames' + RESET + DIM + ' — review before applying\n' + RESET);

  // Group by artist + album for cleaner display
  const groups = {};
  for (const r of safeRenames) {
    const key = `${r.artist}|||${r.album}`;
    if (!groups[key]) groups[key] = { artist: r.artist, album: r.album, items: [] };
    groups[key].items.push(r);
  }

  for (const group of Object.values(groups)) {
    console.log(`  ${BOLD}${group.artist} — ${group.album}${RESET}`);
    for (const r of group.items) {
      const fromRel = path.relative(targetDir, r.source);
      const toRel   = r.targetPath;
      const same    = fromRel === toRel;

      if (!same) {
        console.log(`    ${DIM}from:${RESET} ${fromRel}`);
        const inferredNote = r.inferred.length > 0
          ? DIM + ' (inferred: ' + r.inferred.join(', ') + ')' + RESET
          : '';
        console.log(`    ${CYAN}  to:${RESET} ${toRel}${inferredNote}`);
      }
    }
    console.log();
  }

  console.log(`  ${BOLD}${safeRenames.length}${RESET} files will be renamed.`);
  if (skipped > 0)          console.log(`  ${DIM}${skipped} files already match — skipped.${RESET}`);
  if (collisions.length > 0) console.log(`  ${YELLOW}${collisions.length * 2} files skipped due to collisions.${RESET}`);
  console.log();

  // ── Step 7: Confirm ─────────────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log(YELLOW + '  Dry run complete — no files were moved.' + RESET + '\n');
    return;
  }

  const answer = await prompt(`  Apply these renames? ${DIM}[y/n]${RESET} `);
  if (answer !== 'y' && answer !== 'yes') {
    console.log('\n' + DIM + '  Cancelled. No files were moved.' + RESET + '\n');
    return;
  }

  // ── Step 8: Write manifest ───────────────────────────────────────────────────
  const manifestPath = writeManifest(safeRenames, targetDir);
  console.log('\n' + DIM + `  Backup manifest written: ${path.relative(targetDir, manifestPath)}` + RESET);

  // ── Step 9: Execute ──────────────────────────────────────────────────────────
  console.log(DIM + '\n  Renaming files...\n' + RESET);

  let renamed = 0;
  let failed  = 0;

  for (const r of safeRenames) {
    const result = await executeRename(r.source, r.absoluteTarget);
    const rel    = path.relative(targetDir, r.source);

    if (result.success) {
      console.log(`  ${GREEN}✓${RESET} ${DIM}${rel}${RESET}`);
      console.log(`    ${CYAN}->${RESET} ${r.targetPath}`);
      renamed++;
    } else {
      console.log(`  ${RED}✗${RESET} ${DIM}${rel}${RESET}  ${RED}${result.reason}${RESET}`);
      failed++;
    }
  }

  // ── Step 10: Summary ──────────────────────────────────────────────────────────
  console.log('\n' + DIM + '  ─────────────────────────────────────' + RESET);
  console.log(BOLD + '  Done' + RESET);
  console.log(`  ${GREEN}✓ Renamed  ${RESET}${BOLD}${renamed}${RESET}`);
  if (skipped > 0)          console.log(`  ${DIM}~ Skipped  ${skipped}${RESET}`);
  if (collisions.length > 0) console.log(`  ${YELLOW}~ Collisions skipped  ${collisions.length * 2}${RESET}`);
  if (failed > 0)            console.log(`  ${RED}✗ Failed   ${failed}${RESET}`);
  console.log(`\n  ${DIM}Manifest: ${manifestPath}${RESET}\n`);
}

main().catch(err => {
  console.error('\n' + RED + '  Unexpected error: ' + err.message + RESET);
  process.exit(1);
});
