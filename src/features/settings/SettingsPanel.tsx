import React, { useEffect, useMemo } from 'react';
import {
  X,
  RotateCcw,
  Sliders,
  FolderGit2,
  Laptop,
} from 'lucide-react';
import { useSettingsStore } from './store/useSettingsStore';
import { CATEGORY_METADATA, SETTINGS_SCHEMA, SettingDefinition } from './lib/settingsSchema';
import { searchSettings } from './lib/fuzzySearch';
import { CategoryTree } from './components/CategoryTree';
import { SettingRow } from './components/SettingRow';
import { AnsiSwatchGrid } from './components/AnsiSwatchGrid';
import { SettingsSearchBar } from './components/SettingsSearchBar';
import { useGitStore } from '../../store/useGitStore';

export const SettingsPanel: React.FC = () => {
  const {
    isOpen,
    closeSettings,
    activeScope,
    setActiveScope,
    selectedCategory,
    selectedSubcategory,
    searchQuery,
    resetAllSettings,
    loadSettings,
  } = useSettingsStore();

  const { activeRepoPath } = useGitStore();

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
    if (searchResults) return [];

    return SETTINGS_SCHEMA.filter((s) => {
      if (selectedCategory === 'commonly_used') {
        return s.commonlyUsed;
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-5xl h-[85vh] bg-base-0 border border-border-strong rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* Header bar: Title, Search, Scope Switcher, Close */}
        <header className="h-14 bg-base-1 border-b border-border px-5 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="p-2 bg-commito-coral/15 rounded-lg border border-commito-coral/30 text-commito-coral">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary tracking-wide">
                Settings
              </h2>
              <span className="text-[11px] text-text-muted">
                100% CSS design token & behavioral configuration
              </span>
            </div>
          </div>

          {/* Search bar */}
          <SettingsSearchBar matchCount={searchResults ? searchResults.length : undefined} />

          {/* Scope Selector & Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Scope tabs */}
            <div className="flex items-center bg-base-2 rounded-lg p-0.5 border border-border">
              <button
                type="button"
                onClick={() => setActiveScope('app')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeScope === 'app'
                    ? 'bg-base-0 text-text-primary shadow-xs font-semibold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="Global application settings"
              >
                <Laptop className="w-3.5 h-3.5 text-blue-400" />
                <span>Application</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveScope('repo')}
                disabled={!activeRepoPath}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                  !activeRepoPath
                    ? 'opacity-40 cursor-not-allowed text-text-muted'
                    : activeScope === 'repo'
                    ? 'bg-base-0 text-text-primary shadow-xs font-semibold cursor-pointer'
                    : 'text-text-muted hover:text-text-primary cursor-pointer'
                }`}
                title={
                  activeRepoPath
                    ? 'Settings scoped to current repository workspace'
                    : 'Open a repository to configure workspace settings'
                }
              >
                <FolderGit2 className="w-3.5 h-3.5 text-commito-coral" />
                <span>Workspace</span>
              </button>
            </div>

            {/* Reset all button */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset all custom settings and CSS tokens back to defaults?')) {
                  resetAllSettings();
                }
              }}
              className="p-2 text-text-muted hover:text-commito-coral hover:bg-base-2 rounded-lg border border-transparent hover:border-border transition cursor-pointer"
              title="Reset all settings to default values"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-border" />

            {/* Close button */}
            <button
              type="button"
              onClick={closeSettings}
              className="p-2 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-lg border border-transparent hover:border-border transition cursor-pointer"
              title="Close Settings (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Body: Category Sidebar + Right-hand Settings Content */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Category Tree */}
          <CategoryTree />

          {/* Right Content Area */}
          <main className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-base-3 bg-base-0">
            {/* 1. Search Results Mode */}
            {searchResults ? (
              <div className="space-y-4">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">
                      Search Results
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Found {searchResults.length} {searchResults.length === 1 ? 'setting' : 'settings'} matching &quot;{searchQuery}&quot;
                    </p>
                  </div>
                </div>

                {searchResults.length === 0 ? (
                  <div className="p-12 text-center text-text-muted italic">
                    No settings found matching &quot;{searchQuery}&quot;. Try searching for &quot;font&quot;, &quot;accent&quot;, &quot;diff&quot;, or &quot;terminal&quot;.
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
              <div className="space-y-6">
                {/* Category Header */}
                <div className="border-b border-border pb-3">
                  <h3 className="text-base font-bold text-text-primary">
                    {currentCategoryMeta?.label || selectedCategory}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {selectedCategory === 'commonly_used'
                      ? 'Quickly customize the most impactful appearance and behavior settings.'
                      : `Configure ${currentCategoryMeta?.label} preferences and CSS tokens.`}
                  </p>
                </div>

                {/* If Terminal category and on ANSI colors subcategory (or all terminal), render AnsiSwatchGrid */}
                {selectedCategory === 'terminal' && (!selectedSubcategory || selectedSubcategory === 'ANSI Colors') && (
                  <AnsiSwatchGrid />
                )}

                {/* Subcategory sections */}
                {groupedSettings.map(([subcategory, settings]) => {
                  // If terminal ANSI colors, we already showed the dedicated swatch grid above
                  if (selectedCategory === 'terminal' && subcategory === 'ANSI Colors') {
                    return null;
                  }

                  return (
                    <section key={subcategory} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                          {subcategory}
                        </h4>
                        <div className="flex-1 h-px bg-border/60" />
                      </div>

                      <div className="space-y-2.5">
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
