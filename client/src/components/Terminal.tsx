import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFileSystem } from '../contexts/FileSystemContext';
import { useAuth } from '../contexts/AuthContext';
import './Terminal.css';

// ─── Helpers ───

function formatDate(d: Date): string {
  return d.toLocaleString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

function matchGlob(pattern: string, name: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${regex}$`, 'i').test(name);
}

interface OutputLine {
  text: string;
  type: 'stdout' | 'stderr' | 'info' | 'success' | 'prompt';
}

// ─── Environment ───

const HOSTNAME = 'fluxos';

const defaultEnv: Record<string, string> = {
  HOME: '/home/user',
  PATH: '/usr/local/bin:/usr/bin:/bin',
  SHELL: '/bin/bash',
  TERM: 'xterm-256color',
  LANG: 'de_DE.UTF-8',
  EDITOR: 'notepad',
  USER: 'user',
  HOSTNAME,
  PS1: '\\u@\\h:\\w\\$ ',
};

// ─── Component ───

const Terminal: React.FC = () => {
  const { items, createItem, deleteItem, renameItem, updateFileContent } = useFileSystem();
  const { user } = useAuth();

  const [output, setOutput] = useState<OutputLine[]>([
    { text: `FluxOS Terminal v2.0.0 — ${new Date().toLocaleDateString('de-DE')}`, type: 'info' },
    { text: 'Geben Sie "help" ein für eine Liste aller Befehle.\n', type: 'info' },
  ]);
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState('root'); // current working directory (item id)
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [env, setEnv] = useState<Record<string, string>>({
    ...defaultEnv,
    USER: user?.username || 'user',
    HOME: `/home/${user?.username || 'user'}`,
  });
  const [aliases, setAliases] = useState<Record<string, string>>({
    ll: 'ls -la',
    la: 'ls -a',
    l: 'ls -l',
    '..': 'cd ..',
    '...': 'cd ../..',
    cls: 'clear',
    md: 'mkdir',
    rd: 'rmdir',
  });
  const [tabHint, setTabHint] = useState<string | null>(null);

  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const username = user?.username || 'user';

  // Auto-scroll
  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [output]);

  // Focus input on click
  const handleTermClick = () => inputRef.current?.focus();

  // ─── Path resolution ───

  const resolvePathToId = useCallback((path: string, fromId: string): string | null => {
    if (!path || path === '.') return fromId;

    // Absolute path: /root/...
    if (path.startsWith('/')) {
      // /  → root
      const trimmed = path.replace(/^\/+/, '').replace(/\/+$/, '');
      if (!trimmed) return 'root';
      const parts = trimmed.split('/');
      let currentId = 'root';
      for (const part of parts) {
        if (part === '.' || part === '') continue;
        if (part === '..') {
          const cur = itemsRef.current.find(i => i.id === currentId);
          currentId = cur?.parentId || 'root';
          continue;
        }
        const children = itemsRef.current.filter(i => i.parentId === currentId);
        const match = children.find(c => c.name === part || c.name.toLowerCase() === part.toLowerCase());
        if (!match) return null;
        currentId = match.id;
      }
      return currentId;
    }

    // ~ → root (home)
    if (path === '~' || path.startsWith('~/')) {
      const rest = path.slice(1).replace(/^\/+/, '');
      if (!rest) return 'root';
      return resolvePathToId(rest, 'root');
    }

    // Relative
    const parts = path.replace(/\/+$/, '').split('/');
    let currentId = fromId;
    for (const part of parts) {
      if (part === '.' || part === '') continue;
      if (part === '..') {
        const cur = itemsRef.current.find(i => i.id === currentId);
        currentId = cur?.parentId || 'root';
        continue;
      }
      const children = itemsRef.current.filter(i => i.parentId === currentId);
      const match = children.find(c => c.name === part || c.name.toLowerCase() === part.toLowerCase());
      if (!match) return null;
      currentId = match.id;
    }
    return currentId;
  }, []);

  const getUnixPath = useCallback((itemId: string): string => {
    const parts: string[] = [];
    let cur = itemsRef.current.find(i => i.id === itemId);
    while (cur) {
      if (!cur.parentId) { parts.unshift(''); break; }
      parts.unshift(cur.name);
      cur = itemsRef.current.find(i => i.id === cur!.parentId);
    }
    const p = '/' + parts.join('/');
    return p === '/' ? '/' : p.replace(/\/+$/, '');
  }, []);

  const getCwdDisplay = useCallback((): string => {
    return getUnixPath(cwd) || '/';
  }, [cwd, getUnixPath]);

  // ─── Command output helpers ───

  const appendOutput = useCallback((lines: OutputLine[]) => {
    setOutput(prev => [...prev, ...lines]);
  }, []);

  const out = (text: string, type: OutputLine['type'] = 'stdout') => ({ text, type });

  // ─── Parse command line (handle pipes, semicolons, &&, ||) ───

  const tokenize = (line: string): string[] => {
    const tokens: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;
    let escaped = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (escaped) { current += ch; escaped = false; continue; }
      if (ch === '\\' && !inSingle) { escaped = true; continue; }
      if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
      if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
      if ((ch === ' ' || ch === '\t') && !inSingle && !inDouble) {
        if (current) { tokens.push(current); current = ''; }
        continue;
      }
      current += ch;
    }
    if (current) tokens.push(current);
    return tokens;
  };

  // Expand env vars ($VAR, ${VAR})
  const expandVars = useCallback((s: string): string => {
    return s.replace(/\$\{([A-Za-z_]\w*)\}|\$([A-Za-z_]\w*)/g, (_, g1, g2) => {
      const key = g1 || g2;
      return env[key] ?? '';
    });
  }, [env]);

  // ─── Commands ───

  const executeCommand = useCallback((rawLine: string): OutputLine[] => {
    const line = expandVars(rawLine).trim();
    if (!line) return [];

    // Handle semicolons
    if (line.includes(';')) {
      const parts = line.split(';');
      return parts.flatMap(p => executeCommand(p));
    }

    // Handle && 
    if (line.includes('&&')) {
      const parts = line.split('&&');
      const results: OutputLine[] = [];
      for (const p of parts) {
        const r = executeCommand(p);
        results.push(...r);
        if (r.some(l => l.type === 'stderr')) return results;
      }
      return results;
    }

    // Handle pipes (simplified: pass stdout of left as input text to right)
    if (line.includes(' | ')) {
      const parts = line.split(' | ');
      let pipeInput = '';
      for (const part of parts) {
        const result = executeCommandSingle(part.trim(), pipeInput);
        pipeInput = result.filter(l => l.type === 'stdout').map(l => l.text).join('\n');
        if (result.some(l => l.type === 'stderr')) return result;
      }
      return [out(pipeInput)];
    }

    return executeCommandSingle(line, '');
  }, []);

  const executeCommandSingle = useCallback((line: string, pipeInput: string): OutputLine[] => {
    const tokens = tokenize(line);
    if (tokens.length === 0) return [];

    let cmd = tokens[0];
    let args = tokens.slice(1);

    // Resolve alias
    if (aliases[cmd]) {
      const expanded = aliases[cmd] + ' ' + args.join(' ');
      return executeCommandSingle(expanded.trim(), pipeInput);
    }

    // Handle output redirection >  >>
    let redirectFile: string | null = null;
    let redirectAppend = false;
    const redirIdx = args.findIndex(a => a === '>' || a === '>>');
    if (redirIdx !== -1) {
      redirectAppend = args[redirIdx] === '>>';
      redirectFile = args[redirIdx + 1] || null;
      args = args.slice(0, redirIdx);
    }

    const result = runCommand(cmd, args, pipeInput);

    // Handle redirection
    if (redirectFile && result.length > 0) {
      const content = result.filter(l => l.type === 'stdout').map(l => l.text).join('\n');
      const parentId = cwd;
      const existing = itemsRef.current.find(i => i.parentId === parentId && i.name === redirectFile && i.type === 'file');
      if (existing) {
        const newContent = redirectAppend ? ((existing.content || '') + '\n' + content) : content;
        updateFileContent(existing.id, newContent);
      } else {
        const newFile = createItem(redirectFile!, 'file', parentId);
        updateFileContent(newFile.id, content);
      }
      return [out(`→ ${redirectFile}`, 'info')];
    }

    return result;
  }, []);

  const runCommand = useCallback((cmd: string, args: string[], pipeInput: string): OutputLine[] => {
    const flags = args.filter(a => a.startsWith('-'));
    const params = args.filter(a => !a.startsWith('-'));
    const flagStr = flags.join('');
    const hasFlag = (f: string) => flagStr.includes(f);

    switch (cmd) {
      // ─── help ───
      case 'help': {
        return [
          out('╔══════════════════════════════════════════════════════════╗', 'info'),
          out('║           FluxOS Terminal — Befehlsreferenz             ║', 'info'),
          out('╠══════════════════════════════════════════════════════════╣', 'info'),
          out('║ Dateisystem:                                           ║', 'info'),
          out('║   ls [-l] [-a] [Pfad]     Verzeichnisinhalt anzeigen   ║', 'info'),
          out('║   cd [Pfad]               Verzeichnis wechseln        ║', 'info'),
          out('║   pwd                     Aktuelles Verzeichnis        ║', 'info'),
          out('║   cat <Datei>             Dateiinhalt anzeigen         ║', 'info'),
          out('║   touch <Datei>           Leere Datei erstellen        ║', 'info'),
          out('║   mkdir <Name>            Verzeichnis erstellen        ║', 'info'),
          out('║   rm [-r] <Name>          Datei/Ordner löschen        ║', 'info'),
          out('║   rmdir <Name>            Leeres Verzeichnis löschen  ║', 'info'),
          out('║   cp <Quelle> <Ziel>      Datei kopieren              ║', 'info'),
          out('║   mv <Quelle> <Ziel>      Datei verschieben/umbenennen║', 'info'),
          out('║   find [Pfad] -name <Mu>  Dateien suchen              ║', 'info'),
          out('║   tree [Pfad]             Baumstruktur anzeigen       ║', 'info'),
          out('║   du [-h] [Pfad]          Speicherverbrauch           ║', 'info'),
          out('║   stat <Datei>            Datei-Info anzeigen         ║', 'info'),
          out('║   chmod <Mode> <Datei>    (Simulation) Rechte ändern  ║', 'info'),
          out('║                                                        ║', 'info'),
          out('║ Textverarbeitung:                                      ║', 'info'),
          out('║   echo <Text>             Text ausgeben               ║', 'info'),
          out('║   head [-n N] <Datei>     Erste N Zeilen              ║', 'info'),
          out('║   tail [-n N] <Datei>     Letzte N Zeilen             ║', 'info'),
          out('║   wc [-l|-w|-c] <Datei>   Zeilen/Wörter/Bytes zählen ║', 'info'),
          out('║   grep <Muster> <Datei>   Text suchen                ║', 'info'),
          out('║   sort <Datei>            Zeilen sortieren            ║', 'info'),
          out('║   uniq <Datei>            Duplikate entfernen         ║', 'info'),
          out('║   tee <Datei>             Pipe-Input in Datei + stdout║', 'info'),
          out('║                                                        ║', 'info'),
          out('║ System:                                                ║', 'info'),
          out('║   whoami                  Benutzername anzeigen       ║', 'info'),
          out('║   hostname                Hostname anzeigen           ║', 'info'),
          out('║   uname [-a]              Systeminformationen         ║', 'info'),
          out('║   date                    Datum/Uhrzeit               ║', 'info'),
          out('║   uptime                  Systemlaufzeit              ║', 'info'),
          out('║   ps [aux]                Prozessliste                ║', 'info'),
          out('║   id                      Benutzer-ID anzeigen        ║', 'info'),
          out('║   df [-h]                 Dateisystem-Info            ║', 'info'),
          out('║   free [-h]               Speicherinfo                ║', 'info'),
          out('║   clear                   Bildschirm leeren           ║', 'info'),
          out('║   history                 Befehlshistorie             ║', 'info'),
          out('║   env / printenv          Umgebungsvariablen          ║', 'info'),
          out('║   export KEY=VAL          Variable setzen             ║', 'info'),
          out('║   alias [Name=Wert]       Alias definieren/anzeigen   ║', 'info'),
          out('║   unalias <Name>          Alias entfernen             ║', 'info'),
          out('║   which <Befehl>          Befehlspfad anzeigen        ║', 'info'),
          out('║   type <Befehl>           Befehlstyp anzeigen        ║', 'info'),
          out('║   neofetch                Systembanner               ║', 'info'),
          out('║   exit                    Terminal schließen          ║', 'info'),
          out('║                                                        ║', 'info'),
          out('║ Sonstiges:                                             ║', 'info'),
          out('║   >  >>  |  ;  &&         Umleitung, Pipes, Ketten    ║', 'info'),
          out('║   Tab                     Autovervollständigung       ║', 'info'),
          out('║   ↑ / ↓                   Befehls-Historie            ║', 'info'),
          out('╚══════════════════════════════════════════════════════════╝', 'info'),
        ];
      }

      // ─── ls ───
      case 'ls': {
        const targetPath = params[0] || null;
        const targetId = targetPath ? resolvePathToId(targetPath, cwd) : cwd;
        if (!targetId) return [out(`ls: Zugriff auf '${targetPath}' nicht möglich: Datei oder Verzeichnis nicht gefunden`, 'stderr')];

        let children = itemsRef.current.filter(i => i.parentId === targetId);
        if (!hasFlag('a')) {
          children = children.filter(c => !c.name.startsWith('.'));
        }
        children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        if (children.length === 0) return [];

        if (hasFlag('l')) {
          const lines: OutputLine[] = [out(`insgesamt ${children.length}`, 'stdout')];
          for (const c of children) {
            const typeChar = c.type === 'folder' ? 'd' : '-';
            const perm = c.type === 'folder' ? 'rwxr-xr-x' : 'rw-r--r--';
            const size = c.size ? formatSize(c.size) : c.type === 'folder' ? '4096' : '0';
            const date = formatDate(c.modifiedAt);
            const name = c.type === 'folder' ? `\x1b[1;34m${c.name}/\x1b[0m` : c.name;
            lines.push(out(`${typeChar}${perm}  1 ${username}  ${String(size).padStart(8)}  ${date}  ${name}`));
          }
          return lines;
        }

        // Grid display
        const names = children.map(c => c.type === 'folder' ? `\x1b[1;34m${c.name}/\x1b[0m` : c.name);
        const lines: OutputLine[] = [];
        const cols = 4;
        for (let i = 0; i < names.length; i += cols) {
          lines.push(out(names.slice(i, i + cols).map(n => {
            const clean = n.replace(/\x1b\[[^m]*m/g, '');
            return n + ' '.repeat(Math.max(1, 20 - clean.length));
          }).join('')));
        }
        return lines;
      }

      // ─── cd ───
      case 'cd': {
        const target = params[0] || '~';
        if (target === '-') {
          // Not implemented fully, just go to root
          setCwd('root');
          return [];
        }
        const id = resolvePathToId(target, cwd);
        if (!id) return [out(`cd: ${target}: Datei oder Verzeichnis nicht gefunden`, 'stderr')];
        const item = itemsRef.current.find(i => i.id === id);
        if (item && item.type !== 'folder') return [out(`cd: ${target}: Ist kein Verzeichnis`, 'stderr')];
        setCwd(id);
        return [];
      }

      // ─── pwd ───
      case 'pwd':
        return [out(getUnixPath(cwd))];

      // ─── cat ───
      case 'cat': {
        if (params.length === 0 && pipeInput) return [out(pipeInput)];
        if (params.length === 0) return [out('cat: fehlender Datei-Operand', 'stderr')];
        const results: OutputLine[] = [];
        for (const p of params) {
          const id = resolvePathToId(p, cwd);
          if (!id) { results.push(out(`cat: ${p}: Datei oder Verzeichnis nicht gefunden`, 'stderr')); continue; }
          const item = itemsRef.current.find(i => i.id === id);
          if (!item || item.type !== 'file') { results.push(out(`cat: ${p}: Ist ein Verzeichnis`, 'stderr')); continue; }
          if (hasFlag('n')) {
            const lines = (item.content || '').split('\n');
            lines.forEach((l, i) => results.push(out(`${String(i + 1).padStart(6)}  ${l}`)));
          } else {
            results.push(out(item.content || ''));
          }
        }
        return results;
      }

      // ─── echo ───
      case 'echo':
        return [out(args.join(' '))];

      // ─── touch ───
      case 'touch': {
        if (params.length === 0) return [out('touch: fehlender Datei-Operand', 'stderr')];
        for (const name of params) {
          // Check if path includes a directory
          const lastSlash = name.lastIndexOf('/');
          let parentId = cwd;
          let fileName = name;
          if (lastSlash !== -1) {
            const dirPath = name.substring(0, lastSlash);
            fileName = name.substring(lastSlash + 1);
            const dirId = resolvePathToId(dirPath, cwd);
            if (!dirId) return [out(`touch: '${dirPath}' nicht gefunden`, 'stderr')];
            parentId = dirId;
          }
          const existing = itemsRef.current.find(i => i.parentId === parentId && i.name === fileName);
          if (!existing) {
            createItem(fileName, 'file', parentId);
          }
        }
        return [];
      }

      // ─── mkdir ───
      case 'mkdir': {
        if (params.length === 0) return [out('mkdir: fehlender Operand', 'stderr')];
        for (const name of params) {
          if (hasFlag('p')) {
            // Create parent directories too
            const parts = name.replace(/^\/+/, '').split('/');
            let parentId = name.startsWith('/') ? 'root' : cwd;
            for (const part of parts) {
              const existing = itemsRef.current.find(i => i.parentId === parentId && i.name === part && i.type === 'folder');
              if (existing) {
                parentId = existing.id;
              } else {
                const newDir = createItem(part, 'folder', parentId);
                parentId = newDir.id;
              }
            }
          } else {
            const lastSlash = name.lastIndexOf('/');
            let parentId = cwd;
            let dirName = name;
            if (lastSlash !== -1) {
              const dirPath = name.substring(0, lastSlash);
              dirName = name.substring(lastSlash + 1);
              const dirId = resolvePathToId(dirPath, cwd);
              if (!dirId) return [out(`mkdir: '${dirPath}' nicht gefunden`, 'stderr')];
              parentId = dirId;
            }
            const existing = itemsRef.current.find(i => i.parentId === parentId && i.name === dirName);
            if (existing) return [out(`mkdir: '${dirName}' existiert bereits`, 'stderr')];
            createItem(dirName, 'folder', parentId);
          }
        }
        return [];
      }

      // ─── rm ───
      case 'rm': {
        if (params.length === 0) return [out('rm: fehlender Operand', 'stderr')];
        for (const name of params) {
          const id = resolvePathToId(name, cwd);
          if (!id) return [out(`rm: '${name}' nicht gefunden`, 'stderr')];
          const item = itemsRef.current.find(i => i.id === id);
          if (!item) return [out(`rm: '${name}' nicht gefunden`, 'stderr')];
          if (item.type === 'folder' && !hasFlag('r') && !hasFlag('R')) {
            return [out(`rm: '${name}' ist ein Verzeichnis. Verwenden Sie -r`, 'stderr')];
          }
          if (item.id === 'root') return [out('rm: "/" kann nicht gelöscht werden', 'stderr')];
          deleteItem(item.id);
        }
        return [];
      }

      // ─── rmdir ───
      case 'rmdir': {
        if (params.length === 0) return [out('rmdir: fehlender Operand', 'stderr')];
        for (const name of params) {
          const id = resolvePathToId(name, cwd);
          if (!id) return [out(`rmdir: '${name}' nicht gefunden`, 'stderr')];
          const item = itemsRef.current.find(i => i.id === id);
          if (!item || item.type !== 'folder') return [out(`rmdir: '${name}' ist kein Verzeichnis`, 'stderr')];
          const children = itemsRef.current.filter(i => i.parentId === id);
          if (children.length > 0) return [out(`rmdir: '${name}' ist nicht leer`, 'stderr')];
          deleteItem(id);
        }
        return [];
      }

      // ─── cp ───
      case 'cp': {
        if (params.length < 2) return [out('cp: fehlende Operanden', 'stderr')];
        const srcPath = params[0];
        const destPath = params[1];
        const srcId = resolvePathToId(srcPath, cwd);
        if (!srcId) return [out(`cp: '${srcPath}' nicht gefunden`, 'stderr')];
        const srcItem = itemsRef.current.find(i => i.id === srcId);
        if (!srcItem) return [out(`cp: '${srcPath}' nicht gefunden`, 'stderr')];
        if (srcItem.type === 'folder' && !hasFlag('r')) return [out(`cp: '${srcPath}' ist ein Verzeichnis (nicht kopiert). Verwenden Sie -r`, 'stderr')];

        // Destination: existing folder → copy into it, or new name
        const destId = resolvePathToId(destPath, cwd);
        const destItem = destId ? itemsRef.current.find(i => i.id === destId) : null;

        if (destItem && destItem.type === 'folder') {
          const newFile = createItem(srcItem.name, srcItem.type, destItem.id);
          if (srcItem.type === 'file' && srcItem.content) {
            updateFileContent(newFile.id, srcItem.content);
          }
        } else {
          // Copy with new name in current dir or specified dir
          const lastSlash = destPath.lastIndexOf('/');
          let parentId = cwd;
          let newName = destPath;
          if (lastSlash !== -1) {
            const dirPath = destPath.substring(0, lastSlash);
            newName = destPath.substring(lastSlash + 1);
            const dirId = resolvePathToId(dirPath, cwd);
            if (!dirId) return [out(`cp: '${dirPath}' nicht gefunden`, 'stderr')];
            parentId = dirId;
          }
          const newFile = createItem(newName, srcItem.type, parentId);
          if (srcItem.type === 'file' && srcItem.content) {
            updateFileContent(newFile.id, srcItem.content);
          }
        }
        return [];
      }

      // ─── mv ───
      case 'mv': {
        if (params.length < 2) return [out('mv: fehlende Operanden', 'stderr')];
        const srcPath = params[0];
        const destPath = params[1];
        const srcId = resolvePathToId(srcPath, cwd);
        if (!srcId) return [out(`mv: '${srcPath}' nicht gefunden`, 'stderr')];

        // Try destination as folder (move into) or rename
        const destId = resolvePathToId(destPath, cwd);
        const destItem = destId ? itemsRef.current.find(i => i.id === destId) : null;

        if (destItem && destItem.type === 'folder') {
          // Move into folder
          const srcItem = itemsRef.current.find(i => i.id === srcId);
          if (srcItem) {
            // Using deleteItem + createItem to simulate move since moveItem isn't re-exported ideally
            // Actually we can use renameItem for rename and create+delete for move
            // Simplest: change parentId
            deleteItem(srcId);
            const newItem = createItem(srcItem.name, srcItem.type, destItem.id);
            if (srcItem.type === 'file' && srcItem.content) {
              updateFileContent(newItem.id, srcItem.content);
            }
          }
        } else {
          // Rename
          renameItem(srcId, destPath.includes('/') ? destPath.split('/').pop()! : destPath);
        }
        return [];
      }

      // ─── head ───
      case 'head': {
        const nIdx = args.indexOf('-n');
        let n = 10;
        if (nIdx !== -1 && args[nIdx + 1]) {
          n = parseInt(args[nIdx + 1]) || 10;
        }
        const content = pipeInput || (() => {
          const file = params[params.length - 1];
          if (!file) return null;
          const id = resolvePathToId(file, cwd);
          if (!id) return null;
          const item = itemsRef.current.find(i => i.id === id);
          return item?.content || null;
        })();
        if (content === null) return [out('head: fehlende Eingabe', 'stderr')];
        return content.split('\n').slice(0, n).map(l => out(l));
      }

      // ─── tail ───
      case 'tail': {
        const nIdx = args.indexOf('-n');
        let n = 10;
        if (nIdx !== -1 && args[nIdx + 1]) {
          n = parseInt(args[nIdx + 1]) || 10;
        }
        const content = pipeInput || (() => {
          const file = params[params.length - 1];
          if (!file) return null;
          const id = resolvePathToId(file, cwd);
          if (!id) return null;
          const item = itemsRef.current.find(i => i.id === id);
          return item?.content || null;
        })();
        if (content === null) return [out('tail: fehlende Eingabe', 'stderr')];
        const lines = content.split('\n');
        return lines.slice(Math.max(0, lines.length - n)).map(l => out(l));
      }

      // ─── wc ───
      case 'wc': {
        const content = pipeInput || (() => {
          const file = params[params.length - 1];
          if (!file) return null;
          const id = resolvePathToId(file, cwd);
          if (!id) return null;
          const item = itemsRef.current.find(i => i.id === id);
          return item?.content || null;
        })();
        if (content === null) return [out('wc: fehlende Eingabe', 'stderr')];
        const lines = content.split('\n').length;
        const words = content.split(/\s+/).filter(w => w).length;
        const bytes = new Blob([content]).size;
        if (hasFlag('l')) return [out(`${lines}`)];
        if (hasFlag('w')) return [out(`${words}`)];
        if (hasFlag('c')) return [out(`${bytes}`)];
        return [out(`  ${lines}   ${words}  ${bytes}`)];
      }

      // ─── grep ───
      case 'grep': {
        if (params.length === 0) return [out('grep: fehlender Suchbegriff', 'stderr')];
        const pattern = params[0];
        const ignoreCase = hasFlag('i');
        const showLineNum = hasFlag('n');
        const invertMatch = hasFlag('v');

        let content = pipeInput;
        if (!content && params.length > 1) {
          const file = params[1];
          const id = resolvePathToId(file, cwd);
          if (!id) return [out(`grep: ${file}: Nicht gefunden`, 'stderr')];
          const item = itemsRef.current.find(i => i.id === id);
          if (!item || item.type !== 'file') return [out(`grep: ${file}: Ist ein Verzeichnis`, 'stderr')];
          content = item.content || '';
        }
        if (!content) return [];

        let regex: RegExp;
        try {
          regex = new RegExp(pattern, ignoreCase ? 'i' : '');
        } catch {
          regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ignoreCase ? 'i' : '');
        }

        const lines = content.split('\n');
        const results: OutputLine[] = [];
        lines.forEach((line, i) => {
          const matches = regex.test(line);
          if ((matches && !invertMatch) || (!matches && invertMatch)) {
            const prefix = showLineNum ? `${i + 1}:` : '';
            // Highlight match
            const highlighted = line.replace(regex, (m) => `\x1b[1;31m${m}\x1b[0m`);
            results.push(out(`${prefix}${highlighted}`));
          }
        });
        return results;
      }

      // ─── sort ───
      case 'sort': {
        const content = pipeInput || (() => {
          if (params.length === 0) return null;
          const id = resolvePathToId(params[0], cwd);
          if (!id) return null;
          const item = itemsRef.current.find(i => i.id === id);
          return item?.content || null;
        })();
        if (!content) return [out('sort: fehlende Eingabe', 'stderr')];
        const lines = content.split('\n');
        if (hasFlag('r')) lines.sort((a, b) => b.localeCompare(a));
        else if (hasFlag('n')) lines.sort((a, b) => parseFloat(a) - parseFloat(b));
        else lines.sort();
        return lines.map(l => out(l));
      }

      // ─── uniq ───
      case 'uniq': {
        const content = pipeInput || (() => {
          if (params.length === 0) return null;
          const id = resolvePathToId(params[0], cwd);
          if (!id) return null;
          const item = itemsRef.current.find(i => i.id === id);
          return item?.content || null;
        })();
        if (!content) return [out('uniq: fehlende Eingabe', 'stderr')];
        const lines = content.split('\n');
        const unique = lines.filter((l, i) => i === 0 || l !== lines[i - 1]);
        if (hasFlag('c')) {
          const counted: { line: string; count: number }[] = [];
          for (const l of lines) {
            if (counted.length > 0 && counted[counted.length - 1].line === l) {
              counted[counted.length - 1].count++;
            } else {
              counted.push({ line: l, count: 1 });
            }
          }
          return counted.map(c => out(`${String(c.count).padStart(7)} ${c.line}`));
        }
        return unique.map(l => out(l));
      }

      // ─── tee ───
      case 'tee': {
        if (params.length === 0) return [out('tee: fehlender Dateiname', 'stderr')];
        const content = pipeInput || '';
        const fileName = params[0];
        const parentId = cwd;
        const existing = itemsRef.current.find(i => i.parentId === parentId && i.name === fileName && i.type === 'file');
        if (existing) {
          const newContent = hasFlag('a') ? ((existing.content || '') + '\n' + content) : content;
          updateFileContent(existing.id, newContent);
        } else {
          const f = createItem(fileName, 'file', parentId);
          updateFileContent(f.id, content);
        }
        return [out(content)];
      }

      // ─── find ───
      case 'find': {
        let searchRoot = cwd;
        let namePattern = '*';
        let typeFilter: 'file' | 'folder' | null = null;

        for (let i = 0; i < args.length; i++) {
          if (args[i] === '-name' && args[i + 1]) { namePattern = args[i + 1]; i++; }
          else if (args[i] === '-type' && args[i + 1]) {
            typeFilter = args[i + 1] === 'd' ? 'folder' : args[i + 1] === 'f' ? 'file' : null;
            i++;
          } else if (!args[i].startsWith('-')) {
            const id = resolvePathToId(args[i], cwd);
            if (id) searchRoot = id;
          }
        }

        const results: OutputLine[] = [];
        const walk = (parentId: string, path: string) => {
          const children = itemsRef.current.filter(i => i.parentId === parentId);
          for (const c of children) {
            const cPath = path + '/' + c.name;
            if (matchGlob(namePattern, c.name) && (!typeFilter || c.type === typeFilter)) {
              results.push(out(cPath));
            }
            if (c.type === 'folder') walk(c.id, cPath);
          }
        };
        walk(searchRoot, '.');
        return results.length > 0 ? results : [out(`find: keine Treffer für '${namePattern}'`, 'stderr')];
      }

      // ─── tree ───
      case 'tree': {
        const targetPath = params[0] || null;
        const rootId = targetPath ? resolvePathToId(targetPath, cwd) : cwd;
        if (!rootId) return [out(`tree: '${targetPath}' nicht gefunden`, 'stderr')];

        const rootItem = itemsRef.current.find(i => i.id === rootId);
        const results: OutputLine[] = [out(`\x1b[1;34m${rootItem?.name || '.'}\x1b[0m`)];
        let dirs = 0, files = 0;

        const walk = (parentId: string, prefix: string) => {
          const children = itemsRef.current.filter(i => i.parentId === parentId)
            .sort((a, b) => a.name.localeCompare(b.name));
          children.forEach((c, i) => {
            const isLast = i === children.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');
            const name = c.type === 'folder' ? `\x1b[1;34m${c.name}\x1b[0m` : c.name;
            results.push(out(`${prefix}${connector}${name}`));
            if (c.type === 'folder') { dirs++; walk(c.id, nextPrefix); }
            else files++;
          });
        };
        walk(rootId, '');
        results.push(out(`\n${dirs} Verzeichnisse, ${files} Dateien`, 'info'));
        return results;
      }

      // ─── du ───
      case 'du': {
        const targetPath = params[0] || null;
        const rootId = targetPath ? resolvePathToId(targetPath, cwd) : cwd;
        if (!rootId) return [out(`du: '${targetPath}' nicht gefunden`, 'stderr')];

        const calcSize = (parentId: string): number => {
          const children = itemsRef.current.filter(i => i.parentId === parentId);
          let total = 0;
          for (const c of children) {
            if (c.type === 'file') total += c.size || 0;
            else total += calcSize(c.id);
          }
          return total;
        };
        const size = calcSize(rootId);
        const display = hasFlag('h') ? formatSize(size) : String(size);
        const item = itemsRef.current.find(i => i.id === rootId);
        return [out(`${display}\t${item?.name || '.'}`)];
      }

      // ─── stat ───
      case 'stat': {
        if (params.length === 0) return [out('stat: fehlender Operand', 'stderr')];
        const id = resolvePathToId(params[0], cwd);
        if (!id) return [out(`stat: '${params[0]}' nicht gefunden`, 'stderr')];
        const item = itemsRef.current.find(i => i.id === id);
        if (!item) return [out(`stat: '${params[0]}' nicht gefunden`, 'stderr')];
        return [
          out(`  Datei: ${item.name}`),
          out(`  Größe: ${item.size || 0}\tTyp: ${item.type === 'folder' ? 'Verzeichnis' : 'reguläre Datei'}`),
          out(`  Zugriff: ${item.type === 'folder' ? 'drwxr-xr-x' : '-rw-r--r--'}`),
          out(`  Änderung: ${formatDate(item.modifiedAt)}`),
          out(`  Erstellt: ${formatDate(item.createdAt)}`),
          out(`  ID: ${item.id}`),
        ];
      }

      // ─── chmod ───
      case 'chmod': {
        if (params.length < 2) return [out('chmod: fehlende Operanden', 'stderr')];
        const id = resolvePathToId(params[1], cwd);
        if (!id) return [out(`chmod: '${params[1]}' nicht gefunden`, 'stderr')];
        return [out(`Rechte für '${params[1]}' auf ${params[0]} gesetzt (simuliert)`, 'info')];
      }

      // ─── whoami ───
      case 'whoami':
        return [out(username)];

      // ─── hostname ───
      case 'hostname':
        return [out(HOSTNAME)];

      // ─── id ───
      case 'id':
        return [out(`uid=1000(${username}) gid=1000(${username}) Gruppen=1000(${username}),27(sudo)`)];

      // ─── uname ───
      case 'uname': {
        if (hasFlag('a')) return [out(`FluxOS 6.1.0-fluxos #1 SMP ${new Date().toDateString()} x86_64 FluxOS`)];
        if (hasFlag('r')) return [out('6.1.0-fluxos')];
        if (hasFlag('m')) return [out('x86_64')];
        return [out('FluxOS')];
      }

      // ─── date ───
      case 'date':
        return [out(new Date().toLocaleString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }))];

      // ─── uptime ───
      case 'uptime': {
        const now = new Date();
        const up = Math.floor((now.getTime() - (performance.timeOrigin || now.getTime() - performance.now())) / 1000);
        const h = Math.floor(up / 3600);
        const m = Math.floor((up % 3600) / 60);
        return [out(` ${now.toLocaleTimeString('de-DE')}  up ${h}:${String(m).padStart(2, '0')},  1 user,  load average: 0.${Math.floor(Math.random() * 80 + 10)}, 0.${Math.floor(Math.random() * 50 + 10)}, 0.${Math.floor(Math.random() * 30 + 10)}`)];
      }

      // ─── ps ───
      case 'ps': {
        const processes = [
          { pid: '1', user: 'root', cpu: '0.0', mem: '0.1', cmd: '/sbin/init' },
          { pid: '42', user: 'root', cpu: '0.0', mem: '0.2', cmd: '/usr/lib/systemd/systemd-journald' },
          { pid: '156', user: username, cpu: '0.1', mem: '1.2', cmd: '/usr/bin/fluxos-desktop' },
          { pid: '203', user: username, cpu: '0.3', mem: '2.8', cmd: '/usr/bin/fluxos-compositor' },
          { pid: '287', user: username, cpu: '0.0', mem: '0.4', cmd: '/usr/bin/fluxos-terminal' },
          { pid: '302', user: username, cpu: '0.0', mem: '0.3', cmd: '/usr/bin/fluxos-taskbar' },
          { pid: String(300 + Math.floor(Math.random() * 100)), user: username, cpu: '0.0', mem: '0.1', cmd: 'bash' },
        ];
        const lines: OutputLine[] = [];
        if (hasFlag('a') || args.some(a => a === 'aux')) {
          lines.push(out('USER       PID  %CPU %MEM  COMMAND'));
          for (const p of processes) {
            lines.push(out(`${p.user.padEnd(10)} ${p.pid.padStart(4)}  ${p.cpu.padStart(4)} ${p.mem.padStart(4)}  ${p.cmd}`));
          }
        } else {
          lines.push(out('  PID TTY          TIME CMD'));
          lines.push(out(`${processes[processes.length - 1].pid.padStart(5)} pts/0    00:00:00 bash`));
          lines.push(out(`${String(parseInt(processes[processes.length - 1].pid) + 1).padStart(5)} pts/0    00:00:00 ps`));
        }
        return lines;
      }

      // ─── df ───
      case 'df': {
        const totalItems = itemsRef.current.length;
        const totalSize = itemsRef.current.reduce((acc, i) => acc + (i.size || 0), 0);
        const totalDisk = 1024 * 1024 * 512; // 512MB
        const used = totalSize + totalItems * 4096;
        const usePerc = Math.min(99, Math.max(1, Math.floor((used / totalDisk) * 100)));
        if (hasFlag('h')) {
          return [
            out('Dateisystem      Größe  Benutzt  Verf.  Verw%  Eingehängt auf'),
            out(`/dev/flux0        512M   ${formatSize(used).padEnd(8)} ${formatSize(totalDisk - used).padEnd(6)} ${String(usePerc).padStart(3)}%   /`),
            out(`tmpfs             128M   0        128M     0%   /tmp`),
          ];
        }
        return [
          out('Dateisystem     1K-Blöcke  Benutzt  Verfügbar  Verw%  Eingehängt auf'),
          out(`/dev/flux0       ${Math.floor(totalDisk / 1024).toString().padEnd(10)} ${Math.floor(used / 1024).toString().padEnd(8)} ${Math.floor((totalDisk - used) / 1024).toString().padEnd(10)} ${String(usePerc).padStart(3)}%   /`),
        ];
      }

      // ─── free ───
      case 'free': {
        const total = 8192;
        const used = 2048 + Math.floor(Math.random() * 1024);
        const free = total - used;
        const buff = Math.floor(Math.random() * 512 + 256);
        if (hasFlag('h')) {
          return [
            out('              total       used       free     shared  buff/cache  available'),
            out(`Mem:          ${(total / 1024).toFixed(1)}Gi     ${(used / 1024).toFixed(1)}Gi     ${(free / 1024).toFixed(1)}Gi     0.1Gi     ${(buff / 1024).toFixed(1)}Gi     ${((free + buff) / 1024).toFixed(1)}Gi`),
            out(`Swap:         2.0Gi     0.0Gi     2.0Gi`),
          ];
        }
        return [
          out('              total       used       free     shared  buff/cache  available'),
          out(`Mem:        ${String(total).padStart(8)}   ${String(used).padStart(8)}   ${String(free).padStart(8)}      128   ${String(buff).padStart(8)}   ${String(free + buff).padStart(8)}`),
          out(`Swap:           2048          0       2048`),
        ];
      }

      // ─── clear ───
      case 'clear':
        setOutput([]);
        return [];

      // ─── history ───
      case 'history':
        return history.map((h, i) => out(`${String(i + 1).padStart(5)}  ${h}`));

      // ─── env / printenv ───
      case 'env':
      case 'printenv':
        return Object.entries(env).map(([k, v]) => out(`${k}=${v}`));

      // ─── export ───
      case 'export': {
        if (params.length === 0) return Object.entries(env).map(([k, v]) => out(`declare -x ${k}="${v}"`));
        for (const p of params) {
          const eqIdx = p.indexOf('=');
          if (eqIdx === -1) return [out(`export: '${p}': ungültiger Bezeichner`, 'stderr')];
          const key = p.substring(0, eqIdx);
          const val = p.substring(eqIdx + 1);
          setEnv(prev => ({ ...prev, [key]: val }));
        }
        return [];
      }

      // ─── alias / unalias ───
      case 'alias': {
        if (params.length === 0) {
          return Object.entries(aliases).map(([k, v]) => out(`alias ${k}='${v}'`));
        }
        for (const p of params) {
          const eqIdx = p.indexOf('=');
          if (eqIdx === -1) {
            const val = aliases[p];
            if (val) return [out(`alias ${p}='${val}'`)];
            return [out(`bash: alias: ${p}: nicht gefunden`, 'stderr')];
          }
          const key = p.substring(0, eqIdx);
          const val = p.substring(eqIdx + 1);
          setAliases(prev => ({ ...prev, [key]: val }));
        }
        return [];
      }
      case 'unalias': {
        if (params.length === 0) return [out('unalias: fehlender Operand', 'stderr')];
        setAliases(prev => {
          const next = { ...prev };
          for (const p of params) delete next[p];
          return next;
        });
        return [];
      }

      // ─── which ───
      case 'which': {
        if (params.length === 0) return [out('which: fehlender Operand', 'stderr')];
        const builtins = ['ls', 'cd', 'pwd', 'cat', 'echo', 'touch', 'mkdir', 'rm', 'rmdir', 'cp', 'mv',
          'head', 'tail', 'wc', 'grep', 'sort', 'uniq', 'tee', 'find', 'tree', 'du', 'stat', 'chmod',
          'whoami', 'hostname', 'id', 'uname', 'date', 'uptime', 'ps', 'df', 'free', 'clear', 'history',
          'env', 'printenv', 'export', 'alias', 'unalias', 'which', 'type', 'neofetch', 'help', 'exit'];
        return params.map(p => builtins.includes(p) ? out(`/usr/bin/${p}`) : out(`${p} nicht gefunden`, 'stderr'));
      }

      // ─── type ───
      case 'type': {
        if (params.length === 0) return [out('type: fehlender Operand', 'stderr')];
        const results: OutputLine[] = [];
        for (const p of params) {
          if (aliases[p]) results.push(out(`${p} ist ein Alias für '${aliases[p]}'`));
          else results.push(out(`${p} ist /usr/bin/${p}`));
        }
        return results;
      }

      // ─── neofetch ───
      case 'neofetch': {
        const totalFiles = itemsRef.current.filter(i => i.type === 'file').length;
        const totalFolders = itemsRef.current.filter(i => i.type === 'folder').length;
        return [
          out(''),
          out('        \x1b[1;34m⠀⣠⣤⣤⣤⣤⡀⠀⠀⠀⠀\x1b[0m   \x1b[1;34m' + username + '\x1b[0m@\x1b[1;34m' + HOSTNAME + '\x1b[0m'),
          out('        \x1b[1;34m⢀⣾⣿⣿⣿⣿⣿⡄⠀⠀⠀\x1b[0m   ─────────────────'),
          out('        \x1b[1;34m⢸⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀\x1b[0m   \x1b[1;33mOS:\x1b[0m FluxOS 2.0 x86_64'),
          out('        \x1b[1;34m⠈⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀\x1b[0m   \x1b[1;33mHost:\x1b[0m FluxOS Virtual Desktop'),
          out('        \x1b[1;34m⠀⢿⣿⣿⣿⣿⣿⡟⠀⠀⠀\x1b[0m   \x1b[1;33mKernel:\x1b[0m 6.1.0-fluxos'),
          out('        \x1b[1;34m⠀⠈⠻⣿⣿⡿⠟⠁⠀⠀⠀\x1b[0m   \x1b[1;33mShell:\x1b[0m bash 5.2.15'),
          out('        \x1b[1;34m⠀⠀⠀⠈⠉⠁⠀⠀⠀⠀⠀\x1b[0m   \x1b[1;33mTerminal:\x1b[0m fluxos-terminal'),
          out(`        ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀   \x1b[1;33mDE:\x1b[0m FluxOS Desktop`),
          out(`        ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀   \x1b[1;33mDateien:\x1b[0m ${totalFiles} Dateien, ${totalFolders} Ordner`),
          out(`        ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀   \x1b[1;33mMemory:\x1b[0m ${2048 + Math.floor(Math.random() * 1024)}MiB / 8192MiB`),
          out(''),
          out('        \x1b[40m  \x1b[41m  \x1b[42m  \x1b[43m  \x1b[44m  \x1b[45m  \x1b[46m  \x1b[47m  \x1b[0m'),
          out(''),
        ];
      }

      // ─── exit ───
      case 'exit':
        return [out('Terminal-Sitzung beendet.', 'info')];

      // ─── unknown ───  
      default:
        return [out(`bash: ${cmd}: Befehl nicht gefunden`, 'stderr')];
    }
  }, [cwd, username, env, aliases, history, items, resolvePathToId, getUnixPath, createItem, deleteItem, renameItem, updateFileContent]);

  // ─── Tab completion ───

  const handleTab = useCallback(() => {
    const parts = tokenize(input);
    if (parts.length === 0) return;

    const isFirstToken = parts.length === 1 && !input.endsWith(' ');
    const partial = isFirstToken ? parts[0] : parts[parts.length - 1];

    if (isFirstToken) {
      // Complete command names
      const cmds = ['ls', 'cd', 'pwd', 'cat', 'echo', 'touch', 'mkdir', 'rm', 'rmdir', 'cp', 'mv',
        'head', 'tail', 'wc', 'grep', 'sort', 'uniq', 'tee', 'find', 'tree', 'du', 'stat', 'chmod',
        'whoami', 'hostname', 'id', 'uname', 'date', 'uptime', 'ps', 'df', 'free', 'clear', 'history',
        'env', 'printenv', 'export', 'alias', 'unalias', 'which', 'type', 'neofetch', 'help', 'exit',
        ...Object.keys(aliases)];
      const matches = cmds.filter(c => c.startsWith(partial.toLowerCase()));
      if (matches.length === 1) {
        setInput(matches[0] + ' ');
        setTabHint(null);
      } else if (matches.length > 1) {
        setTabHint(matches.join('  '));
      }
      return;
    }

    // Complete file/folder names
    const lastSlash = partial.lastIndexOf('/');
    let searchDir = cwd;
    let prefix = '';
    let namePrefix = partial;

    if (lastSlash !== -1) {
      const dirPath = partial.substring(0, lastSlash) || '/';
      namePrefix = partial.substring(lastSlash + 1);
      const dirId = resolvePathToId(dirPath, cwd);
      if (dirId) {
        searchDir = dirId;
        prefix = partial.substring(0, lastSlash + 1);
      }
    }

    const children = itemsRef.current.filter(i => i.parentId === searchDir);
    const matches = children.filter(c => c.name.toLowerCase().startsWith(namePrefix.toLowerCase()));

    if (matches.length === 1) {
      const completion = matches[0].name + (matches[0].type === 'folder' ? '/' : ' ');
      const beforeLastPart = input.lastIndexOf(partial);
      setInput(input.substring(0, beforeLastPart) + prefix + completion);
      setTabHint(null);
    } else if (matches.length > 1) {
      setTabHint(matches.map(m => m.name).join('  '));
      // Complete common prefix
      const names = matches.map(m => m.name);
      let common = namePrefix;
      for (let i = namePrefix.length; ; i++) {
        const chars = new Set(names.map(n => n[i]?.toLowerCase()));
        if (chars.size !== 1 || chars.has(undefined as unknown as string)) break;
        common += names[0][i];
      }
      if (common.length > namePrefix.length) {
        const beforeLastPart = input.lastIndexOf(partial);
        setInput(input.substring(0, beforeLastPart) + prefix + common);
      }
    }
  }, [input, cwd, aliases, resolvePathToId]);

  // ─── Key handler ───

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleTab();
      return;
    }

    setTabHint(null);

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIdx = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIdx);
        setInput(history[newIdx]);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIdx = historyIndex + 1;
        if (newIdx >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIdx);
          setInput(history[newIdx]);
        }
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = input.trim();
      const prompt = `${username}@${HOSTNAME}:${getCwdDisplay()}$ ${cmd}`;
      appendOutput([{ text: prompt, type: 'prompt' }]);

      if (cmd) {
        setHistory(prev => [...prev, cmd]);
        setHistoryIndex(-1);

        if (cmd === 'clear') {
          setOutput([]);
        } else {
          const result = executeCommand(cmd);
          appendOutput(result);
        }
      }
      setInput('');
    }

    if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      const prompt = `${username}@${HOSTNAME}:${getCwdDisplay()}$ ${input}^C`;
      appendOutput([{ text: prompt, type: 'prompt' }]);
      setInput('');
    }

    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setOutput([]);
    }
  };

  // ─── Render ANSI-like colors ───

  const renderLine = (text: string): React.ReactNode => {
    // Parse simple ANSI: \x1b[...m
    const parts: React.ReactNode[] = [];
    const regex = /\x1b\[([^m]*)m/g;
    let lastIndex = 0;
    let currentClass = '';
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={lastIndex} className={currentClass}>{text.slice(lastIndex, match.index)}</span>);
      }
      const code = match[1];
      if (code === '0') currentClass = '';
      else if (code === '1;34') currentClass = 'ansi-bold-blue';
      else if (code === '1;31') currentClass = 'ansi-bold-red';
      else if (code === '1;32') currentClass = 'ansi-bold-green';
      else if (code === '1;33') currentClass = 'ansi-bold-yellow';
      else if (code === '1;36') currentClass = 'ansi-bold-cyan';
      else if (code.startsWith('4')) currentClass = `ansi-bg-${code}`;
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(<span key={lastIndex} className={currentClass}>{text.slice(lastIndex)}</span>);
    }
    return parts.length > 0 ? <>{parts}</> : text;
  };

  return (
    <div className="terminal" onClick={handleTermClick}>
      <div className="term-output" ref={termRef}>
        {output.map((line, i) => (
          <div key={i} className={`term-line term-${line.type}`}>
            {renderLine(line.text)}
          </div>
        ))}
        {tabHint && <div className="term-line term-info">{tabHint}</div>}
        <div className="term-input-line">
          <span className="term-prompt">
            <span className="ansi-bold-green">{username}@{HOSTNAME}</span>
            <span className="term-prompt-sep">:</span>
            <span className="ansi-bold-blue">{getCwdDisplay()}</span>
            <span className="term-prompt-dollar">$ </span>
          </span>
          <input
            ref={inputRef}
            className="term-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
};

export default Terminal;
