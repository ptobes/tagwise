import { useState, useEffect } from 'react'
import { useScript } from '../hooks/useScript.js'
import { parseScanOutput } from '../lib/parseOutput.js'
import Terminal from './Terminal.jsx'
import FileTable from './FileTable.jsx'

const v    = { padding: '40px 32px', maxWidth: '960px' }
const hdr  = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }
const btnP = { fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, padding: '8px 18px', background: 'var(--accent)', color: '#0f0f0e', borderRadius: 'var(--radius-sm)', letterSpacing: '.04em', cursor: 'pointer', border: 'none' }
const btnS = { fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '8px 14px', border: '1px solid var(--border-mid)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'transparent' }

const TAG_ROWS = [
  { key: 'title',  label: 'Title'  },
  { key: 'artist', label: 'Artist' },
  { key: 'album',  label: 'Album'  },
  { key: 'track',  label: 'Track#' },
  { key: 'year',   label: 'Year'   },
  { key: 'cover',  label: 'Cover'  },
  { key: 'genre',  label: 'Genre'  },
]

export default function ScanView({ directory, onPickDir }) {
  const { run, lines, status, clear } = useScript()
  const [tagValues, setTagValues]     = useState({})
  const [filesState, setFilesState]   = useState(null)
  const [loadingTags, setLoadingTags] = useState(false)
  const [showOutput, setShowOutput]   = useState(false)

  const scanData = parseScanOutput(lines)

  const handleSaved = (file, values) => {
    const fullPath = directory + '/' + file.path
    const nonEmpty = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''))
    setTagValues(prev => ({
      ...prev,
      [fullPath]: { ...prev[fullPath], ...nonEmpty }
    }))
    setFilesState(prev => {
      if (!prev) return prev
      return prev.map(f => {
        if (f.path !== file.path) return f
        const updated = { ...f, tags: { ...f.tags } }
        if (values.title  !== undefined && values.title  !== '') updated.tags.title  = true
        if (values.artist !== undefined && values.artist !== '') updated.tags.artist = true
        if (values.album  !== undefined && values.album  !== '') updated.tags.album  = true
        if (values.year   !== undefined && values.year   !== '') updated.tags.year   = true
        if (values.track  !== undefined && values.track  !== '') updated.tags.track  = true
        if (values.genre  !== undefined && values.genre  !== '') updated.tags.genre  = true
        return updated
      })
    })
  }
  const tags = scanData?.tags ?? {}

  // Batch-read ID3 tag values after scan completes
  useEffect(() => {
    if (status !== 'done' || !scanData?.files?.length || !directory) return
    setLoadingTags(true)
    const filePaths = scanData.files.map(f => directory + '/' + f.path)
    window.tagwise.readTagsBatch(filePaths).then(results => {
      setTagValues(results)
      setFilesState(scanData.files)
      setLoadingTags(false)
    })
  }, [status])

  // Clear tag values when scan is cleared
  const handleClear = () => {
    clear()
    setTagValues({})
  }

  const color = (pct) =>
    pct === 100 ? 'var(--text-green)' :
    pct >= 95   ? 'var(--text-green)' :
    pct >= 70   ? 'var(--text-amber)' : 'var(--text-red)'

  return (
    <div style={v}>
      <div style={hdr}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, letterSpacing: '.02em' }}>Scan</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Report tag health across your music folder</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {lines.length > 0 && status !== 'running' && <button style={btnS} onClick={handleClear}>Clear</button>}
          <button
            style={{ ...btnP, opacity: (!directory || status === 'running') ? 0.4 : 1 }}
            onClick={() => directory && run('tagwise-scan.js', [directory])}
            disabled={!directory || status === 'running'}
          >
            {status === 'running' ? 'Scanning…' : 'Run Scan'}
          </button>
        </div>
      </div>

      {!directory && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '80px 0' }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>No folder selected.</p>
          <button style={btnP} onClick={onPickDir}>Select Music Folder</button>
        </div>
      )}

      {scanData && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '18px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '36px', fontWeight: 500, lineHeight: 1 }}>{scanData.total}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>files scanned</span>
            {scanData.drm > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '2px 8px', background: 'rgba(208,96,96,0.2)', color: 'var(--text-red)', border: '1px solid rgba(208,96,96,0.3)', borderRadius: 'var(--radius-sm)' }}>
                {scanData.drm} DRM — Read Only
              </span>
            )}
            {loadingTags && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>reading tags…</span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '8px' }}>
            {TAG_ROWS.map(({ key, label }) => {
              const t = tags[key]; if (!t) return null
              const c = color(t.pct)
              return (
                <div key={key} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: '5px' }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 500, lineHeight: 1, color: c, marginBottom: '7px' }}>{t.pct}%</div>
                  <div style={{ height: '2px', background: 'var(--border)', borderRadius: '1px', marginBottom: '5px' }}>
                    <div style={{ height: '100%', width: `${t.pct}%`, background: c, borderRadius: '1px', transition: 'width .6s ease' }} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>{t.have}/{t.total}</div>
                </div>
              )
            })}
          </div>

          <FileTable files={filesState || scanData.files} directory={directory} tagValues={tagValues} onSaved={handleSaved} />
        </div>
      )}

      {lines.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <button
            onClick={() => setShowOutput(v => !v)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              color: 'var(--text-muted)', background: 'transparent',
              border: 'none', cursor: 'pointer', padding: '0',
              letterSpacing: '.04em',
            }}
          >
            {showOutput ? '▾ hide output' : '▸ show output'}
            {status === 'running' && <span style={{ marginLeft: '8px', color: 'var(--text-amber)' }}>▮</span>}
            {status === 'error'   && <span style={{ marginLeft: '8px', color: 'var(--text-red)' }}>exit ≠ 0</span>}
          </button>
          {showOutput && <div style={{ marginTop: '8px' }}><Terminal lines={lines} status={status} /></div>}
        </div>
      )}
    </div>
  )
}
