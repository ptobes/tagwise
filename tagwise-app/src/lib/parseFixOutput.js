function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '')
}

export function parseFixOutput(lines) {
  const text = lines.map(l => stripAnsi(l.data)).join('\n')
  if (!text.includes('Proposed changes')) return null

  const albums = []
  const sections = text.split('\n\n').filter(s => (s.includes('tracks)') || s.includes('track)')))

  for (const section of sections) {
    const sectionLines = section.split('\n').map(l => l.trim()).filter(Boolean)
    if (!sectionLines.length) continue

    const headerMatch = sectionLines[0].match(/^(.+?)\s+\u2014\s+(.+?)\s+\((\d+) tracks?\)/)
    if (!headerMatch) continue

    const artist     = headerMatch[1].trim()
    const album      = headerMatch[2].trim()
    const trackCount = parseInt(headerMatch[3])

    let year     = null
    let hasCover = false
    const files  = []
    let currentFile = null

    for (let i = 1; i < sectionLines.length; i++) {
      const line = sectionLines[i]
      if (/\.(mp3|m4a|m4p)$/i.test(line)) {
        currentFile = line.split('/').pop()
        files.push({ name: currentFile, year: null, cover: false })
      } else if (line.startsWith('year')) {
        const y = line.match(/year \u2192 (\d{4})/)
        if (y) {
          year = y[1]
          if (files.length) files[files.length - 1].year = y[1]
        }
      } else if (line.includes('cover art')) {
        hasCover = true
        if (files.length) files[files.length - 1].cover = true
      }
    }

    albums.push({ artist, album, trackCount, year, hasCover, files })
  }

  const totalMatch = text.match(/(\d+) files? will be updated/)
  const totalFiles = totalMatch ? parseInt(totalMatch[1]) : 0
  const ready = text.includes('Apply these changes?')

  return { albums, totalFiles, ready }
}

export function parseFixProgress(lines) {
  const results = []
  for (const { data } of lines) {
    const clean = stripAnsi(data)
    const ok = clean.trim().startsWith('\u2713')
    const fail = clean.trim().startsWith('\u2717')
    if (!ok && !fail) continue
    const match = clean.match(/[✓✗]\s+(.+?)\s+\u2014\s+(.+?)(?:\s+year:\s+(\d{4}))?(?:\s+cover:\s+(\w+))?/)
    if (match) {
      results.push({
        ok,
        artist: match[1].trim(),
        album:  match[2].trim(),
        year:   match[3] || null,
        cover:  match[4] || null,
      })
    }
  }
  return results
}
