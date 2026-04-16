import { useState } from 'react'

const FIELDS = [
  { key: 'title',  label: 'Title',  id3: 'title'       },
  { key: 'artist', label: 'Artist', id3: 'artist'      },
  { key: 'album',  label: 'Album',  id3: 'album'       },
  { key: 'year',   label: 'Year',   id3: 'year'        },
  { key: 'track',  label: 'Track#', id3: 'trackNumber' },
  { key: 'genre',  label: 'Genre',  id3: 'genre'       },
]

export default function BulkEditPanel({ files, directory, initialValues = {}, onClose, onSaved }) {
  const [values, setValues]     = useState({
    title:  initialValues.title  || '',
    artist: initialValues.artist || '',
    album:  initialValues.album  || '',
    year:   initialValues.year   || '',
    track:  initialValues.track  || '',
    genre:  initialValues.genre  || '',
  })
  const [dirty, setDirty]           = useState(new Set())
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saveMsg, setSaveMsg]       = useState(null)
  const [progress, setProgress]     = useState({ current: 0, total: 0 })

  const filledFields   = FIELDS.filter(f => dirty.has(f.key) && values[f.key].trim() !== '')
  const drmCount       = files.filter(f => f.drm).length
  const editableCount  = files.length - drmCount

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }))
    setDirty(prev => new Set([...prev, key]))
    setSaveMsg(null)
    setConfirming(false)
  }

  const handleConfirm = () => {
    if (filledFields.length === 0) return
    setConfirming(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    const editableFiles = files.filter(f => !f.drm)
    setProgress({ current: 0, total: editableFiles.length })
    let successCount = 0
    let errorCount   = 0

    for (let i = 0; i < editableFiles.length; i++) {
      const file = editableFiles[i]
      setProgress({ current: i + 1, total: editableFiles.length })
      const fullPath = directory + '/' + file.path
      const id3Tags  = {}
      for (const f of filledFields) {
        id3Tags[f.id3] = values[f.key].trim()
      }
      const result = await window.tagwise.writeTags(fullPath, id3Tags)
      if (result.ok) {
        successCount++
        const savedValues = {}
        for (const f of filledFields) savedValues[f.key] = values[f.key].trim()
        onSaved?.(file, savedValues)
      } else {
        errorCount++
      }
    }

    setSaving(false)
    setConfirming(false)
    setProgress({ current: 0, total: 0 })
    setSaveMsg(
      errorCount === 0
        ? { ok: true,  text: 'Saved ' + successCount + ' file' + (successCount !== 1 ? 's' : '') + '.' }
        : { ok: false, text: successCount + ' saved, ' + errorCount + ' failed.' }
    )
  }

  const inputStyle = {
    width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px',
    background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
    padding: '7px 10px', outline: 'none',
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '380px',
        background: 'var(--bg-panel)', borderLeft: '1px solid var(--border-mid)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-amber)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Bulk Edit Tags</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
                {files.length} files selected
              </div>
              {drmCount > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-red)', marginTop: '3px' }}>
                  {drmCount} DRM file{drmCount !== 1 ? 's' : ''} will be skipped
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ flexShrink: 0, color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1, padding: '0 4px', cursor: 'pointer' }}>×</button>
          </div>
        </div>

        {/* Fields */}
        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Tags</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
            Pre-filled fields have the same value across all selected files. Blank fields are inconsistent — editing them will apply the new value to all files. Leave blank to skip.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '5px' }}>
                  {label}
                </label>
                <input
                  type="text"
                  value={values[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder="Leave blank to skip"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border-mid)'}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Confirmation */}
        {confirming && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--accent-dim)', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-amber)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
              Writing {filledFields.length} field{filledFields.length !== 1 ? 's' : ''} to {editableCount} file{editableCount !== 1 ? 's' : ''}:
            </div>
            {filledFields.map(f => (
              <div key={f.key} style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: '3px' }}>
                {f.label}: <span style={{ color: 'var(--text-primary)' }}>{values[f.key]}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button onClick={handleSave} disabled={saving} style={{
                fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500,
                padding: '7px 16px', background: 'var(--accent)', color: '#0f0f0e',
                borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                opacity: saving ? 0.5 : 1,
              }}>
                {saving ? 'Saving…' : 'Confirm'}
              </button>
              <button onClick={() => setConfirming(false)} disabled={saving} style={{
                fontFamily: 'var(--font-mono)', fontSize: '12px',
                padding: '7px 16px', background: 'transparent',
                border: '1px solid var(--border-mid)', color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {saving && progress.total > 0 && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>Saving…</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-amber)' }}>
                {progress.current} / {progress.total}
              </span>
            </div>
            <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px' }}>
              <div style={{
                height: '100%',
                width: ((progress.current / progress.total) * 100) + '%',
                background: 'var(--accent)',
                borderRadius: '2px',
                transition: 'width 0.15s ease',
              }} />
            </div>
          </div>
        )}

        {/* Progress bar */}
        {saving && progress.total > 0 && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                Saving…
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-amber)' }}>
                {progress.current} / {progress.total}
              </span>
            </div>
            <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px' }}>
              <div style={{
                height: '100%',
                width: `${(progress.current / progress.total) * 100}%`,
                background: 'var(--accent)',
                borderRadius: '2px',
                transition: 'width 0.15s ease',
              }} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {saveMsg && saveMsg.ok ? (
            <>
              <button onClick={onClose} style={{
                fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500,
                padding: '8px 20px', background: 'var(--accent)', color: '#0f0f0e',
                borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', letterSpacing: '.04em',
              }}>Close</button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-green)' }}>
                {saveMsg.text}
              </span>
            </>
          ) : (
            <>
              <button
                onClick={handleConfirm}
                disabled={filledFields.length === 0 || saving || confirming}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500,
                  padding: '8px 20px', background: 'var(--accent)', color: '#0f0f0e',
                  borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                  opacity: (filledFields.length === 0 || saving || confirming) ? 0.4 : 1,
                  letterSpacing: '.04em',
                }}>
                Save Tags
              </button>
              {saveMsg && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-red)' }}>
                  {saveMsg.text}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  )
}
