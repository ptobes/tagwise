import { useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import ScanView from './components/ScanView.jsx'
import FixView from './components/FixView.jsx'
import RenameView from './components/RenameView.jsx'
import CoverTypeView from './components/CoverTypeView.jsx'

const layout = { display: 'flex', height: '100vh', overflow: 'hidden' }
const main = { flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }

export default function App() {
  const [activeView, setActiveView] = useState('scan')
  const [directory, setDirectory] = useState(null)

  const handlePickDir = async () => {
    const dir = await window.tagwise.openDirectory()
    if (dir) setDirectory(dir)
  }

  const views = { scan: ScanView, fix: FixView, rename: RenameView, covertype: CoverTypeView }
  const View = views[activeView]

  return (
    <div style={layout}>
      <Sidebar activeView={activeView} onNavigate={setActiveView} directory={directory} onPickDir={handlePickDir} />
      <main style={main}><View directory={directory} onPickDir={handlePickDir} /></main>
    </div>
  )
}
