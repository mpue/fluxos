import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFileSystem } from '../contexts/FileSystemContext';
import { useDesktop } from '../contexts/DesktopContext';
import { FileSystemItem } from '../types/filesystem';
import './CodeEditor.css';

// ─── Syntax Highlighting ────────────────────────────────────────────────

type TokenType = 'keyword' | 'string' | 'number' | 'comment' | 'function' | 'operator' |
  'type' | 'tag' | 'attr' | 'punctuation' | 'property' | 'boolean' | 'regex' | 'builtin' | 'text';

interface Token { type: TokenType; value: string; }

const JS_KEYWORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
  'if', 'import', 'in', 'instanceof', 'let', 'new', 'of', 'return', 'super',
  'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
  'async', 'await', 'from', 'as', 'static', 'get', 'set',
]);

const TS_TYPES = new Set([
  'string', 'number', 'boolean', 'any', 'void', 'never', 'unknown', 'object',
  'interface', 'type', 'enum', 'namespace', 'module', 'declare', 'implements',
  'abstract', 'readonly', 'private', 'protected', 'public',
]);

const BUILTINS = new Set([
  'console', 'Math', 'JSON', 'Date', 'Array', 'Object', 'String', 'Number',
  'Boolean', 'Promise', 'Map', 'Set', 'RegExp', 'Error', 'parseInt', 'parseFloat',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'fetch',
  'document', 'window', 'React', 'useState', 'useEffect', 'useRef', 'useCallback',
]);

function tokenize(code: string, language: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const isJSLike = ['javascript', 'typescript', 'jsx', 'tsx'].includes(language);
  const isCSS = language === 'css';
  const isHTML = language === 'html';

  while (i < code.length) {
    // Line comments
    if (isJSLike && code[i] === '/' && code[i + 1] === '/') {
      let end = code.indexOf('\n', i);
      if (end === -1) end = code.length;
      tokens.push({ type: 'comment', value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Block comments
    if ((isJSLike || isCSS) && code[i] === '/' && code[i + 1] === '*') {
      let end = code.indexOf('*/', i + 2);
      if (end === -1) end = code.length; else end += 2;
      tokens.push({ type: 'comment', value: code.slice(i, end) });
      i = end;
      continue;
    }

    // HTML comments
    if (isHTML && code.slice(i, i + 4) === '<!--') {
      let end = code.indexOf('-->', i + 4);
      if (end === -1) end = code.length; else end += 3;
      tokens.push({ type: 'comment', value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Strings
    if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) {
        if (code[j] === '\\') j++;
        j++;
      }
      if (j < code.length) j++;
      tokens.push({ type: 'string', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(code[i]) && (i === 0 || /[^a-zA-Z_$]/.test(code[i - 1]))) {
      let j = i;
      if (code[j] === '0' && (code[j + 1] === 'x' || code[j + 1] === 'X')) {
        j += 2;
        while (j < code.length && /[0-9a-fA-F]/.test(code[j])) j++;
      } else {
        while (j < code.length && /[0-9.]/.test(code[j])) j++;
      }
      tokens.push({ type: 'number', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // HTML tags
    if (isHTML && code[i] === '<') {
      let j = i + 1;
      if (code[j] === '/') j++;
      let tagName = '';
      while (j < code.length && /[a-zA-Z0-9-]/.test(code[j])) {
        tagName += code[j];
        j++;
      }
      if (tagName) {
        tokens.push({ type: 'tag', value: code.slice(i, j) });
        i = j;
        continue;
      }
    }

    // Words (identifiers, keywords)
    if (/[a-zA-Z_$]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j])) j++;
      const word = code.slice(i, j);

      if (isJSLike && (word === 'true' || word === 'false' || word === 'null' || word === 'undefined')) {
        tokens.push({ type: 'boolean', value: word });
      } else if (isJSLike && JS_KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else if (isJSLike && TS_TYPES.has(word)) {
        tokens.push({ type: 'type', value: word });
      } else if (isJSLike && BUILTINS.has(word)) {
        tokens.push({ type: 'builtin', value: word });
      } else if (isJSLike && j < code.length && code[j] === '(') {
        tokens.push({ type: 'function', value: word });
      } else if (isCSS && code[i - 1] === '-' || (isCSS && code[i - 1] === ':')) {
        tokens.push({ type: 'property', value: word });
      } else {
        tokens.push({ type: 'text', value: word });
      }
      i = j;
      continue;
    }

    // Operators
    if ('+-*/%=<>!&|^~?:'.includes(code[i])) {
      let j = i + 1;
      while (j < code.length && '+-*/%=<>!&|^~?:'.includes(code[j])) j++;
      tokens.push({ type: 'operator', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Punctuation
    if ('(){}[];,.'.includes(code[i])) {
      tokens.push({ type: 'punctuation', value: code[i] });
      i++;
      continue;
    }

    // Whitespace and other
    tokens.push({ type: 'text', value: code[i] });
    i++;
  }

  return tokens;
}

function tokensToHtml(tokens: Token[]): string {
  return tokens.map(t => {
    const escaped = t.value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    if (t.type === 'text') return escaped;
    return `<span class="token-${t.type}">${escaped}</span>`;
  }).join('');
}

function getLanguageFromExtension(ext: string): string {
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    css: 'css', html: 'html', htm: 'html', json: 'javascript',
    md: 'text', txt: 'text',
  };
  return map[ext] || 'javascript';
}

// ─── Script Runner Component ────────────────────────────────────────────

interface OutputLine {
  text: string;
  type: 'log' | 'info' | 'warn' | 'error' | 'system';
}

interface ScriptRunnerProps {
  code: string;
  fileName: string;
}

const ScriptRunner: React.FC<ScriptRunnerProps> = ({ code, fileName }) => {
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [renderContent, setRenderContent] = useState<React.ReactNode | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const addOutput = useCallback((text: string, type: OutputLine['type'] = 'log') => {
    setOutput(prev => [...prev, { text, type }]);
  }, []);

  const iframeCleanup = useRef<(() => void) | null>(null);

  const runScript = useCallback(() => {
    // Clean up any previous iframe
    if (iframeCleanup.current) {
      iframeCleanup.current();
      iframeCleanup.current = null;
    }

    setOutput([{ text: `▶ Skript "${fileName}" gestartet...`, type: 'system' }]);
    setIsRunning(true);
    setRenderContent(null);

    // Escape the user code for embedding in srcdoc (handle </script> in strings)
    const escapedCode = code.replace(/<\/script>/gi, '<\\/script>');

    const html = `<!DOCTYPE html><html><head></head><body><script>
var __postMsg = function(type, text) {
  window.parent.postMessage({ __fluxos_script: true, type: type, text: String(text) }, '*');
};

console.log = function() { var a = [].slice.call(arguments); __postMsg('log', a.map(function(x){ return typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x); }).join(' ')); };
console.info = function() { var a = [].slice.call(arguments); __postMsg('info', a.map(function(x){ return typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x); }).join(' ')); };
console.warn = function() { var a = [].slice.call(arguments); __postMsg('warn', a.map(function(x){ return typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x); }).join(' ')); };
console.error = function() { var a = [].slice.call(arguments); __postMsg('error', a.map(function(x){ return typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x); }).join(' ')); };

window.render = function(html) { __postMsg('render', html); };
window.alert = function(msg) { __postMsg('info', '[alert] ' + msg); };

try {
  ${escapedCode}
  __postMsg('system', '\\n\\u2713 Skript erfolgreich beendet.');
} catch(e) {
  __postMsg('error', '\\u2717 Fehler: ' + e.message + (e.stack ? '\\n' + e.stack : ''));
}
__postMsg('done', '');
</script></body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.sandbox.value = 'allow-scripts';
    iframe.srcdoc = html;

    const handleMessage = (e: MessageEvent) => {
      if (!e.data || !e.data.__fluxos_script) return;
      if (e.data.type === 'done') {
        setIsRunning(false);
        return;
      }
      if (e.data.type === 'render') {
        setRenderContent(
          <div dangerouslySetInnerHTML={{ __html: e.data.text }} />
        );
        return;
      }
      setOutput(prev => [...prev, { text: e.data.text, type: e.data.type }]);
    };

    window.addEventListener('message', handleMessage);
    document.body.appendChild(iframe);

    iframeCleanup.current = () => {
      window.removeEventListener('message', handleMessage);
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };
  }, [code, fileName, addOutput]);

  // Auto-run on mount, cleanup on unmount
  useEffect(() => {
    runScript();
    return () => {
      if (iframeCleanup.current) {
        iframeCleanup.current();
        iframeCleanup.current = null;
      }
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="script-runner">
      <div className="script-runner-toolbar">
        <span>📜 {fileName}</span>
        <div style={{ flex: 1 }} />
        <button onClick={runScript}>🔄 Neu starten</button>
        <button onClick={() => setOutput([])}>🗑️ Ausgabe leeren</button>
      </div>
      {renderContent ? (
        <div className="script-runner-render">{renderContent}</div>
      ) : (
        <div className="script-runner-output" ref={outputRef}>
          {output.map((line, i) => (
            <div key={i} className={`output-line ${line.type}`}>{line.text}</div>
          ))}
        </div>
      )}
      <div className="script-runner-statusbar">
        <span className={isRunning ? 'status-running' : 'status-finished'}>
          {isRunning ? '● Läuft...' : '○ Beendet'}
        </span>
      </div>
    </div>
  );
};

// ─── Tab / File Management ──────────────────────────────────────────────

interface EditorTab {
  id: string;
  name: string;
  content: string;
  language: string;
  hasChanges: boolean;
  fileId?: string; // Link to filesystem item
  cursorPos: { line: number; col: number };
}

// ─── Code Editor Component ──────────────────────────────────────────────

interface CodeEditorProps {
  fileId?: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ fileId }) => {
  const { items, getItemById, createItem, updateFileContent } = useFileSystem();
  const { addWindow } = useDesktop();

  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileTemplate, setNewFileTemplate] = useState('empty');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find(t => t.id === activeTabId) || null;

  // Load file from FS if fileId is provided
  useEffect(() => {
    if (fileId) {
      const file = getItemById(fileId);
      if (file && file.type === 'file') {
        openFileTab(file);
      }
    }
  }, [fileId]);

  // Focus new file dialog
  useEffect(() => {
    if (showNewFileDialog && newFileInputRef.current) {
      newFileInputRef.current.focus();
    }
  }, [showNewFileDialog]);

  const openFileTab = useCallback((file: FileSystemItem) => {
    const existing = tabs.find(t => t.fileId === file.id);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'js';
    const newTab: EditorTab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      content: file.content || '',
      language: getLanguageFromExtension(ext),
      hasChanges: false,
      fileId: file.id,
      cursorPos: { line: 1, col: 1 },
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs]);

  const createNewFile = useCallback((name: string, template: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || 'js';
    let content = '';

    switch (template) {
      case 'react':
        content = `import React, { useState } from 'react';

const ${name.replace(/\.\w+$/, '')}: React.FC = () => {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: 20 }}>
      <h2>${name.replace(/\.\w+$/, '')}</h2>
      <p>Zähler: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
};

export default ${name.replace(/\.\w+$/, '')};
`;
        break;
      case 'script':
        content = `// FluxOS Skript: ${name}
// Verwende console.log() für Ausgaben
// Verwende render('<html>') für HTML-Ausgabe

console.log('Hallo von ${name}!');

for (let i = 1; i <= 10; i++) {
  console.log(\`Zeile \${i}\`);
}

console.log('Fertig!');
`;
        break;
      case 'html-app':
        content = `// FluxOS HTML-App: ${name}
// Verwende render() um HTML anzuzeigen

const app = \`
  <div style="font-family: sans-serif; padding: 20px;">
    <h1>Meine App</h1>
    <p>Willkommen!</p>
    <button onclick="document.getElementById('output').textContent = 'Klick!'">
      Klick mich
    </button>
    <p id="output"></p>
  </div>
\`;

render(app);
`;
        break;
      default:
        content = '';
    }

    const newTab: EditorTab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      content,
      language: getLanguageFromExtension(ext),
      hasChanges: content.length > 0,
      cursorPos: { line: 1, col: 1 },
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId);
      const newTabs = prev.filter(t => t.id !== tabId);
      if (tabId === activeTabId && newTabs.length > 0) {
        const newIdx = Math.min(idx, newTabs.length - 1);
        setActiveTabId(newTabs[newIdx].id);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }
      return newTabs;
    });
  }, [activeTabId]);

  const updateTabContent = useCallback((tabId: string, content: string) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, content, hasChanges: true } : t
    ));
  }, []);

  const saveTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (tab.fileId) {
      updateFileContent(tab.fileId, tab.content);
      setTabs(prev => prev.map(t =>
        t.id === tabId ? { ...t, hasChanges: false } : t
      ));
    } else {
      // Save as new file in /Dokumente/Skripte
      let scriptsFolder = items.find(
        item => item.name === 'Skripte' && item.type === 'folder' && item.parentId === 'documents'
      );
      if (!scriptsFolder) {
        scriptsFolder = createItem('Skripte', 'folder', 'documents');
      }
      const newFile = createItem(tab.name, 'file', scriptsFolder.id);
      updateFileContent(newFile.id, tab.content);
      setTabs(prev => prev.map(t =>
        t.id === tabId ? { ...t, fileId: newFile.id, hasChanges: false } : t
      ));
    }
  }, [tabs, items, createItem, updateFileContent]);

  const runScript = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Open a new window with the script runner
    addWindow({
      title: `▶ ${tab.name}`,
      icon: '📜',
      position: { x: 200 + Math.random() * 100, y: 100 + Math.random() * 80 },
      size: { width: 600, height: 450 },
      isMinimized: false,
      isMaximized: false,
      content: <ScriptRunner code={tab.content} fileName={tab.name} />,
    });
  }, [tabs, addWindow]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        if (activeTabId) saveTab(activeTabId);
      }
      if (mod && e.key === 'n') {
        e.preventDefault();
        setShowNewFileDialog(true);
      }
      if (mod && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      }
      if (e.key === 'F5') {
        e.preventDefault();
        if (activeTabId) runScript(activeTabId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, saveTab, closeTab, runScript]);

  // Sync scroll between textarea and line numbers / highlight
  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (ta && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = ta.scrollTop;
    }
    if (ta && highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop;
      highlightRef.current.scrollLeft = ta.scrollLeft;
    }
  }, []);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeTabId) return;
    updateTabContent(activeTabId, e.target.value);
  }, [activeTabId, updateTabContent]);

  const handleKeyDownInEditor = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key inserts spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const value = ta.value;

      if (e.shiftKey) {
        // Un-indent
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const line = value.slice(lineStart, end);
        if (line.startsWith('  ')) {
          const newValue = value.slice(0, lineStart) + line.slice(2);
          if (activeTabId) updateTabContent(activeTabId, newValue);
          setTimeout(() => {
            ta.selectionStart = Math.max(lineStart, start - 2);
            ta.selectionEnd = Math.max(lineStart, end - 2);
          });
        }
      } else {
        const newValue = value.slice(0, start) + '  ' + value.slice(end);
        if (activeTabId) updateTabContent(activeTabId, newValue);
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    }

    // Auto-close brackets
    const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']', '"': '"', "'": "'", '`': '`' };
    if (pairs[e.key]) {
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      if (start !== end) {
        // Wrap selection
        e.preventDefault();
        const value = ta.value;
        const selected = value.slice(start, end);
        const newValue = value.slice(0, start) + e.key + selected + pairs[e.key] + value.slice(end);
        if (activeTabId) updateTabContent(activeTabId, newValue);
        setTimeout(() => {
          ta.selectionStart = start + 1;
          ta.selectionEnd = end + 1;
        });
      }
    }

    // Enter: auto-indent
    if (e.key === 'Enter') {
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const value = ta.value;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = value.slice(lineStart, start);
      const indent = currentLine.match(/^(\s*)/)?.[1] || '';
      const lastChar = value[start - 1];

      if (lastChar === '{' || lastChar === '(' || lastChar === '[') {
        e.preventDefault();
        const newIndent = indent + '  ';
        const insert = '\n' + newIndent;
        const newValue = value.slice(0, start) + insert + value.slice(start);
        if (activeTabId) updateTabContent(activeTabId, newValue);
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + insert.length;
        });
      } else if (indent) {
        e.preventDefault();
        const insert = '\n' + indent;
        const newValue = value.slice(0, start) + insert + value.slice(start);
        if (activeTabId) updateTabContent(activeTabId, newValue);
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + insert.length;
        });
      }
    }
  }, [activeTabId, updateTabContent]);

  // Update cursor position
  const handleCursorUpdate = useCallback(() => {
    if (!textareaRef.current || !activeTabId) return;
    const ta = textareaRef.current;
    const pos = ta.selectionStart;
    const textBefore = ta.value.substring(0, pos);
    const line = textBefore.split('\n').length;
    const lastNewline = textBefore.lastIndexOf('\n');
    const col = pos - lastNewline;
    setTabs(prev => prev.map(t =>
      t.id === activeTabId ? { ...t, cursorPos: { line, col } } : t
    ));
  }, [activeTabId]);

  // Render highlighted code
  const highlightedHtml = activeTab
    ? tokensToHtml(tokenize(activeTab.content, activeTab.language))
    : '';

  const lineCount = activeTab ? activeTab.content.split('\n').length : 0;

  // Get script files from filesystem for sidebar
  const scriptFiles = items.filter(item => {
    if (item.type !== 'file') return false;
    const ext = item.name.split('.').pop()?.toLowerCase();
    return ['js', 'jsx', 'ts', 'tsx', 'css', 'html'].includes(ext || '');
  });

  return (
    <div className="code-editor">
      {/* Toolbar */}
      <div className="code-editor-toolbar">
        <button onClick={() => setShowSidebar(!showSidebar)} title="Seitenleiste">
          {showSidebar ? '◀' : '▶'} Dateien
        </button>
        <button onClick={() => setShowNewFileDialog(true)} title="Neue Datei (Strg+N)">
          + Neu
        </button>
        <button
          onClick={() => activeTabId && saveTab(activeTabId)}
          disabled={!activeTab?.hasChanges}
          title="Speichern (Strg+S)"
        >
          💾 Speichern
        </button>
        <div className="separator" />
        <button
          className="run-btn"
          onClick={() => activeTabId && runScript(activeTabId)}
          disabled={!activeTab}
          title="Skript ausführen (F5)"
        >
          ▶ Ausführen
        </button>
        <div className="file-name">
          {activeTab ? (
            <span className={activeTab.hasChanges ? 'unsaved' : ''}>
              {activeTab.name}
            </span>
          ) : (
            'FluxOS Code Editor'
          )}
        </div>
      </div>

      <div className="code-editor-main">
        {/* Sidebar */}
        <div className={`code-editor-sidebar ${showSidebar ? '' : 'collapsed'}`}>
          <div className="code-editor-sidebar-header">
            <span>Skript-Dateien</span>
            <button onClick={() => setShowNewFileDialog(true)} title="Neue Datei">+</button>
          </div>
          <div className="code-editor-file-tree">
            {scriptFiles.map(file => (
              <div
                key={file.id}
                className={`file-tree-item ${tabs.some(t => t.fileId === file.id) && activeTab?.fileId === file.id ? 'active' : ''}`}
                onClick={() => openFileTab(file)}
              >
                <span className="icon">
                  {file.name.endsWith('.tsx') || file.name.endsWith('.jsx') ? '⚛️' :
                   file.name.endsWith('.ts') ? '🔷' :
                   file.name.endsWith('.js') ? '📜' :
                   file.name.endsWith('.css') ? '🎨' :
                   file.name.endsWith('.html') ? '🌐' : '📄'}
                </span>
                <span className="name">{file.name}</span>
              </div>
            ))}
            {scriptFiles.length === 0 && (
              <div style={{ padding: '12px', color: '#585b70', fontSize: 12, textAlign: 'center' }}>
                Keine Skript-Dateien.<br />Erstelle eine neue Datei!
              </div>
            )}
          </div>
        </div>

        {/* Editor area */}
        <div className="code-editor-area">
          {/* Tabs */}
          {tabs.length > 0 && (
            <div className="code-editor-tabs">
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  className={`code-editor-tab ${tab.id === activeTabId ? 'active' : ''}`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  {tab.hasChanges && <span className="unsaved-dot">●</span>}
                  {tab.name}
                  <button className="tab-close" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>×</button>
                </div>
              ))}
            </div>
          )}

          {activeTab ? (
            <>
              <div className="code-editor-content">
                <div className="code-editor-line-numbers" ref={lineNumbersRef}>
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div
                      key={i}
                      className={`line-number ${i + 1 === activeTab.cursorPos.line ? 'current' : ''}`}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
                <div className="code-editor-textarea-wrapper">
                  <div
                    className="code-editor-highlight"
                    ref={highlightRef}
                    dangerouslySetInnerHTML={{ __html: highlightedHtml + '\n' }}
                  />
                  <textarea
                    ref={textareaRef}
                    className="code-editor-textarea"
                    value={activeTab.content}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDownInEditor}
                    onScroll={handleScroll}
                    onClick={handleCursorUpdate}
                    onKeyUp={handleCursorUpdate}
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                </div>
              </div>

              {/* Status bar */}
              <div className="code-editor-statusbar">
                <div className="status-left">
                  <span>Zeile {activeTab.cursorPos.line}, Spalte {activeTab.cursorPos.col}</span>
                  <span>{activeTab.content.split('\n').length} Zeilen</span>
                  <span>{activeTab.content.length} Zeichen</span>
                </div>
                <div className="status-right">
                  <span>{activeTab.language.toUpperCase()}</span>
                  <span>UTF-8</span>
                </div>
              </div>
            </>
          ) : (
            <div className="code-editor-empty">
              <div className="logo">{'</>'}</div>
              <div>FluxOS Code Editor</div>
              <div className="shortcuts">
                <kbd>Strg+N</kbd><span>Neue Datei</span>
                <kbd>Strg+S</kbd><span>Speichern</span>
                <kbd>Strg+W</kbd><span>Tab schließen</span>
                <kbd>F5</kbd><span>Skript ausführen</span>
                <kbd>Tab</kbd><span>Einrücken</span>
                <kbd>Shift+Tab</kbd><span>Ausrücken</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New File Dialog */}
      {showNewFileDialog && (
        <div className="code-editor-dialog-overlay" onClick={() => setShowNewFileDialog(false)}>
          <div className="code-editor-dialog" onClick={e => e.stopPropagation()}>
            <h3>Neue Datei erstellen</h3>
            <input
              ref={newFileInputRef}
              type="text"
              placeholder="Dateiname (z.B. meinScript.js)"
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newFileName.trim()) {
                  createNewFile(newFileName.trim(), newFileTemplate);
                  setNewFileName('');
                  setShowNewFileDialog(false);
                }
                if (e.key === 'Escape') setShowNewFileDialog(false);
              }}
            />
            <select value={newFileTemplate} onChange={e => setNewFileTemplate(e.target.value)}>
              <option value="empty">Leere Datei</option>
              <option value="script">Skript-Vorlage</option>
              <option value="react">React-Komponente</option>
              <option value="html-app">HTML-App-Vorlage</option>
            </select>
            <div className="dialog-buttons">
              <button onClick={() => setShowNewFileDialog(false)}>Abbrechen</button>
              <button
                className="primary"
                onClick={() => {
                  if (newFileName.trim()) {
                    createNewFile(newFileName.trim(), newFileTemplate);
                    setNewFileName('');
                    setShowNewFileDialog(false);
                  }
                }}
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
