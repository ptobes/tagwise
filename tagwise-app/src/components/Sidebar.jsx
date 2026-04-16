const NAV = [
  { id: 'scan', label: 'Scan', step: '01' },
  { id: 'fix', label: 'Fix Tags', step: '02' },
  { id: 'covertype', label: 'Cover Type', step: '03' },
  { id: 'rename', label: 'Rename', step: '04' },
]

export default function Sidebar({ activeView, onNavigate, directory, onPickDir }) {
  const dirName = directory ? directory.split('/').pop() : null
  return (
    <aside style={{ width: '200px', flexShrink: 0, background: 'var(--bg-panel)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ height: '44px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 16px 20px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 500, background: 'var(--accent)', color: '#0f0f0e', padding: '3px 6px', borderRadius: '3px', letterSpacing: '.05em' }}>TW</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', letterSpacing: '.04em' }}>Tagwise</span>
      </div>
      <div style={{ margin: '0 10px 20px' }}>
        <button onClick={onPickDir} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ color: 'var(--text-amber)', fontSize: '14px', flexShrink: 0 }}>⌂</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            {dirName ? (
              <><span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{dirName}</span><span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>change</span></>
            ) : (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>Select folder…</span>
            )}
          </span>
        </button>
      </div>
      <nav style={{ flex: 1 }}>
        {NAV.map(({ id, label, step }) => (
          <button key={id} onClick={() => onNavigate(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 16px', cursor: 'pointer', borderLeft: activeView === id ? '2px solid var(--accent)' : '2px solid transparent', background: activeView === id ? 'var(--accent-dim)' : 'transparent' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: activeView === id ? 'var(--text-amber)' : 'var(--text-muted)', letterSpacing: '.05em', flexShrink: 0 }}>{step}</span>
            <span style={{ fontSize: '13px', color: activeView === id ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: activeView === id ? 500 : 400 }}>{label}</span>
          </button>
        ))}
      </nav>
      <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>v0.1.0</span>
      </div>
    </aside>
  )
}
