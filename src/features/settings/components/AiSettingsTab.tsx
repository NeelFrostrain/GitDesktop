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
} from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useToastStore } from '../../../store/useToastStore';
import { openUrl } from '@tauri-apps/plugin-opener';

const MODEL_OPTIONS = [
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant (Ultra Fast • Highest Rate Limits)',
    badge: 'Ultra Fast',
    desc: 'Lightning fast execution, sub-second responses with massive 500k token/day quota.',
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile (Flagship)',
    badge: '70B Versatile',
    desc: 'Deep semantic understanding and reasoning across large multi-file diffs.',
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT OSS 120B (OpenAI / Open-Source Flagship)',
    badge: 'Flagship 120B',
    desc: 'Exceptional commit precision and deep architectural scoping (200k TPD).',
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT OSS 20B (OpenAI / Open-Source Fast)',
    badge: 'Fast 20B',
    desc: 'High-speed diff analysis with crisp conventional commit formatting.',
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
  const rawGroqKeys = getEffectiveValue('ai.groq_api_keys');
  const activeKey = String(getEffectiveValue('ai.active_api_key') || '');
  const selectedModel = String(getEffectiveValue('ai.model') || 'llama-3.1-8b-instant');

  const keysList: string[] = React.useMemo(() => {
    let list: string[] = [];
    if (Array.isArray(rawGroqKeys)) {
      list = rawGroqKeys.map(String).map((s) => s.trim()).filter(Boolean);
    } else if (typeof rawGroqKeys === 'string' && rawGroqKeys.trim()) {
      try {
        const parsed = JSON.parse(rawGroqKeys);
        if (Array.isArray(parsed)) {
          list = parsed.map(String).map((s) => s.trim()).filter(Boolean);
        } else {
          list = [rawGroqKeys.trim()];
        }
      } catch {
        list = [rawGroqKeys.trim()];
      }
    }

    if (activeKey.trim() && !list.includes(activeKey.trim())) {
      list.unshift(activeKey.trim());
    }

    return Array.from(new Set(list));
  }, [rawGroqKeys, activeKey]);

  const handleAddKey = async () => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) {
      setNewKeyError('Please enter an API key');
      return;
    }

    if (!trimmed.startsWith('gsk_')) {
      setNewKeyError('Groq API keys start with "gsk_". Please copy your key from console.groq.com/keys.');
      return;
    }

    if (keysList.includes(trimmed)) {
      setNewKeyError('This key is already added to your pool.');
      return;
    }

    const updatedList = [...keysList, trimmed];
    await setSettingValue('ai.groq_api_keys', updatedList);
    if (!activeKey || !keysList.includes(activeKey)) {
      await setSettingValue('ai.active_api_key', trimmed);
    }

    setNewKeyInput('');
    setNewKeyError(null);
    showToast({
      type: 'success',
      title: 'Groq API Key Added',
      message: `Added key (ends in ...${trimmed.slice(-4)}) to rotation pool.`,
    });
  };

  const handleClearAllKeys = async () => {
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
    await setSettingValue('ai.groq_api_keys', updatedList);

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
    await setSettingValue('ai.groq_api_keys', updatedList);
    await setSettingValue('ai.active_api_key', key);

    showToast({
      type: 'success',
      title: 'Primary Key Updated',
      message: `Key (...${key.slice(-4)}) is now the primary active key.`,
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
    <div className="p-6 max-w-4xl mx-auto space-y-6 select-none font-sans text-xs text-text-primary">
      {/* Header Banner */}
      <div className="p-4 rounded-sm border border-border bg-base-1 flex items-start justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">Groq Cloud Commit-AI Engine</h2>
            <p className="text-xs text-text-muted mt-0.5 leading-relaxed max-w-xl">
              Generate intelligent conventional commit titles, scope tags, and deep technical summaries
              powered by Groq LPUs with sub-second generation times and free tier quotas.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openUrl('https://console.groq.com/keys')}
          className="h-7.5 px-3 rounded-sm bg-commito-coral hover:bg-commito-coralLight text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
        >
          <span>Get Free Groq Key</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </button>
      </div>

      {/* 1. Groq API Keys Manager */}
      <div className="p-4 rounded-sm border border-border bg-base-1 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-commito-coral" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-text-muted">
              Groq API Keys Pool ({keysList.length})
            </h3>
          </div>
          {keysList.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllKeys}
              className="text-[10.5px] text-text-faint hover:text-git-removed transition cursor-pointer"
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
              placeholder="Paste Groq API Key (gsk_...)"
              className="flex-1 h-8 px-3 rounded-sm bg-base-0 border border-border hover:border-border-strong focus:border-commito-coral font-mono text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-commito-coral/30 transition shadow-inner"
            />
            <button
              type="button"
              onClick={handleAddKey}
              className="h-8 px-3.5 rounded-sm bg-base-2 hover:bg-base-3 border border-border text-text-primary font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Key</span>
            </button>
          </div>
          {newKeyError && <span className="text-[11px] text-git-removed font-medium">{newKeyError}</span>}
        </div>

        {/* Keys List */}
        <div className="space-y-1.5 pt-1">
          {keysList.length > 0 ? (
            keysList.map((key, index) => {
              const isPrimary = activeKey === key || (index === 0 && !activeKey);
              const isVisible = visibleKeyIndices[index];

              return (
                <div
                  key={key}
                  className={`p-2.5 rounded-sm border flex items-center justify-between gap-3 transition ${
                    isPrimary
                      ? 'bg-base-0 border-commito-coral/40 shadow-xs'
                      : 'bg-base-0/60 border-border hover:border-border-strong'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {isPrimary ? (
                      <span className="px-1.5 py-0.2 rounded-xs bg-commito-coral/15 border border-commito-coral/30 text-[9.5px] font-mono font-bold uppercase text-commito-coral shrink-0">
                        PRIMARY
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(key)}
                        className="px-1.5 py-0.2 rounded-xs bg-base-2 hover:bg-base-3 border border-border text-[9.5px] font-mono text-text-muted hover:text-text-primary transition cursor-pointer shrink-0"
                        title="Set as primary key"
                      >
                        SET PRIMARY
                      </button>
                    )}
                    <span className="font-mono text-xs text-text-primary truncate">
                      {isVisible ? key : maskKey(key)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleKeyVisibility(index)}
                      className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
                      title={isVisible ? 'Hide Key' : 'Reveal Key'}
                    >
                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(key, index)}
                      className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
                      title="Copy Key"
                    >
                      {copiedIndex === index ? (
                        <Check className="w-3.5 h-3.5 text-git-added" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveKey(index)}
                      className="p-1 rounded-sm text-text-muted hover:text-git-removed hover:bg-git-removed-bg transition cursor-pointer"
                      title="Remove Key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-4 rounded-sm border border-dashed border-border bg-base-0/40 text-center space-y-1">
              <p className="font-semibold text-text-primary">No Groq API Keys Configured</p>
              <p className="text-[11px] text-text-muted">
                Add a free API key from{' '}
                <button
                  type="button"
                  onClick={() => openUrl('https://console.groq.com/keys')}
                  className="text-commito-coral hover:underline font-mono cursor-pointer"
                >
                  console.groq.com/keys
                </button>{' '}
                to enable Commit-AI.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 2. Model Selection */}
      <div className="p-4 rounded-sm border border-border bg-base-1 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-commito-coral" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-text-muted">
              AI Model Selection
            </h3>
          </div>
          <span className="text-[11px] text-text-faint font-mono">
            Choose Groq model for diff analysis
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {MODEL_OPTIONS.map((m) => {
            const isSelected = selectedModel === m.id;
            return (
              <div
                key={m.id}
                onClick={() => handleSelectModel(m.id)}
                className={`p-3 rounded-sm border cursor-pointer transition-all select-none flex flex-col justify-between gap-2 shadow-2xs ${
                  isSelected
                    ? 'bg-base-0 border-commito-coral shadow-xs ring-1 ring-commito-coral/20'
                    : 'bg-base-0 border-border hover:border-border-strong hover:bg-base-0/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-bold text-xs text-text-primary leading-tight">
                      {m.name}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs shrink-0 ${
                        isSelected
                          ? 'bg-commito-coral/15 border border-commito-coral/30 text-commito-coral'
                          : 'bg-base-2 border border-border text-text-muted'
                      }`}
                    >
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1 leading-relaxed">{m.desc}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/70 text-[10.5px] font-mono text-text-faint">
                  <span>{m.id}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-commito-coral font-bold" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
