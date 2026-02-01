import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDesktop } from '../contexts/DesktopContext';
import { getColorScheme } from '../utils/colorSchemes';
import './LoginScreen.css';

const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const { colorScheme } = useDesktop();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString('de-DE', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long',
      year: 'numeric' 
    });
  };

  const currentColorScheme = getColorScheme(colorScheme);

  return (
    <div className="login-screen">
      <div className="login-background" style={{ background: currentColorScheme.gradient }}></div>
      
      <div className="login-time">
        <div className="login-clock">{formatTime()}</div>
        <div className="login-date">{formatDate()}</div>
      </div>

      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">💻</div>
            <h1 className="login-title">FluxOS</h1>
            <p className="login-subtitle">Willkommen zurück</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-input-group">
              <label htmlFor="username" className="login-label">
                Benutzername
              </label>
              <input
                id="username"
                type="text"
                className="login-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ihr Benutzername"
                required
                autoFocus
                disabled={loading}
                style={{
                  borderColor: username ? currentColorScheme.primary : undefined,
                }}
              />
            </div>

            <div className="login-input-group">
              <label htmlFor="password" className="login-label">
                Passwort
              </label>
              <input
                id="password"
                type="password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ihr Passwort"
                required
                disabled={loading}
                style={{
                  borderColor: password ? currentColorScheme.primary : undefined,
                }}
              />
            </div>

            {error && (
              <div className="login-error">
                <span className="login-error-icon">⚠️</span>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              className="login-button"
              style={{ 
                background: currentColorScheme.gradient 
              }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="login-spinner"></span>
                  Anmelden...
                </>
              ) : (
                'Anmelden'
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>FluxOS v1.0 • © 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
