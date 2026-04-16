import { useEffect, useRef } from 'react'

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '')
}

export default function Terminal({ lines, status, onConfirm }) {
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])

  const cleanLines = lines.map(l => ({ ...l, data: stripAnsi(l.data) }))
  const lastLine = cleanLines[cleanLines.length - 1]?.data ?? ''
  const showConfirm = onConfirm && /\[y\/n\]|\(y\/n\)/i.test(lastLine) && status === 'running'

  const s = {
    wrap: { background: '#0a0a09', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', fontFamily: 'var(--font-mono)', fontSize: '12px' },
    head: { display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' },
    dot:  { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: status === 'running' ? 'var(--text-amber)' : status === 'done' ? 'var(--text-green)' : status === 'error' ? 'var(--text-red)' : 'var(--text-muted)' },
    body: { maxHeight: '300px', overflowY: 'auto', padding: '12px 16px', lineHeight: '1.65' },
    confirmBar: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--accent-dim)' },
  }

  return (
    <div style={s.wrap}>
      <div style={s.head}>
        <span style={s.dot} />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', flex: 1 }}>output</span>
        {status === 'running' && <span style={{ color: 'var(--text-amber)', fontSize: '11px', animation: 'none' }}>▮</span>}
        {status === 'done'    && <span style={{ fontSize: '10px', color: 'var(--text-green)' }}>exit 0</span>}
        {status === 'error'   && <span style={{ fontSize: '10px', color: 'var(--text-red)'   }}>exit ≠ 0</span>}
      </div>
      <div style={s.body}>
        {cleanLines.map((line, i) => (
          <div key={i} style={{
            color: line.type === 'stderr' || line.type === 'error' ? 'var(--text-red)' : '#b0ae9f',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {line.data}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {showConfirm && (
        <div style={s.confirmBar}>
          <span style={{ flex: 1, color: 'var(--text-amber)', fontSize: '11px' }}>{lastLine}</span>
          <button onClick={() => onConfirm('y\n')} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '5px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(110,185,110,0.4)', background: 'rgba(110,185,110,0.15)', color: 'var(--text-green)', cursor: 'pointer' }}>Yes (y)</button>
          <button onClick={() => onConfirm('n\n')} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '5px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(208,96,96,0.3)', background: 'rgba(208,96,96,0.1)', color: 'var(--text-red)', cursor: 'pointer' }}>No (n)</button>
        </div>
      )}
    </div>
  )
}
