import { DesktopProvider } from './contexts/DesktopContext'
import Desktop from './components/Desktop'
import './App.css'

function App() {
  return (
    <DesktopProvider>
      <Desktop />
    </DesktopProvider>
  )
}

export default App
