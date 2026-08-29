import { create } from 'zustand';

interface TerminalState {
  isOpen: boolean;
  panelHeight: number;
  isLogViewerOpen: boolean;
  activeLogRepoId: string | null;
  activeLogSessionId: string | null;
  searchQuery: string;
  isSearchOpen: boolean;

  setIsOpen: (isOpen: boolean) => void;
  toggleIsOpen: () => void;
  setPanelHeight: (height: number) => void;
  openLogViewer: (repoId: string, sessionId?: string) => void;
  closeLogViewer: () => void;
  setSearchQuery: (query: string) => void;
  setIsSearchOpen: (open: boolean) => void;
}

const getStoredHeight = (): number => {
  try {
    const saved = localStorage.getItem('terminal_panel_height');
    if (saved) return Math.max(140, Math.min(900, parseInt(saved, 10)));
    // Default: ~30% of available height
    return Math.round(Math.max(140, window.innerHeight * 0.3));
  } catch {
    return 300;
  }
};

const getStoredIsOpen = (): boolean => {
  try {
    const saved = localStorage.getItem('terminal_panel_open');
    return saved === 'true';
  } catch {
    return false;
  }
};

export const useTerminalStore = create<TerminalState>((set) => ({
  isOpen: getStoredIsOpen(),
  panelHeight: getStoredHeight(),
  isLogViewerOpen: false,
  activeLogRepoId: null,
  activeLogSessionId: null,
  searchQuery: '',
  isSearchOpen: false,

  setIsOpen: (isOpen) => {
    try {
      localStorage.setItem('terminal_panel_open', isOpen.toString());
    } catch {}
    set({ isOpen });
  },

  toggleIsOpen: () => {
    set((state) => {
      const next = !state.isOpen;
      try {
        localStorage.setItem('terminal_panel_open', next.toString());
      } catch {}
      return { isOpen: next };
    });
  },

  setPanelHeight: (panelHeight) => {
    const clamped = Math.max(140, Math.min(900, panelHeight));
    try {
      localStorage.setItem('terminal_panel_height', clamped.toString());
    } catch {}
    set({ panelHeight: clamped });
  },

  openLogViewer: (repoId, sessionId) => {
    set({
      isLogViewerOpen: true,
      activeLogRepoId: repoId,
      activeLogSessionId: sessionId || null,
    });
  },

  closeLogViewer: () => {
    set({
      isLogViewerOpen: false,
      activeLogRepoId: null,
      activeLogSessionId: null,
    });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setIsSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
}));
