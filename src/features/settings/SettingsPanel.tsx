import React, { useEffect, useMemo } from 'react';
import {
  X,
  RotateCcw,
} from 'lucide-react';
import { useSettingsStore } from './store/useSettingsStore';
import { CATEGORY_METADATA, SETTINGS_SCHEMA, SettingDefinition } from './lib/settingsSchema';
import { searchSettings } from './lib/fuzzySearch';
import { CategoryTree } from './components/CategoryTree';
import { SettingRow } from './components/SettingRow';
import { AnsiSwatchGrid } from './components/AnsiSwatchGrid';
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
      <div className="relative w-full max-w-5xl h-[85vh] bg-base-0 border border-border-strong rounded-sm shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* Header bar: Title, Search, Actions */}
        <header className="h-13 bg-base-1 border-b border-border/80 px-5 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <h2 className="text-sm font-bold text-text-primary tracking-wide">
              Settings
            </h2>
            <span className="text-text-muted/40 text-xs">•</span>
            <span className="text-[11.5px] text-text-muted">
              Preferences &amp; Configuration
            </span>
          </div>

          {/* Search bar */}
          <SettingsSearchBar matchCount={searchResults ? searchResults.length : undefined} />

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Reset all button */}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset all custom settings and CSS tokens back to defaults?')) {
                  resetAllSettings();
                }
              }}
              className="p-1.5 text-text-muted hover:text-commito-coral hover:bg-base-2 rounded-xs border border-transparent hover:border-border transition cursor-pointer"
              title="Reset all settings to default values"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-border/60" />

            {/* Close button */}
            <button
              type="button"
              onClick={closeSettings}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-xs border border-transparent hover:border-border transition cursor-pointer"
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
                <div className="border-b border-border/70 pb-3 flex items-center justify-between">
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
                    No settings found matching &quot;{searchQuery}&quot;. Try searching for &quot;font&quot;, &quot;accent&quot;, &quot;gemini&quot;, or &quot;diff&quot;.
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
                <div className="border-b border-border/70 pb-3">
                  <h3 className="text-sm font-bold text-text-primary">
                    {currentCategoryMeta?.label || selectedCategory}
                  </h3>
                  <p className="text-[11.5px] text-text-muted mt-0.5 leading-relaxed">
                    {selectedCategory === 'commonly_used'
                      ? 'Quickly customize the most impactful appearance and behavior settings.'
                      : `Configure ${currentCategoryMeta?.label} preferences and options.`}
                  </p>
                </div>

                {/* If AI category, render dedicated AiSettingsTab with multi-key pool */}
                {selectedCategory === 'ai' && <AiSettingsTab />}

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
                    <section key={subcategory} className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[10.5px] font-bold text-text-muted/80 uppercase tracking-wider">
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
