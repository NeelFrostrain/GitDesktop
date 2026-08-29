import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { useSettingsStore } from './store/useSettingsStore';
import { CATEGORY_METADATA, SETTINGS_SCHEMA, SettingDefinition } from './lib/settingsSchema';
import { searchSettings } from './lib/fuzzySearch';
import { CategoryTree } from './components/CategoryTree';
import { SettingRow } from './components/SettingRow';
import { AiSettingsTab } from './components/AiSettingsTab';
import { SettingsSearchBar } from './components/SettingsSearchBar';
import { useGitStore } from '../../store/useGitStore';

export const SettingsPanel: React.FC = () => {
  const {
    isOpen,
    closeSettings,
    selectedCategory,
    selectedSubcategory,
    searchQuery,
    resetAllSettings,
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

  const startResizingSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  };

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!modalContainerRef.current) return;
      const modalRect = modalContainerRef.current.getBoundingClientRect();
      const newWidth = Math.max(160, Math.min(360, e.clientX - modalRect.left));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      try {
        localStorage.setItem('settings_sidebar_width', sidebarWidth.toString());
      } catch {}
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizingSidebar, sidebarWidth]);

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

  const currentCategoryMeta = CATEGORY_METADATA[selectedCategory];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div
        ref={modalContainerRef}
        className="relative w-full max-w-4xl h-[85vh] bg-base-0 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col font-sans ring-1 ring-black/40"
      >
        {/* Header */}
        <header className="px-4 py-2.5 bg-base-1/90 border-b border-border flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <div className="w-5 h-5 rounded-sm bg-commito-coral/10 border border-commito-coral/25 text-commito-coral flex items-center justify-center shrink-0 shadow-2xs">
              <Sliders className="w-3 h-3" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-xs font-bold text-text-primary leading-none">
                Settings
              </h2>
              <span className="text-border text-[10px]">•</span>
              <span className="text-[10.5px] text-text-muted truncate hidden sm:inline font-mono">
                Preferences &amp; Configuration
              </span>
            </div>
          </div>

          {/* Search bar */}
          <SettingsSearchBar matchCount={searchResults ? searchResults.length : undefined} />

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Reset all button */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset all custom settings back to defaults?')) {
                  resetAllSettings();
                }
              }}
              className="p-1.5 text-text-muted hover:text-commito-coral hover:bg-base-2 rounded-sm border border-transparent hover:border-border transition cursor-pointer"
              title="Reset all settings to default values"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="h-3.5 w-px bg-border my-auto mx-0.5" />

            {/* Close button */}
            <button
              type="button"
              onClick={closeSettings}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-sm border border-transparent hover:border-border transition cursor-pointer"
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
          <main className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-base-3 bg-base-0">
            {/* 1. Search Results Mode */}
            {searchResults ? (
              <div className="space-y-4">
                <div className="border-b border-border/70 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-text-primary">
                      Search Results
                    </h3>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Found {searchResults.length} {searchResults.length === 1 ? 'setting' : 'settings'} matching &quot;{searchQuery}&quot;
                    </p>
                  </div>
                </div>

                {searchResults.length === 0 ? (
                  <div className="p-12 text-center text-text-muted italic text-xs">
                    No settings found matching &quot;{searchQuery}&quot;. Try searching for &quot;gemini&quot;, &quot;model&quot;, or &quot;api&quot;.
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
              <div className="space-y-5">
                {/* Category Header */}
                <div className="border-b border-border/70 pb-3">
                  <h3 className="text-xs font-bold text-text-primary tracking-tight">
                    {currentCategoryMeta?.label || 'AI & Commit-AI'}
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                    Configure Google Gemini API keys, active model rotation, and AI commit generation parameters.
                  </p>
                </div>

                {/* Render dedicated AiSettingsTab with multi-key pool */}
                {selectedCategory === 'ai' && <AiSettingsTab />}

                {/* Subcategory sections (for other non-AI categories) */}
                {groupedSettings.map(([subcategory, settings]) => {
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
