function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '')
}

export function parseScanOutput(lines) {
  const clean = lines.map(l => ({ ...l, clean: stripAnsi(l.data) }))
  const text = clean.map(l => l.clean).join('\n')
  if (!text.includes('Summary')) return null

  const extract = (label) => {
    const escaped = label.replace('#', '\\#').replace(' ', '\\s*')
    const m = text.match(new RegExp(`${escaped}\\s+[█░]+\\s+(\\d+)%\\s+\\((\\d+)\\/(\\d+)\\)`))
    if (!m) return null
    return { pct: parseInt(m[1]), have: parseInt(m[2]), total: parseInt(m[3]) }
  }

  const totalMatch = text.match(/Total files\s*:\s*(\d+)/)
  const drmMatch   = text.match(/(\d+)\s+M4P/)
  const files      = parseFileBlocks(clean)

  return {
    total: totalMatch ? parseInt(totalMatch[1]) : 0,
    drm:   drmMatch   ? parseInt(drmMatch[1])   : 0,
    tags: {
      title:  extract('Title'),
      artist: extract('Artist'),
      album:  extract('Album'),
      track:  extract('Track #'),
      year:   extract('Year'),
      cover:  extract('Cover art'),
      genre:  extract('Genre'),
    },
    files,
  }
}

function parseFileBlocks(cleanLines) {
  const files = []
  let current = null
  let inTags  = false
  let inSummary = false

  for (const { clean } of cleanLines) {
    const trimmed = clean.trim()

    // Stop parsing file blocks once we hit the summary section
    if (/^─+$/.test(trimmed) || /^Summary\s*$/.test(trimmed)) {
      if (current) { files.push(current); current = null }
      inSummary = true
      continue
    }

    if (inSummary) continue

    if (
      /\.(mp3|m4a|m4p)/i.test(trimmed) &&
      trimmed.includes('/') &&
      !/^(Rename|Status|Tags|Missing)\s*:/i.test(trimmed)
    ) {
      if (current) files.push(current)
      inTags = false

      const cleanPath = trimmed.replace(/\s*\[.*?\]\s*$/, '').trim()
      const parts     = cleanPath.split('/')
      const name      = parts[parts.length - 1]
      const artist    = parts.length >= 2 ? parts[0] : null
      const album     = parts.length >= 3 ? parts[parts.length - 2] : null
      const isDRM     = /\[M4P/i.test(trimmed)
      const isM4A     = /\[M4A\]/i.test(trimmed)

      current = {
        path: cleanPath, name, artist, album,
        status: 'complete', drm: isDRM, m4a: isM4A,
        tags: { title: null, artist: null, album: null, year: null, track: null, genre: null, cover: null },
        missing: [], rename: null,
      }
      continue
    }

    if (!current) continue

    const statusM = trimmed.match(/^Status\s*:\s*(.+)/i)
    if (statusM) {
      const s = statusM[1].toLowerCase()
      current.status = s.includes('complete') ? 'complete' : s.includes('partial') ? 'partial' : 'missing'
      inTags = false; continue
    }

    const tagsM = trimmed.match(/^Tags\s*:\s*(.*)/i)
    if (tagsM) { inTags = true; parseTagLine(tagsM[1], current.tags); continue }

    if (inTags && /[✓✗]/.test(trimmed) && !/^(Missing|Rename|Status)\s*:/i.test(trimmed)) {
      parseTagLine(trimmed, current.tags); continue
    }

    const missingM = trimmed.match(/^Missing\s*:\s*(.+)/i)
    if (missingM) { inTags = false; current.missing = missingM[1].split(',').map(s => s.trim()); continue }

    const renameM = trimmed.match(/^Rename\s*:\s*(.+)/i)
    if (renameM) { inTags = false; current.rename = renameM[1].trim(); continue }

    if (trimmed.length > 0 && !/[✓✗]/.test(trimmed)) inTags = false
  }

  if (current) files.push(current)
  return files
}

const TAG_MAP = {
  'title': 'title', 'artist': 'artist', 'album': 'album', 'year': 'year',
  'track #': 'track', 'track#': 'track', 'genre': 'genre', 'cover art': 'cover',
}

function parseTagLine(text, tags) {
  const pairs = text.match(/[✓✗]\s+(?:Cover art|Track #|Track#|Title|Artist|Album|Year|Genre)/gi) || []
  for (const pair of pairs) {
    const symbol = pair[0]
    const label  = pair.slice(2).trim().toLowerCase()
    const key    = TAG_MAP[label]
    if (key) tags[key] = symbol === '✓'
  }
}
