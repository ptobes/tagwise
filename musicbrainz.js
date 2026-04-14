/**
 * Tagwise — MusicBrainz Lookup Module
 *
 * Looks up missing Year and Cover Art tags using the MusicBrainz API,
 * with iTunes Search API as a cover art fallback.
 *
 * Usage:
 *   const mb = require('./musicbrainz');
 *   const result = await mb.lookupAlbum('Led Zeppelin', 'Presence');
 *
 * Requires: npm install axios
 */

const axios = require('axios');
const https = require('https');

const USER_AGENT = 'Tagwise/0.1 (your-email@example.com)';
const MB_BASE    = 'https://musicbrainz.org';
const CAA_BASE   = 'https://coverartarchive.org';

// Reuse HTTPS agent to avoid repeated TLS handshakes
const httpsAgent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });

const client = axios.create({
  httpsAgent,
  headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
  timeout: 15000,
});

// ─── Rate-limited request queue ──────────────────────────────────────────────

let lastRequestTime = 0;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimitedGet(url, retries = 1) {
  const now     = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 2000) await wait(2000 - elapsed);
  lastRequestTime = Date.now();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await client.get(url);
      return res.data;
    } catch (err) {
      const code = err.code || (err.response ? `HTTP ${err.response.status}` : 'unknown');
      const retriable = !err.response || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
      if (retriable && attempt < retries) {
        const delaySecs = attempt === 1 ? 10 : attempt * 10;
        console.log(`  Connection error (${code}), waiting ${delaySecs}s before retry (attempt ${attempt}/${retries})...`);
        await wait(delaySecs * 1000);
      } else {
        throw new Error(`Request failed (${code}): ${url}`);
      }
    }
  }
}

// ─── Cover Art Archive ────────────────────────────────────────────────────────

async function getCoverArtUrlCAA(releaseId) {
  try {
    const res = await client.head(`${CAA_BASE}/release/${releaseId}/front`, {
      maxRedirects: 0,
      validateStatus: s => s < 400,
    });
    if (res.status === 307 || res.status === 302) {
      return res.headers.location || null;
    }
    return null;
  } catch (err) {
    if (err.response?.status === 404) return null;
    // axios throws on 3xx when maxRedirects=0 — extract location from error
    if (err.response?.headers?.location) return err.response.headers.location;
    return null;
  }
}

async function findCoverArtCAA(primaryReleaseId, candidates) {
  const primaryUrl = await getCoverArtUrlCAA(primaryReleaseId);
  if (primaryUrl) return primaryUrl;

  for (const candidate of candidates) {
    if (candidate.id === primaryReleaseId || candidate.score < 70) continue;
    await wait(1500);
    const url = await getCoverArtUrlCAA(candidate.id);
    if (url) {
      console.log(`  Cover art found on alternate release: ${candidate.date || 'unknown date'}`);
      return url;
    }
  }
  return null;
}

// ─── iTunes cover art fallback ────────────────────────────────────────────────

async function getCoverArtUrliTunes(artist, album) {
  try {
    const term = encodeURIComponent(`${artist} ${album}`);
    const res  = await client.get(`https://itunes.apple.com/search?term=${term}&entity=album&limit=5`);
    const results = res.data.results || [];
    if (results.length === 0) return null;

    const albumLower = album.toLowerCase();
    const match = results.find(r => r.collectionName?.toLowerCase().includes(albumLower)) || results[0];
    if (!match?.artworkUrl100) return null;

    return match.artworkUrl100.replace('100x100bb', '600x600bb');
  } catch {
    return null;
  }
}

// ─── Find cover art — CAA first, iTunes fallback ──────────────────────────────

async function findCoverArt(primaryReleaseId, candidates, artist, album) {
  const caaUrl = await findCoverArtCAA(primaryReleaseId, candidates);
  if (caaUrl) {
    console.log(`  Cover art source: Cover Art Archive`);
    return caaUrl;
  }

  console.log(`  Cover Art Archive: no results — trying iTunes...`);
  const itunesUrl = await getCoverArtUrliTunes(artist, album);
  if (itunesUrl) {
    console.log(`  Cover art source: iTunes`);
    return itunesUrl;
  }

  return null;
}

// ─── Download helper ──────────────────────────────────────────────────────────

async function downloadImage(imageUrl) {
  try {
    const res = await client.get(imageUrl, { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
  } catch {
    return null;
  }
}

// ─── Main public API ──────────────────────────────────────────────────────────

async function lookupAlbum(artist, album) {
  console.log(`  Searching MusicBrainz: "${artist}" — "${album}"...`);

  const query = encodeURIComponent(`artist:"${artist}" AND release:"${album}"`);
  const data  = await rateLimitedGet(`${MB_BASE}/ws/2/release/?query=${query}&limit=10&fmt=json`);
  const allCandidates = data.releases || [];

  const release = (() => {
    const confident = allCandidates.filter(r => r.score >= 70);
    if (confident.length === 0) return null;
    const official  = confident.filter(r => r.status === 'Official');
    const pool      = official.length > 0 ? official : confident;
    const withDate  = pool.filter(r => r.date && /^\d{4}/.test(r.date));
    if (withDate.length > 0) {
      withDate.sort((a, b) => a.date.localeCompare(b.date));
      return withDate[0];
    }
    return pool.reduce((a, b) => (b.score > a.score ? b : a));
  })();

  if (!release) return { found: false, artist, album };

  const year        = release.date ? parseInt(release.date.slice(0, 4), 10) : null;
  const coverArtUrl = await findCoverArt(release.id, allCandidates, artist, album);

  return {
    found:       true,
    score:       release.score,
    releaseId:   release.id,
    artist:      release['artist-credit']?.[0]?.name || artist,
    album:       release.title || album,
    year:        isNaN(year) ? null : year,
    coverArtUrl: coverArtUrl,
  };
}

async function lookupAlbumGroup(artist, album, files) {
  const result = await lookupAlbum(artist, album);

  if (!result.found) {
    console.log(`  No match found for "${artist}" — "${album}"`);
    return { found: false, files: [] };
  }

  console.log(`  Matched: "${result.artist}" — "${result.album}" (${result.year || 'year unknown'}) [score: ${result.score}]`);
  if (result.coverArtUrl) console.log(`  Cover art: ${result.coverArtUrl}`);
  else                    console.log(`  Cover art: not found`);

  return {
    found:       true,
    score:       result.score,
    releaseId:   result.releaseId,
    year:        result.year,
    coverArtUrl: result.coverArtUrl,
    files: files.map(f => ({
      file:        f.file,
      currentTags: f.tags,
      proposed:    { year: result.year, cover: result.coverArtUrl ? 'available' : null },
      coverArtUrl: result.coverArtUrl,
      releaseId:   result.releaseId,
    })),
  };
}

async function lookupMissingTags(scanResults) {
  const needsLookup = scanResults.filter(r => r.tags && (!r.tags.year || !r.tags.cover));
  if (needsLookup.length === 0) { console.log('  All files already have Year and Cover art tags.'); return []; }

  const groups = {};
  for (const r of needsLookup) {
    const key = `${r.tags.artist || 'Unknown'}|||${r.tags.album || 'Unknown'}`;
    if (!groups[key]) groups[key] = { artist: r.tags.artist, album: r.tags.album, files: [] };
    groups[key].files.push(r);
  }

  const albumGroups = Object.values(groups);
  console.log(`\n  Found ${needsLookup.length} files across ${albumGroups.length} albums needing lookup.\n`);

  const allResults = [];
  for (const group of albumGroups) {
    const result = await lookupAlbumGroup(group.artist, group.album, group.files);
    allResults.push({ artist: group.artist, album: group.album, ...result });
    console.log();
  }
  return allResults;
}

module.exports = {
  lookupAlbum,
  lookupAlbumGroup,
  lookupMissingTags,
  getCoverArtUrlCAA,
  getCoverArtUrliTunes,
  downloadImage,
};
