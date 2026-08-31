import React from 'react';
import { ChevronRight } from 'lucide-react';
import { CATEGORY_METADATA, SettingCategory, SETTINGS_SCHEMA } from '../lib/settingsSchema';
import { useSettingsStore } from '../store/useSettingsStore';

export interface CategoryTreeProps {
  className?: string;
  style?: React.CSSProperties;
}

export const CategoryTree: React.FC<CategoryTreeProps> = ({ className = '', style }) => {
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
    <nav
      style={style}
      className={`bg-base-1/40 p-2.5 space-y-1 select-none overflow-y-auto scrollbar-thin shrink-0 border-r border-border ${className}`}
    >
      <div className="px-2 py-1 text-[10px] font-mono font-semibold text-text-muted uppercase tracking-wider">
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
              className={`w-full px-2.5 py-1.5 rounded-sm text-left flex items-center justify-between text-xs transition cursor-pointer group ${
                isSelected
                  ? 'bg-base-2 border border-border text-text-primary font-semibold shadow-2xs'
                  : 'text-text-secondary hover:bg-base-2/60 hover:text-text-primary border border-transparent'
              }`}
            >
              <span className="truncate">{meta.label}</span>

              {count > 0 && (
                <span className="px-1.5 py-0.2 bg-commito-coral/15 border border-commito-coral/30 text-commito-coral text-[9.5px] font-mono font-bold rounded-xs">
                  {count}
                </span>
              )}
            </button>

            {/* Subcategories hierarchy for active selected category */}
            {isSelected && meta.subcategories.length > 1 && (
              <div className="ml-3 pl-2 border-l border-border/80 space-y-0.5 py-1 my-0.5">
                {meta.subcategories.map((subcat) => {
                  const isSubSelected = selectedSubcategory === subcat;
                  return (
                    <button
                      key={subcat}
                      type="button"
                      onClick={() => setSelectedSubcategory(isSubSelected ? null : subcat)}
                      className={`w-full px-2 py-1 rounded-xs text-left text-[11px] transition-colors cursor-pointer flex items-center justify-between truncate ${
                        isSubSelected
                          ? 'text-commito-coral font-medium bg-commito-coral/10'
                          : 'text-text-muted hover:text-text-primary hover:bg-base-2/50'
                      }`}
                    >
                      <span className="truncate">{subcat}</span>
                      {isSubSelected && (
                        <ChevronRight className="w-2.5 h-2.5 text-commito-coral shrink-0 ml-1" />
                      )}
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
