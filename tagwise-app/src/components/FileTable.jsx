import { useState } from 'react'
import TagEditorPanel from './TagEditorPanel.jsx'

const COLS = [
  { key: 'name',   label: 'File',   width: '41%' },
  { key: 'artist', label: 'Artist', width: '13%' },
  { key: 'album',  label: 'Album',  width: '15%' },
  { key: 'title',  label: 'Title',  width: '5%',  tag: 'title'  },
  { key: 'artist', label: 'Artist', width: '5%',  tag: 'artist' },
  { key: 'year',   label: 'Year',   width: '5%',  tag: 'year'   },
  { key: 'track',  label: 'Track#', width: '6%',  tag: 'track'  },
  { key: 'cover',  label: 'Cover',  width: '5%',  tag: 'cover'  },
  { key: 'genre',  label: 'Genre',  width: '5%',  tag: 'genre'  },
]

const FILTERS = ['all', 'missing year', 'missing cover', 'missing genre', 'incomplete']

function countFilter(files, f) {
  if (f === 'missing year')  return files.filter(x => x.tags.year  === false).length
  if (f === 'missing cover') return files.filter(x => x.tags.cover === false).length
  if (f === 'missing genre') return files.filter(x => x.tags.genre === false).length
  if (f === 'incomplete')    return files.filter(x => x.status !== 'complete').length
  return files.length
}

function sortFiles(files, sortKey, sortDir) {
  return [...files].sort((a, b) => {
    const av = getSortVal(a, sortKey)
    const bv = getSortVal(b, sortKey)
    const primary = av.localeCompare(bv) * sortDir
    if (primary !== 0) return primary
    if (sortKey === 'artist') {
      const albumCmp = (a.album ?? '').localeCompare(b.album ?? '')
      if (albumCmp !== 0) return albumCmp
      return a.name.localeCompare(b.name)
    }
    if (sortKey === 'album') return a.name.localeCompare(b.name)
    return (a.artist ?? '').localeCompare(b.artist ?? '')
  })
}

function getSortVal(file, key) {
  if (key === 'name')   return file.name   ?? ''
  if (key === 'artist') return file.artist ?? ''
  if (key === 'album')  return file.album  ?? ''
  return ''
}

export default function FileTable({ files, directory }) {
  const [filter, setFilter]     = useState('all')
  const [sortKey, setSortKey]   = useState('artist')
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

  const sorted = sortFiles(filtered, sortKey, sortDir)

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(1) }
  }

  const tagDot = (val) => {
    if (val === null)  return <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
    if (val === true)  return <span style={{ color: 'var(--text-green)', fontSize: '12px' }}>✓</span>
    return                    <span style={{ color: 'var(--text-red)',   fontSize: '12px' }}>✗</span>
  }

  const sortable = ['name', 'artist', 'album']

  return (
    <>
      <div style={{ marginTop: '28px' }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
              border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border-mid)'}`,
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

        {/* Table */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
            {COLS.map((col, i) => (
              <div key={`${col.key}-${i}`}
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
                {!col.tag && sortKey === col.key && (
                  <span style={{ marginLeft: '3px' }}>{sortDir === 1 ? '↑' : '↓'}</span>
                )}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ maxHeight: '440px', overflowY: 'auto' }}>
            {sorted.map((file, i) => {
              const isSelected = selected?.path === file.path
              const rowBg = isSelected
                ? 'var(--accent-dim)'
                : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'

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
                  {/* File name */}
                  <div style={{ width: '41%', flexShrink: 0, padding: '7px 8px', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {file.drm && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', padding: '1px 5px', background: 'rgba(208,96,96,0.2)', color: 'var(--text-red)', border: '1px solid rgba(208,96,96,0.3)', borderRadius: '3px', flexShrink: 0, letterSpacing: '.03em' }}>DRM — Read Only</span>
                    )}
                    {file.m4a && !file.drm && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', padding: '1px 5px', background: 'rgba(96,144,208,0.2)', color: 'var(--text-blue)', border: '1px solid rgba(96,144,208,0.3)', borderRadius: '3px', flexShrink: 0, letterSpacing: '.03em' }}>M4A</span>
                    )}
                    <div title={file.name} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.name}
                    </div>
                  </div>

                  {/* Artist */}
                  <div style={{ width: '13%', flexShrink: 0, padding: '7px 8px', overflow: 'hidden' }}>
                    <div title={file.artist ?? ''} style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.artist ?? '—'}
                    </div>
                  </div>

                  {/* Album */}
                  <div style={{ width: '15%', flexShrink: 0, padding: '7px 8px', overflow: 'hidden' }}>
                    <div title={file.album ?? ''} style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.album ?? '—'}
                    </div>
                  </div>

                  {/* Tag dots */}
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
          onSaved={() => setSelected(null)}
        />
      )}
    </>
  )
}
