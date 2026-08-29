import React, { useState } from 'react';
import {
  Sparkles,
  Key,
  Cpu,
  Plus,
  Trash2,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useToastStore } from '../../../store/useToastStore';
import { openUrl } from '@tauri-apps/plugin-opener';

const MODEL_OPTIONS = [
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    subtitle: 'Recommended • Ultra Fast',
    badge: 'Ultra Fast',
    desc: 'Sub-second commit generation with optimized token usage and generous free quotas on Google AI Studio.',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    subtitle: 'Experimental Next-Gen',
    badge: 'Next-Gen',
    desc: 'High-capability next-generation lightweight model for intricate code and multi-module diffs.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    subtitle: 'High-Speed Reasoning',
    badge: 'High-Speed',
    desc: 'Balanced reasoning speed and contextual accuracy for complex conventional commit formatting.',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    subtitle: 'Ultra Low Latency',
    badge: 'Low Latency',
    desc: 'Instant commit title suggestions with concise, conventional commit message outputs.',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    subtitle: 'Flagship Multimodal',
    badge: 'Flagship',
    desc: 'Deep semantic understanding across large codebases, large PRs, and complex diff graphs.',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    subtitle: 'Standard Flash',
    badge: 'Standard',
    desc: 'Reliable fast reasoning with massive context window for extensive multi-file changes.',
  },
];

export const AiSettingsTab: React.FC = () => {
  const { getEffectiveValue, setSettingValue } = useSettingsStore();
  const { showToast } = useToastStore();

  const [newKeyInput, setNewKeyInput] = useState('');
  const [newKeyError, setNewKeyError] = useState<string | null>(null);
  const [visibleKeyIndices, setVisibleKeyIndices] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Retrieve keys list from settings
  const rawGeminiKeys =
    getEffectiveValue('ai.gemini_api_keys') ||
    getEffectiveValue('ai.google_api_keys') ||
    getEffectiveValue('ai.groq_api_keys');
  const activeKey = String(
    getEffectiveValue('ai.active_api_key') || getEffectiveValue('ai.gemini_api_key') || '',
  );
  const selectedModel = String(getEffectiveValue('ai.model') || 'gemini-2.5-flash-lite');

  const keysList: string[] = React.useMemo(() => {
    let list: string[] = [];
    if (Array.isArray(rawGeminiKeys)) {
      list = rawGeminiKeys.map(String).map((s) => s.trim()).filter(Boolean);
    } else if (typeof rawGeminiKeys === 'string' && rawGeminiKeys.trim()) {
      try {
        const parsed = JSON.parse(rawGeminiKeys);
        if (Array.isArray(parsed)) {
          list = parsed.map(String).map((s) => s.trim()).filter(Boolean);
        } else {
          list = [rawGeminiKeys.trim()];
        }
      } catch {
        list = [rawGeminiKeys.trim()];
      }
    }

    if (activeKey.trim() && !list.includes(activeKey.trim())) {
      list.unshift(activeKey.trim());
    }

    return Array.from(new Set(list));
  }, [rawGeminiKeys, activeKey]);

  const handleAddKey = async () => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) {
      setNewKeyError('Please enter a Google Gemini API key');
      return;
    }

    if (keysList.includes(trimmed)) {
      setNewKeyError('This key is already added to your pool.');
      return;
    }

    const updatedList = [...keysList, trimmed];
    await setSettingValue('ai.gemini_api_keys', updatedList);
    await setSettingValue('ai.active_api_key', trimmed);

    setNewKeyInput('');
    setNewKeyError(null);
    showToast({
      type: 'success',
      title: 'Google Gemini Key Added',
      message: `Added key (...${trimmed.slice(-4)}) to rotation pool.`,
    });
  };

  const handleClearAllKeys = async () => {
    if (!window.confirm('Remove all API keys from your local pool?')) return;

    await setSettingValue('ai.gemini_api_keys', []);
    await setSettingValue('ai.google_api_keys', []);
    await setSettingValue('ai.groq_api_keys', []);
    await setSettingValue('ai.active_api_key', '');

    showToast({
      type: 'info',
      title: 'Keys Cleared',
      message: 'All API keys have been removed.',
    });
  };

  const handleRemoveKey = async (index: number) => {
    const targetKey = keysList[index];
    const updatedList = keysList.filter((_, i) => i !== index);
    await setSettingValue('ai.gemini_api_keys', updatedList);

    if (activeKey === targetKey) {
      const nextActive = updatedList[0] || '';
      await setSettingValue('ai.active_api_key', nextActive);
    }

    showToast({
      type: 'info',
      title: 'API Key Removed',
      message: 'Key was removed from rotation pool.',
    });
  };

  const handleSetPrimary = async (key: string) => {
    const without = keysList.filter((k) => k !== key);
    const updatedList = [key, ...without];
    await setSettingValue('ai.gemini_api_keys', updatedList);
    await setSettingValue('ai.active_api_key', key);

    showToast({
      type: 'success',
      title: 'Primary Key Updated',
      message: `Key (...${key.slice(-4)}) is now active.`,
    });
  };

  const handleSelectModel = async (modelId: string) => {
    await setSettingValue('ai.model', modelId);
    showToast({
      type: 'info',
      title: 'Model Selected',
      message: `Switched commit AI engine to ${modelId}.`,
    });
  };

  const toggleKeyVisibility = (index: number) => {
    setVisibleKeyIndices((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleCopyKey = (key: string, index: number) => {
    navigator.clipboard.writeText(key);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 6)}••••••••••••${key.slice(-4)}`;
  };

  return (
    <div className="space-y-4 select-none font-sans text-xs text-text-primary">
      {/* ── 1. Hero Engine Banner ── */}
      <div className="p-4 rounded-sm border border-border bg-base-1/50 flex items-start justify-between gap-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-sm bg-commito-coral/10 border border-commito-coral/25 flex items-center justify-center text-commito-coral shrink-0 mt-0.5 shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs font-bold text-text-primary tracking-tight">
                Google Gemini Commit-AI Engine
              </h2>
              <span className="inline-flex items-center gap-1 text-[9.5px] font-mono px-1.5 py-0.2 rounded-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                <ShieldCheck className="w-2.5 h-2.5" />
                <span>Zero Data Retention</span>
              </span>
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-relaxed max-w-xl">
              Generates intelligent conventional commit titles, scope tags, and deep technical summaries
              powered by Google Gemini Flash Lite models with high speed and free quotas.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openUrl('https://aistudio.google.com/app/apikey')}
          className="h-7.5 px-3 rounded-sm bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs active:scale-[0.98]"
        >
          <span>Get Free Google API Key</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </button>
      </div>

      {/* ── 2. Google Gemini API Keys Pool ── */}
      <div className="p-4 rounded-sm border border-border bg-base-1/50 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
          <div className="flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-commito-coral" />
            <h3 className="font-semibold text-xs text-text-primary">
              Google Gemini API Keys Pool
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-xs bg-base-0 border border-border text-text-muted">
              {keysList.length}
            </span>
          </div>

          {keysList.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllKeys}
              className="text-[10.5px] font-mono text-text-muted hover:text-git-removed transition cursor-pointer"
            >
              Clear All Keys
            </button>
          )}
        </div>

        {/* Add Key Input */}
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyInput}
              onChange={(e) => {
                setNewKeyInput(e.target.value);
                if (newKeyError) setNewKeyError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
              placeholder="Paste Google Gemini API Key (AIza...)"
              className="flex-1 h-8 px-3 rounded-sm bg-base-0 border border-border hover:border-border-strong focus:border-commito-coral font-mono text-xs text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-inner"
            />
            <button
              type="button"
              onClick={handleAddKey}
              className="h-8 px-3.5 rounded-sm bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong text-text-primary font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5 text-commito-coral" />
              <span>Add Key</span>
            </button>
          </div>
          {newKeyError && (
            <span className="text-[11px] text-git-removed font-medium pl-0.5">{newKeyError}</span>
          )}
        </div>

        {/* Keys List */}
        <div className="space-y-1.5 pt-0.5">
          {keysList.length > 0 ? (
            keysList.map((key, index) => {
              const isPrimary = activeKey === key || (index === 0 && !activeKey);
              const isVisible = visibleKeyIndices[index];

              return (
                <div
                  key={key}
                  className={`px-3 py-2 rounded-sm border flex items-center justify-between gap-3 transition ${
                    isPrimary
                      ? 'bg-base-0 border-commito-coral/40 shadow-xs'
                      : 'bg-base-0/60 border-border hover:border-border-strong'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {isPrimary ? (
                      <span className="px-1.5 py-0.2 rounded-xs bg-commito-coral/15 border border-commito-coral/30 text-[9px] font-mono font-bold uppercase text-commito-coral shrink-0">
                        PRIMARY
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(key)}
                        className="px-1.5 py-0.2 rounded-xs bg-base-1 hover:bg-base-2 border border-border text-[9px] font-mono text-text-muted hover:text-text-primary transition cursor-pointer shrink-0"
                        title="Set as primary key"
                      >
                        SET PRIMARY
                      </button>
                    )}
                    <span className="font-mono text-xs text-text-primary truncate select-all">
                      {isVisible ? key : maskKey(key)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleKeyVisibility(index)}
                      className="p-1 rounded-xs text-text-muted hover:text-text-primary hover:bg-base-1 transition cursor-pointer"
                      title={isVisible ? 'Hide Key' : 'Reveal Key'}
                    >
                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-text-muted" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(key, index)}
                      className="p-1 rounded-xs text-text-muted hover:text-text-primary hover:bg-base-1 transition cursor-pointer"
                      title="Copy Key"
                    >
                      {copiedIndex === index ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveKey(index)}
                      className="p-1 rounded-xs text-text-muted hover:text-git-removed hover:bg-git-removed-bg transition cursor-pointer"
                      title="Remove Key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 rounded-sm border border-dashed border-border bg-base-0/30 text-center space-y-1">
              <p className="font-semibold text-xs text-text-primary">No Google Gemini API Keys Configured</p>
              <p className="text-[11px] text-text-muted">
                Add a free API key from{' '}
                <button
                  type="button"
                  onClick={() => openUrl('https://aistudio.google.com/app/apikey')}
                  className="text-commito-coral hover:underline font-mono cursor-pointer"
                >
                  aistudio.google.com/app/apikey
                </button>{' '}
                to enable AI-powered commit messages.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Model Selection ── */}
      <div className="p-4 rounded-sm border border-border bg-base-1/50 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-commito-coral" />
            <h3 className="font-semibold text-xs text-text-primary">
              Google Gemini Model Selection
            </h3>
          </div>
          <span className="text-[10.5px] text-text-muted font-mono">
            Diff analysis engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {MODEL_OPTIONS.map((m) => {
            const isSelected = selectedModel === m.id;
            return (
              <div
                key={m.id}
                onClick={() => handleSelectModel(m.id)}
                className={`p-3 rounded-sm border cursor-pointer transition-all select-none flex flex-col justify-between gap-2 shadow-2xs ${
                  isSelected
                    ? 'bg-base-0 border-commito-coral/50 ring-1 ring-commito-coral/25 shadow-xs'
                    : 'bg-base-0/60 border-border hover:border-border-strong hover:bg-base-0'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-semibold text-xs text-text-primary leading-tight">
                      {m.name}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs shrink-0 ${
                        isSelected
                          ? 'bg-commito-coral/15 border border-commito-coral/30 text-commito-coral'
                          : 'bg-base-1 border border-border text-text-muted'
                      }`}
                    >
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-text-muted mt-1 leading-relaxed">{m.desc}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[10px] font-mono text-text-muted">
                  <span className="truncate">{m.id}</span>
                  {isSelected ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-commito-coral shrink-0" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-border/80" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
