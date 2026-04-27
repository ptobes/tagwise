import { useState, useEffect, useRef, useCallback } from 'react'

const MAX_LINES = 500

export function useScript() {
  const [lines, setLines]       = useState([])
  const [status, setStatus]     = useState('idle')
  const [exitCode, setExitCode] = useState(null)
  const processId  = useRef(null)
  const buffer     = useRef([])
  const flushTimer = useRef(null)
  const allLines   = useRef([]) // unbounded store for parsing

  const flush = useCallback(() => {
    if (buffer.current.length === 0) return
    const toAdd = [...buffer.current]
    buffer.current = []
    allLines.current.push(...toAdd)
    // Only keep last MAX_LINES in state for rendering
    setLines(allLines.current.slice(-MAX_LINES))
  }, [])

  useEffect(() => {
    const unsubscribe = window.tagwise.onOutput((payload) => {
      if (processId.current && payload.id && payload.id !== processId.current) return

      if (payload.type === 'done') {
        flush()
        setExitCode(payload.code)
        setStatus(payload.code === 0 ? 'done' : 'error')
      } else if (payload.type === 'error') {
        flush()
        setLines(prev => [...prev, { type: 'error', data: payload.data }])
        setStatus('error')
      } else {
        const newLines = (payload.data || '').split('\n').filter(l => l.length > 0).map(l => ({ type: payload.type, data: l }))
        buffer.current.push(...newLines)
        if (!flushTimer.current) {
          flushTimer.current = setTimeout(() => {
            flushTimer.current = null
            flush()
          }, 200)
        }
      }
    })
    return () => {
      unsubscribe()
      if (flushTimer.current) clearTimeout(flushTimer.current)
    }
  }, [flush])

  const run = useCallback(async (script, args = []) => {
    setLines([]); setStatus('running'); setExitCode(null)
    buffer.current = []
    allLines.current = []
    const result = await window.tagwise.runScript(script, args)
    processId.current = result.id
    return result.id
  }, [])

  // Expose allLines for parsing (unbounded)
  const getAllLines = useCallback(() => allLines.current, [])

  const send = useCallback((input) => {
    if (processId.current) window.tagwise.sendInput(processId.current, input)
  }, [])

  const kill = useCallback(() => {
    if (processId.current) { window.tagwise.killScript(processId.current); setStatus('idle'); processId.current = null }
  }, [])

  const clear = useCallback(() => {
    setLines([]); setStatus('idle'); setExitCode(null)
    processId.current = null; buffer.current = []; allLines.current = []
  }, [])

  return { run, send, kill, lines, status, exitCode, clear, getAllLines }
}
