import { useScript } from '../hooks/useScript.js'
import Terminal from './Terminal.jsx'

const btnP = { fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, padding: '8px 18px', background: 'var(--accent)', color: '#0f0f0e', borderRadius: 'var(--radius-sm)', letterSpacing: '.04em', cursor: 'pointer', border: 'none' }
const btnS = { fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '8px 14px', border: '1px solid var(--border-mid)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'transparent' }

export default function CoverTypeView({ directory, onPickDir }) {
  const { run, send, lines, status, clear } = useScript()
  return (
    <div style={{ padding: '40px 32px', maxWidth: '900px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, letterSpacing: '.02em' }}>Cover Type</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Rewrite all cover art as APIC type 3 — required for GM/Chevy head units</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {lines.length > 0 && status !== 'running' && <button style={btnS} onClick={clear}>Clear</button>}
          <button style={{ ...btnP, opacity: (!directory || status === 'running') ? 0.4 : 1 }} onClick={() => directory && run('tagwise-fix-covertype.js', [directory])} disabled={!directory || status === 'running'}>
            {status === 'running' ? 'Running…' : 'Fix Cover Type'}
          </button>
        </div>
      </div>
      {!directory && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '80px 0' }}><p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>No folder selected.</p><button style={btnP} onClick={onPickDir}>Select Music Folder</button></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--border-accent)', borderRadius: 'var(--radius-md)' }}>
        {[['!','Car head units (GM/Chevy) show "Unknown Artist" when cover art is APIC type 0. This rewrites all art as type 3 (Front Cover).'],['!','If an album still shows Unknown Artist after this step, its art was never written — add manually via iTunes then re-run.']].map(([n,t]) => (
          <p key={n} style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-amber)', flexShrink: 0 }}>{n}</span>{t}
          </p>
        ))}
      </div>
      {lines.length > 0 && <Terminal lines={lines} status={status} onConfirm={(input) => send(input)} />}
    </div>
  )
}
