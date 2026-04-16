import { useState } from 'react'
import { useScript } from '../hooks/useScript.js'
import Terminal from './Terminal.jsx'

const btnP = { fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, padding: '8px 18px', background: 'var(--accent)', color: '#0f0f0e', borderRadius: 'var(--radius-sm)', letterSpacing: '.04em', cursor: 'pointer', border: 'none' }
const btnS = { fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '8px 14px', border: '1px solid var(--border-mid)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'transparent' }

export default function RenameView({ directory, onPickDir }) {
  const { run, send, lines, status, clear } = useScript()
  const [mode, setMode] = useState('dry')
  const collisions = lines.filter(l => /collision/i.test(l.data)).length

  const handleRun = (isDry) => {
    if (!directory) return
    setMode(isDry ? 'dry' : 'live')
    run('tagwise-rename.js', isDry ? [directory, '--dry-run'] : [directory])
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: '900px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, letterSpacing: '.02em' }}>Rename</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Format: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-amber)', background: 'var(--accent-dim)', padding: '1px 6px', borderRadius: '3px' }}>TrackNumber - Title - Album - Artist.mp3</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {lines.length > 0 && status !== 'running' && <button style={btnS} onClick={clear}>Clear</button>}
          <button style={{ ...btnS, opacity: (!directory || status === 'running') ? 0.4 : 1 }} onClick={() => handleRun(true)} disabled={!directory || status === 'running'}>Dry Run</button>
          <button style={{ ...btnP, opacity: (!directory || status === 'running') ? 0.4 : 1 }} onClick={() => handleRun(false)} disabled={!directory || status === 'running'}>
            {status === 'running' && mode === 'live' ? 'Renaming…' : 'Rename'}
          </button>
        </div>
      </div>
      {!directory && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '80px 0' }}><p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>No folder selected.</p><button style={btnP} onClick={onPickDir}>Select Music Folder</button></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--border-accent)', borderRadius: 'var(--radius-md)' }}>
        {[['01','Always run a Dry Run first. Review for collisions and files marked "inferred: track number".'],['02','Resolve collisions manually in Finder before running the live rename.'],['03','A backup manifest is written to .tagwise-rename-manifest.txt in your music folder.']].map(([n,t]) => (
          <p key={n} style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-amber)', flexShrink: 0 }}>{n}</span>{t}
          </p>
        ))}
      </div>
      {collisions > 0 && status !== 'running' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', marginBottom: '16px', background: 'rgba(208,96,96,0.1)', border: '1px solid rgba(208,96,96,0.3)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-red)' }}>
          ⚠ {collisions} collision{collisions !== 1 ? 's' : ''} detected — resolve in Finder before live rename.
        </div>
      )}
      {lines.length > 0 && <Terminal lines={lines} status={status} onConfirm={(input) => send(input)} />}
    </div>
  )
}
