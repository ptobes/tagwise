import { useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import ScanView from './components/ScanView.jsx'
import FixView from './components/FixView.jsx'
import RenameView from './components/RenameView.jsx'
import CoverTypeView from './components/CoverTypeView.jsx'
import { useScript } from './hooks/useScript.js'

const layout = { display: 'flex', height: '100vh', overflow: 'hidden' }
const main   = { flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }

export default function App() {
  const [activeView, setActiveView] = useState('scan')
  const [directory, setDirectory]   = useState(null)

  // One script hook per view — instantiated once, persists in App
  const scanScript      = useScript()
  const fixScript       = useScript()
  const coverTypeScript = useScript()
  const renameScript    = useScript()

  const handlePickDir = async () => {
    const dir = await window.tagwise.openDirectory()
    if (dir) setDirectory(dir)
  }

  const views = {
    scan:      <ScanView      directory={directory} onPickDir={handlePickDir} script={scanScript} />,
    fix:       <FixView       directory={directory} onPickDir={handlePickDir} script={fixScript} />,
    covertype: <CoverTypeView directory={directory} onPickDir={handlePickDir} script={coverTypeScript} />,
    rename:    <RenameView    directory={directory} onPickDir={handlePickDir} script={renameScript} />,
  }

  return (
    <div style={layout}>
      <Sidebar activeView={activeView} onNavigate={setActiveView} directory={directory} onPickDir={handlePickDir} />
      <main style={main}>
        {views[activeView]}
      </main>
    </div>
  )
}
