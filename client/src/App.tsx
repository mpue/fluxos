import { useEffect } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { DesktopProvider } from './contexts/DesktopContext'
import { FileSystemProvider } from './contexts/FileSystemContext'
import { DialogProvider } from './contexts/DialogContext'
import LoginScreen from './components/LoginScreen'
import Desktop from './components/Desktop'
import { useAuth } from './contexts/AuthContext'
import './App.css'

function AppContent() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
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
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <FileSystemProvider>
      <Desktop />
    </FileSystemProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <DesktopProvider>
        <DialogProvider>
          <AppContent />
        </DialogProvider>
      </DesktopProvider>
    </AuthProvider>
  );
}

export default App
