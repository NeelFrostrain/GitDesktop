import React from 'react';
import {
  Star,
  Palette,
  Paintbrush,
  Terminal,
  GitBranch,
  Shield,
  Bell,
  Sliders,
} from 'lucide-react';
import {
  CATEGORY_METADATA,
  SettingCategory,
  SETTINGS_SCHEMA,
} from '../lib/settingsSchema';
import { useSettingsStore } from '../store/useSettingsStore';

const getCategoryIcon = (cat: SettingCategory) => {
  switch (cat) {
    case 'commonly_used':
      return <Star className="w-4 h-4 text-amber-400" />;
    case 'appearance':
      return <Palette className="w-4 h-4 text-commito-coral" />;
    case 'colors':
      return <Paintbrush className="w-4 h-4 text-purple-400" />;
    case 'terminal':
      return <Terminal className="w-4 h-4 text-gitlab-teal" />;
    case 'git':
      return <GitBranch className="w-4 h-4 text-commito-coral" />;
    case 'accounts':
      return <Shield className="w-4 h-4 text-blue-400" />;
    case 'notifications':
      return <Bell className="w-4 h-4 text-amber-400" />;
    case 'advanced':
    default:
      return <Sliders className="w-4 h-4 text-text-muted" />;
  }
};

export const CategoryTree: React.FC = () => {
  const {
    selectedCategory,
    selectedSubcategory,
    setSelectedCategory,
    setSelectedSubcategory,
    isModified,
  } = useSettingsStore();

  const categories = Object.keys(CATEGORY_METADATA) as SettingCategory[];

  // Compute modified count per category
  const modifiedCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    SETTINGS_SCHEMA.forEach((s) => {
      if (isModified(s.id)) {
        counts[s.category] = (counts[s.category] || 0) + 1;
      }
    });
    return counts;
  }, [isModified]);

  return (
    <nav className="w-60 bg-base-1/50 border-r border-border p-2 space-y-1 select-none overflow-y-auto scrollbar-thin scrollbar-thumb-base-3 flex-shrink-0">
      <div className="px-2 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">
        Categories
      </div>

      {categories.map((cat) => {
        const meta = CATEGORY_METADATA[cat];
        const isSelected = selectedCategory === cat;
        const count = modifiedCounts[cat] || 0;

        return (
          <div key={cat} className="space-y-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`w-full px-2.5 py-1.5 rounded-sm text-left flex items-center justify-between text-xs transition cursor-pointer ${isSelected
                  ? 'bg-commito-coral/15 text-text-primary font-semibold border-l-2 border-commito-coral'
                  : 'text-text-secondary hover:bg-base-2 hover:text-text-primary border-l-2 border-transparent'
                }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {getCategoryIcon(cat)}
                <span className="truncate">{meta.label}</span>
              </div>

              {count > 0 && (
                <span className="px-1.5 py-0.2 bg-commito-coral/20 text-commito-coral text-[10px] font-semibold rounded-full">
                  {count}
                </span>
              )}
            </button>

            {/* Subcategories (only rendered for active selected category) */}
            {isSelected && meta.subcategories.length > 1 && (
              <div className="ml-5 pl-2 border-l border-border/60 space-y-0.5 py-0.5">
                {meta.subcategories.map((subcat) => {
                  const isSubSelected = selectedSubcategory === subcat;
                  return (
                    <button
                      key={subcat}
                      type="button"
                      onClick={() => setSelectedSubcategory(isSubSelected ? null : subcat)}
                      className={`w-full px-2 py-1 rounded text-left text-[11px] transition cursor-pointer truncate ${isSubSelected
                          ? 'text-commito-coral font-medium bg-commito-coral/10'
                          : 'text-text-muted hover:text-text-primary hover:bg-base-2'
                        }`}
                    >
                      {subcat}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
};
