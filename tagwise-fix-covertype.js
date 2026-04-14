#!/usr/bin/env node

/**
 * Tagwise — Fix Cover Art Picture Type
 *
 * Rewrites cover art tags on MP3 files where the APIC picture type
 * is "Other" (type 0) instead of "Front Cover" (type 3).
 *
 * Car infotainment systems (including Chevy/GM head units) require
 * picture type 3 to correctly display artwork and read tags.
 *
 * Usage:
 *   node tagwise-fix-covertype.js /path/to/music
 *   node tagwise-fix-covertype.js /path/to/music --dry-run
 *
 * Requires: npm install music-metadata node-id3
 */

const mm       = require('music-metadata');
const NodeID3  = require('node-id3');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const args      = process.argv.slice(2);
const targetDir = args.find(a => !a.startsWith('--'));
const DRY_RUN   = args.includes('--dry-run');

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase()); }));
}

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

async function checkAndFixFile(filePath) {
  const metadata = await mm.parseFile(filePath, { skipCovers: false });
  const frames   = metadata.native['ID3v2.3'] || metadata.native['ID3v2.4'] || [];

  const apicFrame = frames.find(f => f.id === 'APIC');

  if (!apicFrame) return { status: 'no-cover' };
  if (apicFrame.value.type !== 'Other') return { status: 'ok' };

  // Found a cover with wrong type — fix it
  return {
    status:      'needs-fix',
    imageData:   apicFrame.value.data,
    imageFormat: apicFrame.value.format,
  };
}

async function fixFile(filePath, imageData, imageFormat) {
  const tags = {
    image: {
      mime:        imageFormat,
      type:        { id: 3, name: 'front cover' },
      description: 'Front Cover',
      imageBuffer: imageData,
    }
  };

  const result = NodeID3.update(tags, filePath);
  return result !== false;
}

async function main() {
  if (!targetDir || !fs.existsSync(targetDir)) {
    console.error(RED + 'Error: please provide a valid directory path.' + RESET);
    console.error(DIM + 'Usage: node tagwise-fix-covertype.js /path/to/music [--dry-run]' + RESET);
    process.exit(1);
  }

  console.log('\n' + BOLD + CYAN + '  Tagwise — Fix Cover Art Type' + RESET);
  console.log(DIM + '  ' + targetDir + RESET);
  if (DRY_RUN) console.log(YELLOW + '  [dry run — no files will be modified]' + RESET);
  console.log();

  process.stdout.write(DIM + '  Scanning MP3 files...' + RESET);
  const files = await getMp3Files(targetDir);
  console.log(`\r  Found ${files.length} MP3 files.` + ' '.repeat(20) + '\n');

  const needsFix = [];
  let checked = 0;

  for (const file of files) {
    checked++;
    process.stdout.write(`\r  Checking tags... ${checked}/${files.length}`);
    try {
      const result = await checkAndFixFile(file);
      if (result.status === 'needs-fix') {
        needsFix.push({ file, imageData: result.imageData, imageFormat: result.imageFormat });
      }
    } catch (err) {
      // skip unreadable files silently
    }
  }
  console.log('\n');

  if (needsFix.length === 0) {
    console.log(GREEN + '  All cover art already has correct picture type. Nothing to fix.' + RESET + '\n');
    return;
  }

  console.log(BOLD + `  Found ${needsFix.length} file${needsFix.length === 1 ? '' : 's'} with incorrect cover art type (Other → needs Front Cover):` + RESET + '\n');

  for (const { file } of needsFix) {
    const rel = path.relative(targetDir, file);
    console.log(`  ${YELLOW}~${RESET} ${DIM}${rel}${RESET}`);
  }

  console.log();

  if (DRY_RUN) {
    console.log(YELLOW + '  Dry run complete — no files were modified.' + RESET + '\n');
    return;
  }

  const answer = await prompt(`  Fix cover art type on these ${needsFix.length} files? ${DIM}[y/n]${RESET} `);
  if (answer !== 'y' && answer !== 'yes') {
    console.log('\n' + DIM + '  Cancelled. No files were modified.' + RESET + '\n');
    return;
  }

  console.log('\n' + DIM + '  Fixing cover art type...\n' + RESET);

  let fixed  = 0;
  let failed = 0;

  for (const { file, imageData, imageFormat } of needsFix) {
    const rel     = path.relative(targetDir, file);
    const success = await fixFile(file, imageData, imageFormat);
    if (success) {
      console.log(`  ${GREEN}✓${RESET} ${DIM}${rel}${RESET}`);
      fixed++;
    } else {
      console.log(`  ${RED}✗${RESET} ${DIM}${rel}${RESET}  ${RED}write failed${RESET}`);
      failed++;
    }
  }

  console.log('\n' + DIM + '  ─────────────────────────────────────' + RESET);
  console.log(BOLD + '  Done' + RESET);
  console.log(`  ${GREEN}✓ Fixed   ${RESET}${BOLD}${fixed}${RESET}`);
  if (failed > 0) console.log(`  ${RED}✗ Failed  ${failed}${RESET}`);
  console.log();
  console.log(DIM + '  Copy the fixed files back to your USB drive and test in the Tahoe.' + RESET + '\n');
}

main().catch(err => {
  console.error('\n' + RED + '  Unexpected error: ' + err.message + RESET);
  process.exit(1);
});
