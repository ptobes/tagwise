import { useState, useEffect, useRef, useCallback } from 'react'

const FIELDS = [
  { key: 'title',  label: 'Title',  id3: 'title'       },
  { key: 'artist', label: 'Artist', id3: 'artist'      },
  { key: 'album',  label: 'Album',  id3: 'album'       },
  { key: 'year',   label: 'Year',   id3: 'year'        },
  { key: 'track',  label: 'Track#', id3: 'trackNumber' },
  { key: 'genre',  label: 'Genre',  id3: 'genre'       },
]

function buildRenamePreview(values) {
  const track  = values.track  ? String(values.track).padStart(2, '0') : null
  const title  = values.title  || null
  const album  = values.album  || null
  const artist = values.artist || null
  const parts  = [track, title, album, artist].filter(Boolean)
  return parts.length ? parts.join(' - ') + '.mp3' : '—'
}

export default function TagEditorPanel({ file, directory, onClose, onSaved }) {
  const [values, setValues]     = useState({})
  const [coverUrl, setCoverUrl] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState(null)
  const [dragging, setDragging] = useState(false)

  const fullPath = directory + '/' + file.path

  // Load real tags + cover art from file on open
  useEffect(() => {
    if (!file) return
    setSaveMsg(null)
    setCoverUrl(null)
    setValues({})
    setLoading(true)

    Promise.all([
      window.tagwise.readTags(fullPath),
      window.tagwise.readCoverArt(fullPath),
    ]).then(([tags, cover]) => {
      setValues({
        title:  tags.title  || '',
        artist: tags.artist || '',
        album:  tags.album  || '',
        year:   tags.year   || '',
        track:  tags.track  || '',
        genre:  tags.genre  || '',
      })
      if (cover?.dataUrl) setCoverUrl(cover.dataUrl)
      setLoading(false)
    })
  }, [file.path, directory])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Paste image from clipboard
  useEffect(() => {
    const handler = (e) => {
      const item = [...(e.clipboardData?.items ?? [])].find(i => i.type.startsWith('image/'))
      if (item) handleImageFile(item.getAsFile())
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [])

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }))
    setSaveMsg(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    const id3Tags = {}
    for (const f of FIELDS) {
      id3Tags[f.id3] = String(values[f.key] ?? '')
    }
    const result = await window.tagwise.writeTags(fullPath, id3Tags)
    setSaving(false)
    setSaveMsg(result.ok
      ? { ok: true,  text: 'Tags saved.' }
      : { ok: false, text: result.error || 'Save failed.' }
    )
    if (result.ok) { console.log("[onSaved] values:", values); onSaved?.(file, values) }
  }

  const handleImageFile = useCallback((imgFile) => {
    if (!imgFile || !imgFile.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => setCoverUrl(e.target.result)
    reader.readAsDataURL(imgFile)
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleImageFile(e.dataTransfer.files[0])
  }

  const handleSaveCover = async () => {
    if (!coverUrl) return
    setSaving(true)
    const result = await window.tagwise.writeCoverArt(fullPath, coverUrl)
    setSaving(false)
    setSaveMsg(result.ok
      ? { ok: true,  text: 'Cover art saved.' }
      : { ok: false, text: result.error || 'Cover save failed.' }
    )
  }

  const rename = buildRenamePreview(values)

  const inputStyle = {
    width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px',
    background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
    borderRadius: 'var(--radius-sm)', color: loading ? 'var(--text-muted)' : 'var(--text-primary)',
    padding: '7px 10px', outline: 'none',
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40,
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '380px',
        background: 'var(--bg-panel)', borderLeft: '1px solid var(--border-mid)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.2s ease', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-amber)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Edit Tags</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                {file.artist ?? ''}{file.artist && file.album ? ' · ' : ''}{file.album ?? ''}
              </div>
            </div>
            <button onClick={onClose} style={{ flexShrink: 0, color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1, padding: '0 4px', cursor: 'pointer' }}>×</button>
          </div>
        </div>

        {/* Tag fields */}
        <div style={{ padding: '16px 20px', flex: 1 }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '14px' }}>Tags</div>
          {loading ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', padding: '20px 0' }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '5px' }}>
                    {label}
                  </label>
                  <input
                    type="text"
                    value={values[key] ?? ''}
                    onChange={(e) => handleChange(key, e.target.value)}
                    style={inputStyle}
                    onFocus={e  => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e   => e.target.style.borderColor = 'var(--border-mid)'}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cover art */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Cover Art</div>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('cover-file-input').click()}
              style={{
                width: '88px', height: '88px', flexShrink: 0,
                background: dragging ? 'var(--accent-dim)' : 'var(--bg-surface)',
                border: `1px solid ${dragging ? 'var(--accent)' : 'var(--border-mid)'}`,
                borderRadius: 'var(--radius-md)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'border-color 0.15s',
              }}
            >
              {coverUrl
                ? <img src={coverUrl} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '22px', color: 'var(--text-muted)' }}>♪</span>
              }
            </div>
            <input id="cover-file-input" type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => handleImageFile(e.target.files[0])} />

            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '10px' }}>
                Drop, click, or paste an image.
              </p>
              {coverUrl && (
                <button onClick={handleSaveCover} disabled={saving} style={{
                  fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '5px 12px',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer',
                }}>
                  Save Cover
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filename Preview */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Filename Preview</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-amber)', wordBreak: 'break-all', lineHeight: 1.5 }}>{rename}</div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={handleSave} disabled={saving || loading || file.drm} style={{
            fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500,
            padding: '8px 20px', background: 'var(--accent)', color: '#0f0f0e',
            borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            opacity: (saving || loading || file.drm) ? 0.5 : 1, letterSpacing: '.04em',
          }}>
            {saving ? 'Saving…' : 'Save Tags'}
          </button>
          {file.drm && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-red)', lineHeight: 1.5 }}>
              DRM — Read Only. Re-download from Apple Music as M4A to edit tags.
            </span>
          )}
          {file.drm === false || (!file.drm && saveMsg) ? (
            saveMsg ? (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: saveMsg.ok ? 'var(--text-green)' : 'var(--text-red)' }}>
                {saveMsg.text}
              </span>
            ) : null
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  )
}
