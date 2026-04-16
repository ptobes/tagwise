import { useState } from 'react'
import TagEditorPanel from './TagEditorPanel.jsx'

const COLS = [
  { key: 'title',    label: 'Track Name', width: '30%' },
  { key: 'trackNum', label: 'Track #',    width: '7%'  },
  { key: 'artist',   label: 'Artist',     width: '15%' },
  { key: 'album',    label: 'Album',      width: '13%' },
  { key: 'title',    label: 'Title',      width: '5%',  tag: 'title'  },
  { key: 'artist',   label: 'Artist',     width: '5%',  tag: 'artist' },
  { key: 'year',     label: 'Year',       width: '5%',  tag: 'year'   },
  { key: 'track',    label: 'Track#',     width: '6%',  tag: 'track'  },
  { key: 'cover',    label: 'Cover',      width: '5%',  tag: 'cover'  },
  { key: 'genre',    label: 'Genre',      width: '5%',  tag: 'genre'  },
]

const FILTERS = ['all', 'missing year', 'missing cover', 'missing genre', 'incomplete']

function countFilter(files, f) {
  if (f === 'missing year')  return files.filter(x => x.tags.year  === false).length
  if (f === 'missing cover') return files.filter(x => x.tags.cover === false).length
  if (f === 'missing genre') return files.filter(x => x.tags.genre === false).length
  if (f === 'incomplete')    return files.filter(x => x.status !== 'complete').length
  return files.length
}

function parseTrackNum(t) {
  if (!t) return Infinity
  const n = parseInt(t.split('/')[0])
  return isNaN(n) ? Infinity : n
}

function sortFiles(files, sortKey, sortDir, tagValues, directory) {
  // Default load order: Artist → Album → Track# (numeric)
  if (sortKey === '_default') {
    return [...files].sort((a, b) => {
      const aArtist = getTagVal(a, 'artist', tagValues, directory) || a.artist || ''
      const bArtist = getTagVal(b, 'artist', tagValues, directory) || b.artist || ''
      const artistCmp = aArtist.localeCompare(bArtist)
      if (artistCmp !== 0) return artistCmp
      const aAlbum = getTagVal(a, 'album', tagValues, directory) || a.album || ''
      const bAlbum = getTagVal(b, 'album', tagValues, directory) || b.album || ''
      const albumCmp = aAlbum.localeCompare(bAlbum)
      if (albumCmp !== 0) return albumCmp
      const aTrack = parseTrackNum(tagValues[directory + '/' + a.path]?.track)
      const bTrack = parseTrackNum(tagValues[directory + '/' + b.path]?.track)
      return aTrack - bTrack
    })
  }
  return [...files].sort((a, b) => {
    const av = getSortVal(a, sortKey, tagValues, directory)
    const bv = getSortVal(b, sortKey, tagValues, directory)
    const primary = av.localeCompare(bv) * sortDir
    if (primary !== 0) return primary
    if (sortKey === 'artist') {
      const aAlbum = getTagVal(a, 'album', tagValues, directory)
      const bAlbum = getTagVal(b, 'album', tagValues, directory)
      const albumCmp = aAlbum.localeCompare(bAlbum)
      if (albumCmp !== 0) return albumCmp
    }
    return getTagVal(a, 'title', tagValues, directory).localeCompare(getTagVal(b, 'title', tagValues, directory))
  })
}

function getTagVal(file, key, tagValues, directory) {
  const fullPath = directory + '/' + file.path
  return tagValues?.[fullPath]?.[key] || ''
}

function getSortVal(file, sortKey, tagValues, directory) {
  if (sortKey === 'title')  return getTagVal(file, 'title',  tagValues, directory) || file.name
  if (sortKey === 'artist') return getTagVal(file, 'artist', tagValues, directory) || file.artist || ''
  if (sortKey === 'album')  return getTagVal(file, 'album',  tagValues, directory) || file.album  || ''
  return ''
}

export default function FileTable({ files, directory, tagValues = {}, onSaved }) {
  const [filter, setFilter]     = useState('all')
  const [sortKey, setSortKey]   = useState('_default')
  const [sortDir, setSortDir]   = useState(1)
  const [selected, setSelected] = useState(null)

  if (!files || files.length === 0) return null

  const filtered = files.filter(f => {
    if (filter === 'all')           return true
    if (filter === 'missing year')  return f.tags.year  === false
    if (filter === 'missing cover') return f.tags.cover === false
    if (filter === 'missing genre') return f.tags.genre === false
    if (filter === 'incomplete')    return f.status !== 'complete'
    return true
  })

  const sorted = sortFiles(filtered, sortKey, sortDir, tagValues, directory)
  const hasTags = Object.keys(tagValues).length > 0

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(1) }
  }

  const tagDot = (val) => {
    if (val === null)  return <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
    if (val === true)  return <span style={{ color: 'var(--text-green)', fontSize: '12px' }}>✓</span>
    return                    <span style={{ color: 'var(--text-red)',   fontSize: '12px' }}>✗</span>
  }

  const sortable = ['title', 'artist', 'album']

  return (
    <>
      <div style={{ marginTop: '28px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
              border: filter === f ? '1px solid var(--accent)' : '1px solid var(--border-mid)',
              background: filter === f ? 'var(--accent-dim)' : 'transparent',
              color: filter === f ? 'var(--text-amber)' : 'var(--text-secondary)',
            }}>
              {f}{f !== 'all' && <span style={{ marginLeft: '5px', color: 'var(--text-muted)' }}>({countFilter(files, f)})</span>}
            </button>
          ))}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {sorted.length} / {files.length} files
          </span>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
            {COLS.map((col, i) => (
              <div key={i}
                onClick={() => !col.tag && sortable.includes(col.key) && handleSort(col.key)}
                style={{
                  width: col.width, flexShrink: 0, padding: '8px 8px',
                  fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '.06em',
                  textTransform: 'uppercase', userSelect: 'none',
                  color: !col.tag && sortKey === col.key ? 'var(--text-amber)' : 'var(--text-muted)',
                  cursor: !col.tag && sortable.includes(col.key) ? 'pointer' : 'default',
                  textAlign: col.tag ? 'center' : 'left',
                }}>
                {col.label}
                {!col.tag && sortKey === col.key && <span style={{ marginLeft: '3px' }}>{sortDir === 1 ? '↑' : '↓'}</span>}
              </div>
            ))}
          </div>

          <div style={{ maxHeight: '440px', overflowY: 'auto' }}>
            {sorted.map((file, i) => {
              const isSelected = selected?.path === file.path
              const rowBg = isSelected ? 'var(--accent-dim)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
              const fullPath = directory + '/' + file.path
              const tv = tagValues[fullPath] || {}
              const trackName = tv.title  || file.name
              const artist    = tv.artist || file.artist || '—'
              const album     = tv.album  || file.album  || '—'
              const trackNum  = tv.track  || '—'

              return (
                <div key={i}
                  onClick={() => setSelected(isSelected ? null : file)}
                  style={{
                    display: 'flex', alignItems: 'center', cursor: 'pointer',
                    borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                    background: rowBg,
                    borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = rowBg }}
                >
                  <div style={{ width: '30%', flexShrink: 0, padding: '7px 8px', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {file.drm && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', padding: '1px 5px', background: 'rgba(208,96,96,0.2)', color: 'var(--text-red)', border: '1px solid rgba(208,96,96,0.3)', borderRadius: '3px', flexShrink: 0 }}>DRM — Read Only</span>}
                    {file.m4a && !file.drm && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', padding: '1px 5px', background: 'rgba(96,144,208,0.2)', color: 'var(--text-blue)', border: '1px solid rgba(96,144,208,0.3)', borderRadius: '3px', flexShrink: 0 }}>M4A</span>}
                    <div title={trackName} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: hasTags ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {trackName}
                    </div>
                  </div>
                  <div style={{ width: '7%', flexShrink: 0, padding: '7px 8px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {trackNum}
                    </div>
                  </div>
                  <div style={{ width: '15%', flexShrink: 0, padding: '7px 8px', overflow: 'hidden' }}>
                    <div title={artist} style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {artist}
                    </div>
                  </div>
                  <div style={{ width: '13%', flexShrink: 0, padding: '7px 8px', overflow: 'hidden' }}>
                    <div title={album} style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {album}
                    </div>
                  </div>
                  {['title','artist','year','track','cover','genre'].map(t => (
                    <div key={t} style={{ width: t === 'track' ? '6%' : '5%', flexShrink: 0, textAlign: 'center', padding: '7px 4px' }}>
                      {tagDot(file.tags[t])}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {selected && (
        <TagEditorPanel
          file={selected}
          directory={directory}
          onClose={() => setSelected(null)}
          onSaved={(file, values) => { setSelected(null); onSaved?.(file, values) }}
        />
      )}
    </>
  )
}
