/**
 * Tagwise — Discogs Lookup Module
 *
 * Looks up missing Year and Cover Art tags using the Discogs API.
 * Particularly strong for electronic, hip-hop, jazz, and indie labels.
 *
 * Usage:
 *   const discogs = require('./discogs');
 *   const result  = await discogs.lookupAlbum('Kruder & Dorfmeister', 'Amsterdam Dub Sessions');
 *
 * Requires: npm install axios
 *
 * No API key needed for basic search — but registering a free Discogs
 * app at https://www.discogs.com/settings/developers gives you a higher
 * rate limit (60 req/min vs 25 req/min unauthenticated).
 *
 * To use a key, set env var: DISCOGS_TOKEN=your_token_here
 */

const axios = require('axios');
const https = require('https');

const USER_AGENT  = 'Tagwise/0.1 +https://github.com/your-username/tagwise';
const BASE_URL    = 'https://api.discogs.com';
const TOKEN       = process.env.DISCOGS_TOKEN || null;

const httpsAgent = new https.Agent({ keepAlive: true });

const client = axios.create({
  httpsAgent,
  headers: {
    'User-Agent': USER_AGENT,
    'Accept':     'application/vnd.discogs.v2.discogs+json',
    ...(TOKEN ? { 'Authorization': `Discogs token=${TOKEN}` } : {}),
  },
  timeout: 15000,
});

// ─── Rate limiting ────────────────────────────────────────────────────────────

let lastRequestTime = 0;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Unauthenticated: 25 req/min → ~2.5s gap. With token: 60 req/min → ~1.1s gap.
const RATE_GAP = TOKEN ? 1200 : 2600;

async function rateLimitedGet(url, retries = 3) {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < RATE_GAP) await wait(RATE_GAP - elapsed);
  lastRequestTime = Date.now();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await client.get(url);
      return res.data;
    } catch (err) {
      const status   = err.response?.status;
      const code     = err.code || `HTTP ${status}`;
      const retriable = !err.response || err.code === 'ECONNRESET' || status === 429 || status >= 500;

      if (status === 429) {
        // Rate limited — wait longer
        const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '60', 10);
        console.log(`  Discogs rate limit hit — waiting ${retryAfter}s...`);
        await wait(retryAfter * 1000);
      } else if (retriable && attempt < retries) {
        console.log(`  Discogs connection error (${code}), retrying in ${attempt * 3}s...`);
        await wait(attempt * 3000);
      } else {
        throw new Error(`Discogs request failed (${code}): ${url}`);
      }
    }
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Search Discogs for a master release matching artist + album.
 * Master releases represent the original version of an album,
 * separate from individual pressings/reissues.
 */
async function searchMaster(artist, album) {
  // Search for master releases first (most authoritative)
  const query = encodeURIComponent(`${artist} ${album}`);
  const url   = `${BASE_URL}/database/search?q=${query}&type=master&per_page=5`;

  const data    = await rateLimitedGet(url);
  const results = data.results || [];

  if (results.length === 0) return null;

  // Score results by how well they match artist + album
  // Strip punctuation for fuzzy matching (handles Discogs asterisks, ampersands etc.)
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

  const artistNorm = normalize(artist);
  const albumNorm  = normalize(album);

  const scored = results.map(r => {
    let score = 0;
    const title      = (r.title || '').toLowerCase();
    const titleNorm  = normalize(r.title || '');
    const titleParts = title.split(' - ');
    const artistPart = normalize(titleParts[0] || '');
    const albumPart  = normalize(titleParts.slice(1).join(' - ') || '');

    // Match normalized artist and album separately against title parts
    if (artistPart.includes(artistNorm) || artistNorm.includes(artistPart)) score += 3;
    if (albumPart.includes(albumNorm)   || albumNorm.includes(albumPart))   score += 3;

    // Fallback: check full normalized title
    if (titleNorm.includes(artistNorm)) score += 1;
    if (titleNorm.includes(albumNorm))  score += 1;

    // Prefer results with cover art
    if (r.cover_image && !r.cover_image.includes('spacer.gif')) score += 1;

    return { ...r, _score: score };
  });

  scored.sort((a, b) => b._score - a._score);

  // Only return if we have a reasonably confident match
  return scored[0]._score >= 2 ? scored[0] : null;
}

/**
 * Fetch full master release details by Discogs master ID.
 * Returns year and other metadata.
 */
async function getMasterDetails(masterId) {
  const url  = `${BASE_URL}/masters/${masterId}`;
  return rateLimitedGet(url);
}

// ─── Cover art ────────────────────────────────────────────────────────────────

/**
 * Extract the best cover art URL from a Discogs search result or master.
 * Discogs provides image URLs directly in the response — no separate lookup needed.
 */
function extractCoverArt(result) {
  // Check images array first (full resolution)
  if (result.images && result.images.length > 0) {
    const front = result.images.find(img => img.type === 'primary') || result.images[0];
    if (front?.uri && !front.uri.includes('spacer')) return front.uri;
  }

  // Fall back to cover_image from search results (thumbnail but usable)
  if (result.cover_image && !result.cover_image.includes('spacer.gif')) {
    return result.cover_image;
  }

  return null;
}

// ─── Main public API ──────────────────────────────────────────────────────────

/**
 * Look up an album on Discogs by artist + album name.
 *
 * Returns:
 * {
 *   found:       true/false,
 *   source:      'discogs',
 *   masterId:    Discogs master release ID,
 *   artist:      string,
 *   album:       string,
 *   year:        number or null,
 *   genre:       string or null,
 *   coverArtUrl: string or null,
 * }
 */
async function lookupAlbum(artist, album) {
  console.log(`  Searching Discogs: "${artist}" — "${album}"...`);

  let master;
  try {
    master = await searchMaster(artist, album);
  } catch (err) {
    console.log(`  Discogs search error: ${err.message}`);
    return { found: false, source: 'discogs', artist, album };
  }

  if (!master) {
    console.log(`  Discogs: no match found`);
    return { found: false, source: 'discogs', artist, album };
  }

  // Try to get full master details for better image URLs
  let details = master;
  if (master.master_id || master.id) {
    try {
      const id = master.master_id || master.id;
      details  = await getMasterDetails(id);
    } catch {
      // Fall back to search result data
      details = master;
    }
  }

  const year       = details.year || master.year || null;
  const coverArtUrl = extractCoverArt(details) || extractCoverArt(master);
  const genres     = details.genres || master.genre || [];
  const genre      = Array.isArray(genres) ? genres[0] : genres || null;

  // Parse artist name from "Artist - Album" title format if needed
  const titleParts = (master.title || '').split(' - ');
  const resolvedArtist = titleParts.length > 1 ? titleParts[0].trim() : artist;
  const resolvedAlbum  = titleParts.length > 1 ? titleParts.slice(1).join(' - ').trim() : album;

  if (year || coverArtUrl) {
    const yearStr  = year        ? `year: ${year}`          : 'year: not found';
    const coverStr = coverArtUrl ? 'cover: found'           : 'cover: not found';
    console.log(`  Discogs matched: "${resolvedArtist}" — "${resolvedAlbum}"  ${yearStr}  ${coverStr}`);
  }

  return {
    found:       !!(year || coverArtUrl),
    source:      'discogs',
    masterId:    master.master_id || master.id || null,
    artist:      resolvedArtist,
    album:       resolvedAlbum,
    year:        year   ? parseInt(year, 10) : null,
    genre:       genre,
    coverArtUrl: coverArtUrl,
  };
}

/**
 * Download cover art image as a Buffer, given a URL string.
 */
async function downloadImage(imageUrl) {
  try {
    const res = await client.get(imageUrl, { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
  } catch {
    return null;
  }
}

module.exports = {
  lookupAlbum,
  downloadImage,
};
