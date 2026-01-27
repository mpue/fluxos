import React, { useState, useEffect, useRef } from 'react';
import { useFileSystem } from '../contexts/FileSystemContext';
import './TextEditor.css';

interface TextEditorProps {
  fileId: string;
}

const TextEditor: React.FC<TextEditorProps> = ({ fileId }) => {
  const { getItemById, updateFileContent } = useFileSystem();
  const file = getItemById(fileId);
  
  const [content, setContent] = useState(file?.content || '');
  const [hasChanges, setHasChanges] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (file?.content !== undefined) {
      setContent(file.content);
      setHasChanges(false);
    }
  }, [file?.content]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (file && hasChanges) {
      updateFileContent(fileId, content);
      setHasChanges(false);
    }
  };

  const handleUndo = () => {
    if (file?.content !== undefined) {
      setContent(file.content);
      setHasChanges(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, hasChanges]);

  if (!file || file.type !== 'file') {
    return <div className="text-editor-error">Datei nicht gefunden</div>;
  }

  return (
    <div className="text-editor">
      <div className="text-editor-toolbar">
        <div className="text-editor-filename">
          {file.name} {hasChanges && '*'}
        </div>
        <div className="text-editor-actions">
          <button
            className="editor-btn"
            onClick={handleSave}
            disabled={!hasChanges}
            title="Speichern (Strg+S)"
          >
            💾 Speichern
          </button>
          <button
            className="editor-btn"
            onClick={handleUndo}
            disabled={!hasChanges}
            title="Änderungen verwerfen"
          >
            ↶ Rückgängig
          </button>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        className="text-editor-content"
        value={content}
        onChange={handleContentChange}
        placeholder="Dateiinhalt hier eingeben..."
        spellCheck={false}
      />
      <div className="text-editor-statusbar">
        <span>Zeichen: {content.length}</span>
        <span>Zeilen: {content.split('\n').length}</span>
        {hasChanges && <span className="unsaved-indicator">● Nicht gespeichert</span>}
      </div>
    </div>
  );
};

export default TextEditor;
