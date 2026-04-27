import { useState } from 'react'
import { parseFixOutput, parseFixProgress } from '../lib/parseFixOutput.js'
import Terminal from './Terminal.jsx'

const btnP = { fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, padding: '8px 18px', background: 'var(--accent)', color: '#0f0f0e', borderRadius: 'var(--radius-sm)', letterSpacing: '.04em', cursor: 'pointer', border: 'none' }
const btnS = { fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '8px 14px', border: '1px solid var(--border-mid)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'transparent' }

const NOTES = [
  ['01', 'Review proposed changes before confirming. Watch for wrong year matches on deluxe or special editions.'],
  ['02', 'Bootlegs and unofficial releases won\'t match — that\'s expected.'],
  ['03', 'Handle any "Unknown Album" folders in Finder before running this step.'],
]

function AlbumCard({ album }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '8px',
    }}>
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', cursor: 'pointer' }}
      >
        {/* Status indicators */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {album.year && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '2px 7px', background: 'rgba(110,185,110,0.15)', color: 'var(--text-green)', border: '1px solid rgba(110,185,110,0.3)', borderRadius: '3px' }}>
              {album.year}
            </span>
          )}
          {album.hasCover && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '2px 7px', background: 'rgba(96,144,208,0.15)', color: 'var(--text-blue)', border: '1px solid rgba(96,144,208,0.3)', borderRadius: '3px' }}>
              cover
            </span>
          )}
        </div>

        {/* Album info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {album.artist} — {album.album}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {album.trackCount} track{album.trackCount !== 1 ? 's' : ''}
          </div>
        </div>

        <span style={{ color: 'var(--text-muted)', fontSize: '11px', flexShrink: 0 }}>
          {expanded ? '▾' : '▸'}
        </span>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px' }}>
          {album.files.map((file, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0', borderBottom: i < album.files.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {file.name}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {file.year && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-green)' }}>year → {file.year}</span>}
                {file.cover && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-blue)' }}>cover → added</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FixView({ directory, onPickDir, script }) {
  const { run, send, lines, status, clear } = script
  const [showRaw, setShowRaw] = useState(false)

  const fixData    = parseFixOutput(script.getAllLines())
  const progress   = parseFixProgress(script.getAllLines())
  const isRunning  = status === 'running'
  const isDone     = status === 'done' || status === 'error'

  // Count lookup results
  const matched    = progress.filter(p => p.ok).length
  const unmatched  = progress.filter(p => !p.ok).length

  const handleConfirm = (input) => send(input)

  return (
    <div style={{ padding: '40px 32px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, letterSpacing: '.02em' }}>Fix Tags</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Look up and write missing Year and Cover Art via Discogs and iTunes</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {lines.length > 0 && !isRunning && <button style={btnS} onClick={clear}>Clear</button>}
          <button
            style={{ ...btnP, opacity: (!directory || isRunning) ? 0.4 : 1 }}
            onClick={() => directory && run('tagwise-fix.js', [directory])}
            disabled={!directory || isRunning}
          >
            {isRunning ? 'Running…' : 'Fix Tags'}
          </button>
        </div>
      </div>

      {!directory && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '80px 0' }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>No folder selected.</p>
          <button style={btnP} onClick={onPickDir}>Select Music Folder</button>
        </div>
      )}

      {/* Notes */}
      {!lines.length && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--border-accent)', borderRadius: 'var(--radius-md)' }}>
          {NOTES.map(([num, text]) => (
            <p key={num} style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-amber)', flexShrink: 0, paddingTop: '1px' }}>{num}</span>
              {text}
            </p>
          ))}
        </div>
      )}

      {/* Lookup progress summary */}
      {lines.length > 0 && (matched > 0 || unmatched > 0) && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-green)', fontSize: '14px' }}>✓</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{matched} matched</span>
          </div>
          {unmatched > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--text-red)', fontSize: '14px' }}>✗</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{unmatched} no match</span>
            </div>
          )}
          {isRunning && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-amber)', marginLeft: 'auto' }}>looking up…</span>
          )}
        </div>
      )}

      {/* Proposed changes — album cards */}
      {fixData && fixData.albums.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
              Proposed changes
              <span style={{ color: 'var(--text-muted)', marginLeft: '10px', fontSize: '11px' }}>
                {fixData.albums.length} album{fixData.albums.length !== 1 ? 's' : ''} · {fixData.totalFiles} file{fixData.totalFiles !== 1 ? 's' : ''}
              </span>
            </div>
            <button onClick={() => setShowRaw(v => !v)} style={{ ...btnS, fontSize: '11px', padding: '4px 10px' }}>
              {showRaw ? 'hide raw' : 'show raw'}
            </button>
          </div>

          {fixData.albums.map((album, i) => (
            <AlbumCard key={i} album={album} />
          ))}

          {/* Confirm / Cancel */}
          {fixData.ready && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', padding: '14px 16px', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-md)', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-amber)', flex: 1 }}>
                Apply changes to {fixData.totalFiles} files?
              </span>
              <button onClick={() => handleConfirm('y\n')} style={{ ...btnP, padding: '7px 20px' }}>Apply</button>
              <button onClick={() => handleConfirm('n\n')} style={{ ...btnS, padding: '7px 14px' }}>Skip</button>
            </div>
          )}
        </div>
      )}

      {/* Raw terminal output */}
      {lines.length > 0 && (showRaw || !fixData) && (
        <Terminal lines={lines} status={status} onConfirm={!fixData ? handleConfirm : undefined} />
      )}
    </div>
  )
}
