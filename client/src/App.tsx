import { useEffect } from 'react'
import { DesktopProvider } from './contexts/DesktopContext'
import { FileSystemProvider } from './contexts/FileSystemContext'
import Desktop from './components/Desktop'
import './App.css'

function App() {
  useEffect(() => {
    // Verhindert das Zurücknavigieren im Browser
    const preventBackNavigation = () => {
      window.history.pushState(null, '', window.location.href);
    };

    // Initial einen History-Eintrag hinzufügen
    preventBackNavigation();

    // Bei jedem popstate Event (Zurück-Button) einen neuen Eintrag pushen
    window.addEventListener('popstate', preventBackNavigation);

    return () => {
      window.removeEventListener('popstate', preventBackNavigation);
    };
  }, []);

  return (
    <FileSystemProvider>
      <DesktopProvider>
        <Desktop />
      </DesktopProvider>
    </FileSystemProvider>
  )
}

export default App
