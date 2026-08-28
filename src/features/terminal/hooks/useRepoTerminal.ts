import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { ptyBridge } from '../lib/ptyBridge';
import { useGitAutocomplete } from './useGitAutocomplete';

interface CachedTerminalEntry {
  terminal: Terminal;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
  isSessionActive: boolean;
}

// Global cache of Terminal instances per repository path
const terminalCache = new Map<string, CachedTerminalEntry>();

export function useRepoTerminal(
  repoId: string | null,
  repoPath: string | null,
  isEnabled: boolean = true
) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const [isSessionAlive, setIsSessionAlive] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cursorPixelPos, setCursorPixelPos] = useState<{ x: number; y: number } | null>(null);

  const inputBufferRef = useRef<string>('');
  const cursorPosRef = useRef<number>(0);
  const localHistoryRef = useRef<string[]>([]);

  const autocomplete = useGitAutocomplete(isEnabled ? repoPath : null);
  const autocompleteRef = useRef(autocomplete);
  autocompleteRef.current = autocomplete;

  const unlistenDataRef = useRef<UnlistenFn | null>(null);
  const unlistenExitRef = useRef<UnlistenFn | null>(null);
  const onDataDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const isMountedRef = useRef<boolean>(true);

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

  // Initialize or retrieve cached terminal instance
  const getOrCreateTerminal = useCallback((id: string): CachedTerminalEntry => {
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

    const entry: CachedTerminalEntry = {
      terminal: term,
      fitAddon: fit,
      searchAddon: search,
      isSessionActive: false,
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
    if (!isEnabled || !repoId || !repoPath || !terminalContainerRef.current) {
      setIsSessionAlive(false);
      return;
    }

    const currentRepoId = repoId;
    const currentRepoPath = repoPath;
    const entry = getOrCreateTerminal(currentRepoId);
    const { terminal, fitAddon } = entry;

    // Attach to DOM safely
    if (terminalContainerRef.current) {
      if (!terminal.element) {
        terminalContainerRef.current.innerHTML = '';
        terminal.open(terminalContainerRef.current);
      } else if (terminal.element.parentElement !== terminalContainerRef.current) {
        terminalContainerRef.current.innerHTML = '';
        terminalContainerRef.current.appendChild(terminal.element);
      }
    }

    const fitAndRefresh = () => {
      try {
        fitAddon.fit();
        terminal.refresh(0, terminal.rows - 1);
        terminal.focus();
      } catch {}
    };

    fitAndRefresh();
    const fitTimer1 = setTimeout(fitAndRefresh, 40);
    const fitTimer2 = setTimeout(fitAndRefresh, 120);

    let isEffectActive = true;

    const setupSession = async () => {
      try {
        if (!entry.isSessionActive) {
          // Populate command history silently without spamming ASCII art in terminal buffer
          try {
            const history = await ptyBridge.getHistory(currentRepoId, 50, 0);
            if (history && history.length > 0) {
              for (const h of history) {
                localHistoryRef.current.push(h.cmd);
              }
            }
          } catch {}

          entry.isSessionActive = true;
        }

        if (!isEffectActive) return;

        // Open or connect backend PTY session
        const sessionInfo = await ptyBridge.open(currentRepoId, currentRepoPath);
        if (!isEffectActive) return;

        setIsSessionAlive(sessionInfo.is_alive);
        setSessionId(sessionInfo.session_id);

        if (terminal.cols > 0 && terminal.rows > 0) {
          await ptyBridge.resize(currentRepoId, terminal.cols, terminal.rows).catch(() => {});
        }
        if (!isEffectActive) return;

        // Clean up previous listeners if any
        if (unlistenDataRef.current) {
          unlistenDataRef.current();
          unlistenDataRef.current = null;
        }
        if (unlistenExitRef.current) {
          unlistenExitRef.current();
          unlistenExitRef.current = null;
        }

        // Subscribe to PTY stream events
        const safeRepoId = currentRepoId.replace(/\\/g, '/').replace(/:/g, '_');
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

        if (!isEffectActive) {
          unData();
          unExit();
        } else {
          unlistenDataRef.current = unData;
          unlistenExitRef.current = unExit;
        }
      } catch (err) {
        if (isEffectActive) {
          console.error('Failed to open terminal session:', err);
          terminal.writeln(`\r\n\x1b[31m[Failed to launch terminal process: ${err}]\x1b[0m\r\n`);
        }
      }
    };

    setupSession();

    // Attach custom keyboard handler for copy/paste and shortcuts
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.type !== 'keydown') return true;

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      // 1. Copy shortcut: Ctrl+C / Cmd+C (when text is selected) or Ctrl+Shift+C or Ctrl+Insert
      if (
        (isCtrlOrCmd && (event.key === 'c' || event.key === 'C')) ||
        (event.ctrlKey && event.shiftKey && (event.key === 'c' || event.key === 'C')) ||
        (event.ctrlKey && event.key === 'Insert')
      ) {
        if (terminal.hasSelection()) {
          const selected = terminal.getSelection();
          if (selected) {
            navigator.clipboard.writeText(selected).catch(() => {});
            return false; // Handled: copy selection to clipboard, do not send \x03 (SIGINT) to PTY
          }
        }
        // No selection: let standard Ctrl+C pass through to send SIGINT (\x03) to process
        return true;
      }

      // 2. Paste shortcut: Ctrl+V / Cmd+V / Ctrl+Shift+V / Shift+Insert
      if (
        (isCtrlOrCmd && (event.key === 'v' || event.key === 'V')) ||
        (event.ctrlKey && event.shiftKey && (event.key === 'v' || event.key === 'V')) ||
        (event.shiftKey && event.key === 'Insert')
      ) {
        event.preventDefault();
        event.stopPropagation();
        navigator.clipboard
          .readText()
          .then((clipText) => {
            if (clipText && clipText.length > 0 && currentRepoId) {
              const normalized = clipText.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
              ptyBridge.write(currentRepoId, normalized).catch(() => {});

              if (!clipText.includes('\n') && !clipText.includes('\r')) {
                inputBufferRef.current =
                  inputBufferRef.current.slice(0, cursorPosRef.current) +
                  clipText +
                  inputBufferRef.current.slice(cursorPosRef.current);
                cursorPosRef.current += clipText.length;
              } else {
                inputBufferRef.current = '';
                cursorPosRef.current = 0;
              }
            }
          })
          .catch((err) => {
            console.warn('[Terminal] Failed to read clipboard text:', err);
          });
        return false; // Prevent xterm from sending raw \x16 to PTY
      }

      return true;
    });

    // Right-click paste or copy context handler
    const container = terminalContainerRef.current;
    const handleContextMenu = async (e: MouseEvent) => {
      e.preventDefault();
      if (terminal.hasSelection()) {
        const selected = terminal.getSelection();
        if (selected) {
          await navigator.clipboard.writeText(selected).catch(() => {});
          terminal.clearSelection();
          return;
        }
      }
      try {
        const text = await navigator.clipboard.readText();
        if (text && currentRepoId) {
          const normalized = text.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
          await ptyBridge.write(currentRepoId, normalized);
        }
      } catch (err) {
        console.warn('[Terminal] Right-click paste failed:', err);
      }
    };

    if (container) {
      container.addEventListener('contextmenu', handleContextMenu);
    }

    // Clean previous onData disposable if any
    if (onDataDisposableRef.current) {
      onDataDisposableRef.current.dispose();
      onDataDisposableRef.current = null;
    }

    // Keystroke handler attached to terminal
    const onDataDisposable = terminal.onData((data) => {
      if (!currentRepoId) return;

      const auto = autocompleteRef.current;

      // Handle Enter (Execute command)
      if (data === '\r' || data === '\n') {
        const fullCmd = inputBufferRef.current.trim();
        if (fullCmd.length > 0) {
          localHistoryRef.current.push(fullCmd);
          ptyBridge.recordHistory(currentRepoId, fullCmd).catch(() => {});
        }
        inputBufferRef.current = '';
        cursorPosRef.current = 0;
        auto.clearSuggestions();
        ptyBridge.write(currentRepoId, data);
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
        auto.updateSuggestions(inputBufferRef.current, cursorPosRef.current);
        setTimeout(() => calculateCursorPositionRef.current(), 0);
        return;
      }

      // Handle Space
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

      // Handle Escape
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
      ptyBridge.write(currentRepoId, data);
    });

    onDataDisposableRef.current = onDataDisposable;

    const onCursorMoveDisposable = terminal.onCursorMove(() => {
      calculateCursorPositionRef.current();
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        calculateCursorPositionRef.current();
        if (currentRepoId && terminal.cols > 0 && terminal.rows > 0) {
          ptyBridge.resize(currentRepoId, terminal.cols, terminal.rows).catch(() => {});
        }
      } catch {}
    });

    if (terminalContainerRef.current) {
      resizeObserver.observe(terminalContainerRef.current);
    }

    return () => {
      isEffectActive = false;
      clearTimeout(fitTimer1);
      clearTimeout(fitTimer2);
      onDataDisposable.dispose();
      onCursorMoveDisposable.dispose();
      resizeObserver.disconnect();
      if (container) {
        container.removeEventListener('contextmenu', handleContextMenu);
      }
      if (unlistenDataRef.current) {
        unlistenDataRef.current();
        unlistenDataRef.current = null;
      }
      if (unlistenExitRef.current) {
        unlistenExitRef.current();
        unlistenExitRef.current = null;
      }
    };
  }, [isEnabled, repoId, repoPath, getOrCreateTerminal]);

  // Actions
  const clearTerminal = useCallback(() => {
    if (!repoId) return;
    const cached = terminalCache.get(repoId);
    if (cached) {
      cached.terminal.clear();
      cached.terminal.write('\x1b[2J\x1b[3J\x1b[H');
      // Send Ctrl+L (Form Feed / clear screen) to underlying PTY process
      ptyBridge.write(repoId, '\x0c').catch(() => {});
    }
  }, [repoId]);

  const restartTerminal = useCallback(async () => {
    if (!isEnabled || !repoId || !repoPath) return;
    const cached = terminalCache.get(repoId);
    if (cached) {
      cached.terminal.reset();
      cached.terminal.writeln('\x1b[33m[Restarting terminal session...]\x1b[0m\r\n');
    }
    await ptyBridge.kill(repoId).catch(() => {});
    const sessionInfo = await ptyBridge.open(repoId, repoPath);
    setIsSessionAlive(sessionInfo.is_alive);
    setSessionId(sessionInfo.session_id);
    if (cached) {
      await ptyBridge.resize(repoId, cached.terminal.cols, cached.terminal.rows).catch(() => {});
    }
  }, [isEnabled, repoId, repoPath]);

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
