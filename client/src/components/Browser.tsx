import React, { useState, useRef } from 'react';
import './Browser.css';

const Browser: React.FC = () => {
  const [url, setUrl] = useState('https://www.cflux.org');
  const [inputValue, setInputValue] = useState('https://www.cflux.org');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleNavigate = (newUrl: string) => {
    let finalUrl = newUrl.trim();
    
    // Add https:// if no protocol specified
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      // Check if it looks like a search query
      if (!finalUrl.includes('.') || finalUrl.includes(' ')) {
        finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`;
      } else {
        finalUrl = `https://${finalUrl}`;
      }
    }
    
    setUrl(finalUrl);
    setInputValue(finalUrl);
    setIsLoading(true);
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
    handleNavigate('https://www.google.com');
  };

  const handleLoad = () => {
    setIsLoading(false);
    setCanGoBack(true);
  };

  const quickLinks = [
    { name: 'Google', url: 'https://www.google.com', icon: '🔍' },
    { name: 'GitHub', url: 'https://github.com', icon: '💻' },
    { name: 'YouTube', url: 'https://www.youtube.com', icon: '▶️' },
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
        <iframe
          ref={iframeRef}
          src={url}
          className="browser-frame"
          title="Browser Content"
          onLoad={handleLoad}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
};

export default Browser;
