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
  const [isSessionAlive, setIsSessionAlive] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cursorPixelPos, setCursorPixelPos] = useState<{ x: number; y: number } | null>(null);

  const calculateCursorPosition = useCallback(() => {
    if (!repoId || !terminalContainerRef.current) return;
    const cached = terminalCache.get(repoId);
    if (!cached || !cached.terminal) return;

    const term = cached.terminal;
    const buffer = term.buffer.active;
    const cursorX = buffer.cursorX;
    const cursorY = buffer.cursorY;

    const container = terminalContainerRef.current;
    const screen = container.querySelector('.xterm-screen') as HTMLElement | null;

    const cols = term.cols || 80;
    const rows = term.rows || 24;

    const cellWidth = screen && cols > 0 ? screen.clientWidth / cols : 9;
    const cellHeight = screen && rows > 0 ? screen.clientHeight / rows : 17;

    const x = cursorX * cellWidth + 8;
    const y = (cursorY + 1) * cellHeight + 6;

    setCursorPixelPos({ x, y });
  }, [repoId]);

  const calculateCursorPositionRef = useRef(calculateCursorPosition);
  calculateCursorPositionRef.current = calculateCursorPosition;

  const inputBufferRef = useRef<string>('');
  const cursorPosRef = useRef<number>(0);
  const historyIndexRef = useRef<number>(-1);
  const localHistoryRef = useRef<string[]>([]);

  const autocomplete = useGitAutocomplete(repoPath);
  const autocompleteRef = useRef(autocomplete);
  autocompleteRef.current = autocomplete;

  const unlistenDataRef = useRef<UnlistenFn | null>(null);
  const unlistenExitRef = useRef<UnlistenFn | null>(null);
  const isMountedRef = useRef<boolean>(true);

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
        background: '#121113', // base-0
        foreground: '#e6e4e8', // text-primary
        cursor: '#e05638', // commito-coral
        cursorAccent: '#121113',
        selectionBackground: '#382221', // commito-activeBg
        black: '#171619',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#38bdf8',
        white: '#e6e4e8',
        brightBlack: '#85818c',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#7dd3fc',
        brightWhite: '#ffffff',
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

  const applySuggestionRef = useRef(applySuggestion);
  applySuggestionRef.current = applySuggestion;

  // Setup terminal mount, PTY connection, event listeners
  useEffect(() => {
    isMountedRef.current = true;
    if (!repoId || !repoPath || !terminalContainerRef.current) {
      return;
    }

    const { terminal, fitAddon, isInitialized } = getOrCreateTerminal(repoId);

    // Attach to DOM if not attached to current container
    if (terminal.element?.parentElement !== terminalContainerRef.current) {
      terminalContainerRef.current.innerHTML = '';
      terminal.open(terminalContainerRef.current);
    }

    const fitAndRefresh = () => {
      try {
        fitAddon.fit();
        terminal.refresh(0, terminal.rows - 1);
      } catch {}
    };

    fitAndRefresh();
    requestAnimationFrame(fitAndRefresh);
    const fitTimer = setTimeout(fitAndRefresh, 60);

    let isActive = true;

    const setupSession = async () => {
      try {
        // Replay history on first open
        if (!isInitialized) {
          try {
            const history = await ptyBridge.getHistory(repoId, 6, 0);
            if (history && history.length > 0 && isActive) {
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

        if (!isActive) return;

        // Open backend PTY session
        const sessionInfo = await ptyBridge.open(repoId, repoPath);
        if (!isActive) return;

        setIsSessionAlive(sessionInfo.is_alive);
        setSessionId(sessionInfo.session_id);

        // Sync size
        await ptyBridge.resize(repoId, terminal.cols, terminal.rows);
        if (!isActive) return;

        // Clean up previous listeners if any exist
        if (unlistenDataRef.current) {
          unlistenDataRef.current();
          unlistenDataRef.current = null;
        }
        if (unlistenExitRef.current) {
          unlistenExitRef.current();
          unlistenExitRef.current = null;
        }

        // Subscribe to PTY stream events
        const safeRepoId = repoId.replace(/\\/g, '/').replace(/:/g, '_');
        const unData = await listen<string>(`terminal:${safeRepoId}:data`, (event) => {
          if (event.payload && isMountedRef.current) {
            terminal.write(event.payload);
          }
        });

        const unExit = await listen<void>(`terminal:${safeRepoId}:exit`, () => {
          if (isMountedRef.current) {
            setIsSessionAlive(false);
            terminal.writeln('\r\n\x1b[33m[Process completed]\x1b[0m\r\n');
          }
        });

        if (!isActive) {
          unData();
          unExit();
        } else {
          unlistenDataRef.current = unData;
          unlistenExitRef.current = unExit;
        }
      } catch (err) {
        if (isActive) {
          console.error('Failed to open terminal session:', err);
          terminal.writeln(`\r\n\x1b[31m[Failed to launch terminal process: ${err}]\x1b[0m\r\n`);
        }
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
            applySuggestionRef.current(selected.value, auto.suggestions.length === 1);
            return;
          }
        }
        // If single candidate or trigger autocomplete
        auto.updateSuggestions(inputBufferRef.current, cursorPosRef.current);
        setTimeout(() => calculateCursorPositionRef.current(), 0);
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
          applySuggestionRef.current(top.value, true);
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
          setTimeout(() => calculateCursorPositionRef.current(), 0);
        }
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        // Printable character
        inputBufferRef.current =
          inputBufferRef.current.slice(0, cursorPosRef.current) +
          data +
          inputBufferRef.current.slice(cursorPosRef.current);
        cursorPosRef.current += 1;
        auto.updateSuggestions(inputBufferRef.current, cursorPosRef.current);
        setTimeout(() => calculateCursorPositionRef.current(), 0);
      }

      // Forward keystroke to backend PTY
      ptyBridge.write(repoId, data);
    });

    const onCursorMoveDisposable = terminal.onCursorMove(() => {
      calculateCursorPositionRef.current();
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        calculateCursorPositionRef.current();
        if (repoId && terminal.cols > 0 && terminal.rows > 0) {
          ptyBridge.resize(repoId, terminal.cols, terminal.rows).catch(() => {});
        }
      } catch {}
    });

    if (terminalContainerRef.current) {
      resizeObserver.observe(terminalContainerRef.current);
    }

    return () => {
      isActive = false;
      clearTimeout(fitTimer);
      onDataDisposable.dispose();
      onCursorMoveDisposable.dispose();
      resizeObserver.disconnect();
      if (unlistenDataRef.current) {
        unlistenDataRef.current();
        unlistenDataRef.current = null;
      }
      if (unlistenExitRef.current) {
        unlistenExitRef.current();
        unlistenExitRef.current = null;
      }
    };
  }, [repoId, repoPath, getOrCreateTerminal]);

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

  const fitTerminal = useCallback(() => {
    if (!repoId) return;
    const cached = terminalCache.get(repoId);
    if (cached) {
      try {
        cached.fitAddon.fit();
      } catch {}
    }
  }, [repoId]);

  return {
    terminalContainerRef,
    isSessionAlive,
    sessionId,
    autocomplete,
    cursorPixelPos,
    clearTerminal,
    restartTerminal,
    fitTerminal,
    searchInTerminal,
    applySuggestion,
  };
}
