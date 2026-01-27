import { DesktopProvider } from './contexts/DesktopContext'
import { FileSystemProvider } from './contexts/FileSystemContext'
import Desktop from './components/Desktop'
import './App.css'

function App() {
  return (
    <FileSystemProvider>
      <DesktopProvider>
        <Desktop />
      </DesktopProvider>
    </FileSystemProvider>
  )
}

export default App
