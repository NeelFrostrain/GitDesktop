import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useSettingsStore } from './store/useSettingsStore';
import { SETTINGS_SCHEMA, SettingDefinition } from './lib/settingsSchema';
import { searchSettings } from './lib/fuzzySearch';
import { CategoryTree } from './components/CategoryTree';
import { SettingRow } from './components/SettingRow';
import { AiSettingsTab } from './components/AiSettingsTab';
import { ThemeSelectorTab } from './components/ThemeSelectorTab';
import { LegalTab } from './components/LegalTab';
import { SettingsSearchBar } from './components/SettingsSearchBar';
import { useGitStore } from '../../store/useGitStore';

export const SettingsPanel: React.FC = () => {
  const {
    isOpen,
    closeSettings,
    selectedCategory,
    selectedSubcategory,
    searchQuery,
    loadSettings,
  } = useSettingsStore();

  const { activeRepoPath } = useGitStore();

  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('settings_sidebar_width');
      return saved ? Math.max(160, Math.min(360, parseInt(saved, 10))) : 200;
    } catch {
      return 200;
    }
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const latestSidebarWidthRef = useRef(sidebarWidth);
  latestSidebarWidthRef.current = sidebarWidth;

  const startResizingSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  };

  useEffect(() => {
    if (!isResizingSidebar) return;

    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!modalContainerRef.current) return;
        const modalRect = modalContainerRef.current.getBoundingClientRect();
        const newWidth = Math.max(160, Math.min(360, e.clientX - modalRect.left));
        latestSidebarWidthRef.current = newWidth;
        setSidebarWidth(newWidth);
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsResizingSidebar(false);
      try {
        localStorage.setItem('settings_sidebar_width', latestSidebarWidthRef.current.toString());
      } catch {}
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingSidebar]);

  // Load settings on mount / repo change
  useEffect(() => {
    loadSettings(activeRepoPath);
  }, [activeRepoPath, loadSettings]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSettings();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeSettings]);

  // Search matches
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchSettings(searchQuery);
  }, [searchQuery]);

  // Filter settings for active category / subcategory
  const activeSettings = useMemo(() => {
    if (searchResults || selectedCategory === 'ai') return [];

    return SETTINGS_SCHEMA.filter((s) => {
      if (s.category !== selectedCategory) {
        return false;
      }
      if (selectedSubcategory && s.subcategory !== selectedSubcategory) {
        return false;
      }
      return true;
    });
  }, [selectedCategory, selectedSubcategory, searchResults]);

  // Group active settings by subcategory
  const groupedSettings = useMemo(() => {
    const map = new Map<string, SettingDefinition[]>();
    activeSettings.forEach((s) => {
      const sub = s.subcategory || 'General';
      if (!map.has(sub)) map.set(sub, []);
      map.get(sub)!.push(s);
    });
    return Array.from(map.entries());
  }, [activeSettings]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div
        ref={modalContainerRef}
        className="relative w-full max-w-5xl h-[85vh] bg-base-0 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col font-sans ring-1 ring-black/40"
      >
        {/* Header */}
        <header className="h-9 px-1.5 bg-base-1/50 border-b border-border flex items-center justify-between gap-3 flex-shrink-0">
          <h2 className="text-xs font-semibold text-text-primary pl-1.5">Settings</h2>

          <div className="flex items-center gap-2">
            <SettingsSearchBar matchCount={searchResults ? searchResults.length : undefined} />
            <button
              type="button"
              onClick={closeSettings}
              className="p-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-sm transition cursor-pointer"
              title="Close Settings (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Main Body: Resizable Category Sidebar + Right-hand Settings Content */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Category Tree */}
          <CategoryTree style={{ width: `${sidebarWidth}px` }} />

          {/* Resizable Divider Splitter Handle */}
          <div
            onMouseDown={startResizingSidebar}
            onDoubleClick={() => setSidebarWidth(200)}
            title="Drag to resize • Double-click to reset"
            className={`w-1 h-full cursor-col-resize z-20 shrink-0 transition-colors relative group/resizer hover:bg-commito-coral/50 ${
              isResizingSidebar ? 'bg-commito-coral' : 'bg-transparent'
            }`}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>

          {/* Right Content Area */}
          <main className="flex-1 overflow-y-auto p-2 px-1.5 space-y-4 scrollbar-thin scrollbar-thumb-base-3 bg-base-0">
            {/* 1. Search Results Mode */}
            {searchResults ? (
              <div className="space-y-4">
                <div className="border-b border-border/70 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-text-primary">Search Results</h3>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Found {searchResults.length}{' '}
                      {searchResults.length === 1 ? 'setting' : 'settings'} matching &quot;
                      {searchQuery}&quot;
                    </p>
                  </div>
                </div>

                {searchResults.length === 0 ? (
                  <div className="p-12 text-center text-text-muted italic text-xs">
                    No settings found matching &quot;{searchQuery}&quot;. Try searching for
                    &quot;gemini&quot;, &quot;model&quot;, or &quot;api&quot;.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map(({ setting, breadcrumbs }) => (
                      <div key={setting.id} className="space-y-1.5">
                        <div className="text-[10px] font-mono text-text-muted flex items-center gap-1.5 px-1">
                          {breadcrumbs.map((b, i) => (
                            <React.Fragment key={b}>
                              <span>{b}</span>
                              {i < breadcrumbs.length - 1 && <span>›</span>}
                            </React.Fragment>
                          ))}
                        </div>
                        <SettingRow setting={setting} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* 2. Category View Mode */
              <div className="space-y-4 h-full flex flex-col">
                {/* Render dedicated AppearanceTab for theme selection only when viewing All Appearance or Color Theme */}
                {selectedCategory === 'appearance' &&
                  (!selectedSubcategory || selectedSubcategory === 'Color Theme') && (
                    <ThemeSelectorTab />
                  )}

                {/* Render dedicated AiSettingsTab with multi-key pool */}
                {selectedCategory === 'ai' && <AiSettingsTab />}

                {/* Render Legal tab */}
                {selectedCategory === 'legal' && <LegalTab />}

                {/* Subcategory sections */}
                {groupedSettings
                  .filter(([subcategory]) => {
                    // Hide duplicate generic Color Theme dropdown when ThemeSelectorTab is already rendered
                    if (
                      selectedCategory === 'appearance' &&
                      (!selectedSubcategory || selectedSubcategory === 'Color Theme') &&
                      subcategory === 'Color Theme'
                    ) {
                      return false;
                    }
                    return true;
                  })
                  .map(([subcategory, settings]) => {
                    return (
                      <section key={subcategory} className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                            {subcategory}
                          </h4>
                          <div className="flex-1 h-px bg-border/50" />
                        </div>

                        <div className="space-y-2">
                          {settings.map((setting) => (
                            <SettingRow key={setting.id} setting={setting} />
                          ))}
                        </div>
                      </section>
                    );
                  })}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
