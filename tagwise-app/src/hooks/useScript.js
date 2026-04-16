import { useState, useEffect, useRef, useCallback } from 'react'

export function useScript() {
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('idle')
  const [exitCode, setExitCode] = useState(null)
  const processId = useRef(null)

  useEffect(() => {
    const unsubscribe = window.tagwise.onOutput((payload) => {
      if (payload.type === 'done') {
        setExitCode(payload.code)
        setStatus(payload.code === 0 ? 'done' : 'error')
      } else if (payload.type === 'error') {
        setLines(prev => [...prev, { type: 'error', data: payload.data }])
        setStatus('error')
      } else {
        const newLines = (payload.data || '').split('\n').filter(l => l.length > 0).map(l => ({ type: payload.type, data: l }))
        setLines(prev => [...prev, ...newLines])
      }
    })
    return unsubscribe
  }, [])

  const run = useCallback(async (script, args = []) => {
    setLines([]); setStatus('running'); setExitCode(null)
    const result = await window.tagwise.runScript(script, args)
    processId.current = result.id
    return result.id
  }, [])

  const send = useCallback((input) => {
    if (processId.current) window.tagwise.sendInput(processId.current, input)
  }, [])

  const kill = useCallback(() => {
    if (processId.current) { window.tagwise.killScript(processId.current); setStatus('idle'); processId.current = null }
  }, [])

  const clear = useCallback(() => {
    setLines([]); setStatus('idle'); setExitCode(null); processId.current = null
  }, [])

  return { run, send, kill, lines, status, exitCode, clear }
}
