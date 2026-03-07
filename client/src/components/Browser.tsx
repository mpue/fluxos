import React, { useState, useRef } from 'react';
import './Browser.css';

const Browser: React.FC = () => {
  const [url, setUrl] = useState('https://lite.duckduckgo.com');
  const [inputValue, setInputValue] = useState('https://lite.duckduckgo.com');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleNavigate = (newUrl: string) => {
    let finalUrl = newUrl.trim();
    
    // Add https:// if no protocol specified
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      // Check if it looks like a search query
      if (!finalUrl.includes('.') || finalUrl.includes(' ')) {
        finalUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(finalUrl)}`;
      } else {
        finalUrl = `https://${finalUrl}`;
      }
    }
    
    setUrl(finalUrl);
    setInputValue(finalUrl);
    setIsLoading(true);
    setLoadError(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleNavigate(inputValue);
  };

  const handleBack = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.history.back();
      setCanGoBack(false);
      setCanGoForward(true);
    }
  };

  const handleForward = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.history.forward();
      setCanGoForward(false);
      setCanGoBack(true);
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = url;
      setIsLoading(true);
    }
  };

  const handleHome = () => {
    handleNavigate('https://lite.duckduckgo.com');
  };

  const handleLoad = () => {
    setIsLoading(false);
    setCanGoBack(true);
    setLoadError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setLoadError(true);
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const quickLinks = [
    { name: 'DuckDuckGo', url: 'https://lite.duckduckgo.com', icon: '🔍' },
    { name: 'Wikipedia', url: 'https://www.wikipedia.org', icon: '📚' },
  ];

  return (
    <div className="browser">
      <div className="browser-toolbar">
        <div className="browser-navigation">
          <button 
            className="nav-button" 
            onClick={handleBack}
            disabled={!canGoBack}
            title="Zurück"
          >
            ←
          </button>
          <button 
            className="nav-button" 
            onClick={handleForward}
            disabled={!canGoForward}
            title="Vorwärts"
          >
            →
          </button>
          <button 
            className="nav-button" 
            onClick={handleRefresh}
            title="Neu laden"
          >
            {isLoading ? '⏸' : '↻'}
          </button>
          <button 
            className="nav-button" 
            onClick={handleHome}
            title="Startseite"
          >
            🏠
          </button>
        </div>

        <form className="browser-url-bar" onSubmit={handleSubmit}>
          <div className="url-input-wrapper">
            <span className="url-icon">🔒</span>
            <input
              type="text"
              className="url-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Suchen oder Adresse eingeben..."
            />
            {isLoading && <span className="loading-indicator">⏳</span>}
          </div>
          <button type="submit" className="go-button">
            →
          </button>
        </form>
      </div>

      <div className="browser-quick-links">
        {quickLinks.map((link) => (
          <button
            key={link.name}
            className="quick-link"
            onClick={() => handleNavigate(link.url)}
            title={link.name}
          >
            <span className="quick-link-icon">{link.icon}</span>
            <span className="quick-link-name">{link.name}</span>
          </button>
        ))}
      </div>

      <div className="browser-content">
        {loadError ? (
          <div className="browser-error">
            <div className="browser-error-icon">🚫</div>
            <h3>Seite kann nicht im eingebetteten Browser geladen werden</h3>
            <p>Diese Website blockiert die Darstellung in eingebetteten Ansichten.</p>
            <button className="browser-error-button" onClick={handleOpenExternal}>
              🔗 Im externen Browser öffnen
            </button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={url}
            className="browser-frame"
            title="Browser Content"
            onLoad={handleLoad}
            onError={handleIframeError}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        )}
      </div>
    </div>
  );
};

export default Browser;
