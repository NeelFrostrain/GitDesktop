import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { ptyBridge } from '../lib/ptyBridge';
import { useGitAutocomplete } from './useGitAutocomplete';
import '@xterm/xterm/css/xterm.css';

// Global cache of Terminal instances per repository path to preserve buffer state
const terminalCache = new Map<
  string,
  {
    terminal: Terminal;
    fitAddon: FitAddon;
    searchAddon: SearchAddon;
    isInitialized: boolean;
  }
>();

export function useRepoTerminal(repoId: string | null, repoPath: string | null) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const [isSessionAlive, setIsSessionAlive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const inputBufferRef = useRef<string>('');
  const cursorPosRef = useRef<number>(0);
  const historyIndexRef = useRef<number>(-1);
  const localHistoryRef = useRef<string[]>([]);

  const autocomplete = useGitAutocomplete(repoPath);
  const autocompleteRef = useRef(autocomplete);
  autocompleteRef.current = autocomplete;

  // Initialize or retrieve cached terminal instance
  const getOrCreateTerminal = useCallback((id: string) => {
    if (terminalCache.has(id)) {
      return terminalCache.get(id)!;
    }

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 12.5,
      fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
      letterSpacing: 0,
      lineHeight: 1.25,
      scrollback: 5000,
      theme: {
        background: '#0a0d12',
        foreground: '#e6edf3',
        cursor: '#f36a36',
        cursorAccent: '#0a0d12',
        selectionBackground: '#264f78',
        black: '#0a0d12',
        red: '#f85149',
        green: '#2ea043',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#484f58',
        brightRed: '#ff7b72',
        brightGreen: '#3fb950',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
    });

    const fit = new FitAddon();
    const search = new SearchAddon();
    term.loadAddon(fit);
    term.loadAddon(search);

    const entry = {
      terminal: term,
      fitAddon: fit,
      searchAddon: search,
      isInitialized: false,
    };

    terminalCache.set(id, entry);
    return entry;
  }, []);

  // Complete a suggestion and send delta keystrokes to PTY
  const applySuggestion = useCallback(
    async (suggestionValue: string, appendSpace = false) => {
      if (!repoId) return;

      const currentLine = inputBufferRef.current;
      const currentPos = cursorPosRef.current;
      const slice = currentLine.slice(0, currentPos);
      const tokens = slice.split(/\s+/);
      const currentToken = tokens[tokens.length - 1] || '';

      const remainder = suggestionValue.startsWith(currentToken)
        ? suggestionValue.slice(currentToken.length)
        : suggestionValue;

      const toInsert = remainder + (appendSpace ? ' ' : '');

      if (toInsert.length > 0) {
        await ptyBridge.write(repoId, toInsert);
        inputBufferRef.current =
          currentLine.slice(0, currentPos) + toInsert + currentLine.slice(currentPos);
        cursorPosRef.current += toInsert.length;
      }

      autocompleteRef.current.clearSuggestions();
    },
    [repoId]
  );

  // Setup terminal mount, PTY connection, event listeners
  useEffect(() => {
    if (!repoId || !repoPath || !terminalContainerRef.current) {
      return;
    }

    const { terminal, fitAddon, isInitialized } = getOrCreateTerminal(repoId);

    // Attach to DOM if not attached to current container
    if (terminal.element?.parentElement !== terminalContainerRef.current) {
      terminalContainerRef.current.innerHTML = '';
      terminal.open(terminalContainerRef.current);
    }

    fitAddon.fit();

    let unlistenData: UnlistenFn | undefined;
    let unlistenExit: UnlistenFn | undefined;

    const setupSession = async () => {
      try {
        // Replay history on first open
        if (!isInitialized) {
          try {
            const history = await ptyBridge.getHistory(repoId, 6, 0);
            if (history && history.length > 0) {
              terminal.writeln('\x1b[90m┌── Previous Session Commands ──────────────────────────┐\x1b[0m');
              for (const entry of history) {
                localHistoryRef.current.push(entry.cmd);
                terminal.writeln(`\x1b[90m│ $ ${entry.cmd}\x1b[0m`);
              }
              terminal.writeln('\x1b[90m└── live interactive session started ────────────────────┘\x1b[0m\r\n');
            }
          } catch {}

          const cached = terminalCache.get(repoId);
          if (cached) cached.isInitialized = true;
        }

        // Open backend PTY session
        const sessionInfo = await ptyBridge.open(repoId, repoPath);
        setIsSessionAlive(sessionInfo.is_alive);
        setSessionId(sessionInfo.session_id);

        // Sync size
        await ptyBridge.resize(repoId, terminal.cols, terminal.rows);

        // Subscribe to PTY stream events
        unlistenData = await listen<string>(`terminal:${repoId}:data`, (event) => {
          if (event.payload) {
            terminal.write(event.payload);
          }
        });

        unlistenExit = await listen<void>(`terminal:${repoId}:exit`, () => {
          setIsSessionAlive(false);
          terminal.writeln('\r\n\x1b[33m[Process completed]\x1b[0m\r\n');
        });
      } catch (err) {
        console.error('Failed to open terminal session:', err);
        terminal.writeln(`\r\n\x1b[31m[Failed to launch terminal process: ${err}]\x1b[0m\r\n`);
      }
    };

    setupSession();

    // Keystroke handler attached to terminal
    const onDataDisposable = terminal.onData((data) => {
      if (!repoId) return;

      const auto = autocompleteRef.current;

      // Handle Enter (Execute command)
      if (data === '\r' || data === '\n') {
        const fullCmd = inputBufferRef.current.trim();
        if (fullCmd.length > 0) {
          localHistoryRef.current.push(fullCmd);
          ptyBridge.recordHistory(repoId, fullCmd).catch(() => {});
        }
        inputBufferRef.current = '';
        cursorPosRef.current = 0;
        historyIndexRef.current = -1;
        auto.clearSuggestions();
        ptyBridge.write(repoId, data);
        return;
      }

      // Handle Tab (Autocomplete)
      if (data === '\t') {
        if (auto.suggestions.length > 0) {
          const selected = auto.suggestions[auto.selectedIndex || 0];
          if (selected) {
            applySuggestion(selected.value, auto.suggestions.length === 1);
            return;
          }
        }
        // If single candidate or trigger autocomplete
        auto.updateSuggestions(inputBufferRef.current, cursorPosRef.current);
        return;
      }

      // Handle Space (Autocomplete on space if single unambiguous suggestion & safe position)
      if (data === ' ') {
        if (
          auto.isVisible &&
          auto.suggestions.length === 1 &&
          !auto.isInsideQuotes(inputBufferRef.current, cursorPosRef.current)
        ) {
          const top = auto.suggestions[0];
          applySuggestion(top.value, true);
          return;
        }
      }

      // Handle Escape (Dismiss popup)
      if (data === '\x1b') {
        if (auto.isVisible) {
          auto.clearSuggestions();
          return;
        }
      }

      // Handle Arrow Up / Down in autocomplete popup
      if (data === '\x1b[A' && auto.isVisible) {
        auto.selectPrev();
        return;
      }
      if (data === '\x1b[B' && auto.isVisible) {
        auto.selectNext();
        return;
      }

      // Handle Backspace (ASCII 127 or 8)
      if (data === '\x7f' || data === '\b') {
        if (cursorPosRef.current > 0) {
          cursorPosRef.current -= 1;
          inputBufferRef.current =
            inputBufferRef.current.slice(0, cursorPosRef.current) +
            inputBufferRef.current.slice(cursorPosRef.current + 1);
          auto.updateSuggestions(inputBufferRef.current, cursorPosRef.current);
        }
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        // Printable character
        inputBufferRef.current =
          inputBufferRef.current.slice(0, cursorPosRef.current) +
          data +
          inputBufferRef.current.slice(cursorPosRef.current);
        cursorPosRef.current += 1;
        auto.updateSuggestions(inputBufferRef.current, cursorPosRef.current);
      }

      // Forward keystroke to backend PTY
      ptyBridge.write(repoId, data);
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (repoId && terminal.cols > 0 && terminal.rows > 0) {
          ptyBridge.resize(repoId, terminal.cols, terminal.rows).catch(() => {});
        }
      } catch {}
    });

    if (terminalContainerRef.current) {
      resizeObserver.observe(terminalContainerRef.current);
    }

    return () => {
      onDataDisposable.dispose();
      resizeObserver.disconnect();
      if (unlistenData) unlistenData();
      if (unlistenExit) unlistenExit();
    };
  }, [repoId, repoPath, getOrCreateTerminal, applySuggestion]);

  // Actions
  const clearTerminal = useCallback(() => {
    if (!repoId) return;
    const cached = terminalCache.get(repoId);
    if (cached) {
      cached.terminal.clear();
    }
  }, [repoId]);

  const restartTerminal = useCallback(async () => {
    if (!repoId || !repoPath) return;
    const cached = terminalCache.get(repoId);
    if (cached) {
      cached.terminal.clear();
      cached.terminal.writeln('\x1b[33m[Restarting terminal session...]\x1b[0m\r\n');
    }
    await ptyBridge.kill(repoId).catch(() => {});
    const sessionInfo = await ptyBridge.open(repoId, repoPath);
    setIsSessionAlive(sessionInfo.is_alive);
    setSessionId(sessionInfo.session_id);
    if (cached) {
      await ptyBridge.resize(repoId, cached.terminal.cols, cached.terminal.rows);
    }
  }, [repoId, repoPath]);

  const searchInTerminal = useCallback(
    (query: string, findNext = true) => {
      if (!repoId) return;
      const cached = terminalCache.get(repoId);
      if (cached && query) {
        if (findNext) {
          cached.searchAddon.findNext(query);
        } else {
          cached.searchAddon.findPrevious(query);
        }
      }
    },
    [repoId]
  );

  return {
    terminalContainerRef,
    isSessionAlive,
    sessionId,
    autocomplete,
    clearTerminal,
    restartTerminal,
    searchInTerminal,
    applySuggestion,
  };
}
