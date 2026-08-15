import { SETTINGS_SCHEMA, SettingDefinition, CATEGORY_METADATA } from './settingsSchema';

export interface SearchResultItem {
  setting: SettingDefinition;
  breadcrumbs: string[];
  score: number;
}

export function searchSettings(query: string, scopeFilter?: 'app' | 'repo'): SearchResultItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }

  const queryTerms = trimmed.split(/\s+/).filter(Boolean);
  const results: SearchResultItem[] = [];

  for (const setting of SETTINGS_SCHEMA) {
    if (scopeFilter && setting.scope !== scopeFilter) {
      continue;
    }

    const catMeta = CATEGORY_METADATA[setting.category];
    const categoryLabel = catMeta?.label || setting.category;
    const subcatLabel = setting.subcategory || '';

    const searchableText = [
      setting.label,
      setting.description,
      setting.id,
      setting.cssVar || '',
      categoryLabel,
      subcatLabel,
    ]
      .join(' ')
      .toLowerCase();

    let matchesAll = true;
    let score = 0;

    for (const term of queryTerms) {
      if (!searchableText.includes(term)) {
        matchesAll = false;
        break;
      }

      // Exact match in label gets highest weight
      if (setting.label.toLowerCase().includes(term)) {
        score += 10;
      }
      if (setting.id.toLowerCase().includes(term)) {
        score += 8;
      }
      if (setting.cssVar?.toLowerCase().includes(term)) {
        score += 8;
      }
      if (subcatLabel.toLowerCase().includes(term)) {
        score += 5;
      }
      if (setting.description.toLowerCase().includes(term)) {
        score += 2;
      }
    }

    if (matchesAll) {
      const breadcrumbs = [categoryLabel, subcatLabel].filter(Boolean);
      results.push({
        setting,
        breadcrumbs,
        score,
      });
    }
  }

  // Sort by relevance score descending
  return results.sort((a, b) => b.score - a.score);
}
