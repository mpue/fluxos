import React, { useState } from 'react';
import { useDesktop } from '../contexts/DesktopContext';
import { getColorScheme } from '../utils/colorSchemes';
import './Notepad.css';

const Notepad: React.FC = () => {
  const { colorScheme } = useDesktop();
  const currentColorScheme = getColorScheme(colorScheme);
  const [content, setContent] = useState('');
  const [fontSize, setFontSize] = useState(14);

  const handleClear = () => {
    if (content && window.confirm('Möchten Sie den Text wirklich löschen?')) {
      setContent('');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setContent(content + text);
    } catch (err) {
      console.error('Paste failed:', err);
    }
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  return (
    <div className="notepad">
      <div className="notepad-toolbar">
        <button 
          className="notepad-btn" 
          onClick={handleClear} 
          title="Neu"
          style={{ borderColor: currentColorScheme.primary }}
          onMouseEnter={(e) => e.currentTarget.style.background = `${currentColorScheme.primary}15`}
          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
        >
          📄 Neu
        </button>
        <button 
          className="notepad-btn" 
          onClick={handleCopy} 
          title="Kopieren"
          style={{ borderColor: currentColorScheme.primary }}
          onMouseEnter={(e) => e.currentTarget.style.background = `${currentColorScheme.primary}15`}
          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
        >
          📋 Kopieren
        </button>
        <button 
          className="notepad-btn" 
          onClick={handlePaste} 
          title="Einfügen"
          style={{ borderColor: currentColorScheme.primary }}
          onMouseEnter={(e) => e.currentTarget.style.background = `${currentColorScheme.primary}15`}
          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
        >
          📌 Einfügen
        </button>
        <div className="notepad-divider"></div>
        <button 
          className="notepad-btn" 
          onClick={() => setFontSize(Math.max(8, fontSize - 2))}
          title="Schrift verkleinern"
        >
          A-
        </button>
        <span className="font-size-display">{fontSize}px</span>
        <button 
          className="notepad-btn" 
          onClick={() => setFontSize(Math.min(32, fontSize + 2))}
          title="Schrift vergrößern"
        >
          A+
        </button>
      </div>
      
      <textarea
        className="notepad-textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Beginnen Sie zu schreiben..."
        style={{ fontSize: `${fontSize}px` }}
      />
      
      <div className="notepad-status">
        <span>Zeichen: {charCount}</span>
        <span>Wörter: {wordCount}</span>
      </div>
    </div>
  );
};

export default Notepad;
