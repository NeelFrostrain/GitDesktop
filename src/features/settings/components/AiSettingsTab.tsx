import React, { useState } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Check,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Copy,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useToastStore } from '../../../store/useToastStore';
import { openUrl } from '@tauri-apps/plugin-opener';

const MODEL_OPTIONS = [
  {
    id: 'openai/gpt-oss-120b',
    name: 'OpenAI GPT-OSS 120B (Recommended)',
    badge: 'Recommended',
    desc: 'Deep semantic understanding, perfect commit messages & technical reports.',
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    badge: 'Fast',
    desc: 'High quality reasoning with high rate-limit tolerance.',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    badge: 'Ultra Fast',
    desc: 'Lightning fast execution, ideal for high throughput and tight rate limits.',
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B MoE',
    badge: 'MoE',
    desc: '32k context window with mixture of experts architecture.',
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
  const rawKeys = getEffectiveValue('ai.groq_api_keys');
  const activeKey = String(getEffectiveValue('ai.active_api_key') || '');
  const selectedModel = String(getEffectiveValue('ai.model') || 'openai/gpt-oss-120b');

  const keysList: string[] = React.useMemo(() => {
    let list: string[] = [];
    if (Array.isArray(rawKeys)) {
      list = rawKeys.map(String).map((s) => s.trim()).filter(Boolean);
    } else if (typeof rawKeys === 'string' && rawKeys.trim()) {
      try {
        const parsed = JSON.parse(rawKeys);
        if (Array.isArray(parsed)) {
          list = parsed.map(String).map((s) => s.trim()).filter(Boolean);
        } else {
          list = [rawKeys.trim()];
        }
      } catch {
        list = [rawKeys.trim()];
      }
    }

    if (activeKey.trim() && !list.includes(activeKey.trim())) {
      list.unshift(activeKey.trim());
    }

    return Array.from(new Set(list));
  }, [rawKeys, activeKey]);

  const handleAddKey = async () => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) {
      setNewKeyError('Please enter an API key');
      return;
    }

    if (!trimmed.startsWith('gsk_')) {
      setNewKeyError('Groq API keys start with "gsk_". Please verify your key.');
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
      message: `Key ...${key.slice(-4)} is now the primary key.`,
    });
  };

  const handleCopyKey = (key: string, index: number) => {
    navigator.clipboard.writeText(key);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const toggleKeyVisibility = (index: number) => {
    setVisibleKeyIndices((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const maskKey = (key: string, isVisible: boolean) => {
    if (isVisible) return key;
    if (key.length <= 10) return '••••••••••';
    return `${key.slice(0, 7)}••••••••••••${key.slice(-4)}`;
  };

  const handleModelChange = async (modelId: string) => {
    await setSettingValue('ai.model', modelId);
    showToast({
      type: 'success',
      title: 'Model Selected',
      message: `Commit-AI will use ${modelId} as the primary model.`,
    });
  };

  return (
    <div className="space-y-6 font-sans select-none text-text-primary">
      {/* 1. Header Banner & Explainer */}
      <div className="p-4 rounded-sm bg-gradient-to-r from-base-1 to-base-2 border border-border space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-sm bg-commito-coral/15 border border-commito-coral/30 text-commito-coral">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary tracking-wide">
                Commit-AI Multi-Key Rotation &amp; Models
              </h3>
              <p className="text-xs text-text-muted">
                Generate high quality conventional commits, changelogs, and technical summaries using Groq Cloud.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openUrl('https://console.groq.com/keys')}
            className="px-3 py-1.5 rounded-sm bg-base-3 hover:bg-base-2 border border-border text-xs text-commito-coral hover:text-commito-coralLight font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <span>Get Free Groq Key</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Feature Notice */}
        <div className="p-2.5 rounded-sm bg-base-0/80 border border-border/70 flex items-start gap-2 text-xs text-text-secondary">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-text-primary">Automatic Fallback &amp; Zero-Downtime:</strong> If a key hits rate limits (429) or temporary quota exhaustion, Commit-AI automatically falls back to your next available backup key in milliseconds without interruption.
          </div>
        </div>
      </div>

      {/* 2. Groq API Keys Manager */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-commito-coral" />
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Groq API Keys Pool ({keysList.length})
            </h4>
          </div>
          <span className="text-[11px] text-text-muted">
            Add multiple keys to distribute API quotas
          </span>
        </div>

        {/* Add New Key Input */}
        <div className="p-3 bg-base-1 rounded-sm border border-border space-y-2">
          <label className="text-xs font-semibold text-text-primary flex items-center justify-between">
            <span>Add Groq API Key</span>
            <span className="text-[10.5px] text-text-faint font-normal">Starts with gsk_</span>
          </label>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Paste Groq API Key (gsk_...)"
                value={newKeyInput}
                onChange={(e) => {
                  setNewKeyInput(e.target.value);
                  setNewKeyError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddKey();
                  }
                }}
                className="w-full px-3 py-1.5 bg-base-0 border border-border focus:border-commito-coral rounded-sm text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none transition"
              />
            </div>

            <button
              type="button"
              onClick={handleAddKey}
              className="px-3.5 py-1.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Pool</span>
            </button>
          </div>

          {newKeyError && (
            <p className="text-[11px] text-git-removed flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{newKeyError}</span>
            </p>
          )}
        </div>

        {/* List of Configured Keys */}
        <div className="space-y-1.5">
          {keysList.length === 0 ? (
            <div className="p-6 bg-base-1/50 rounded-sm border border-dashed border-border text-center text-text-muted text-xs space-y-1">
              <Key className="w-6 h-6 mx-auto text-text-faint opacity-40 mb-1" />
              <p className="font-semibold text-text-primary">No Groq API Keys Configured</p>
              <p className="text-[11px]">
                Add at least one free API key above from{' '}
                <button
                  type="button"
                  onClick={() => openUrl('https://console.groq.com/keys')}
                  className="text-commito-coral underline cursor-pointer"
                >
                  console.groq.com
                </button>{' '}
                to enable Commit-AI.
              </p>
            </div>
          ) : (
            keysList.map((key, index) => {
              const isPrimary = index === 0;
              const isVisible = Boolean(visibleKeyIndices[index]);
              const isCopied = copiedIndex === index;

              return (
                <div
                  key={key}
                  className={`p-2.5 rounded-sm border flex items-center justify-between gap-3 transition-colors ${
                    isPrimary
                      ? 'bg-base-1 border-commito-coral/40 shadow-xs'
                      : 'bg-base-1/60 border-border hover:bg-base-1'
                  }`}
                >
                  {/* Left: Tag + Masked Key */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className={`text-[9.5px] font-mono font-bold uppercase px-2 py-0.5 rounded-xs flex-shrink-0 ${
                        isPrimary
                          ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/30'
                          : 'bg-base-2 text-text-muted border border-border'
                      }`}
                    >
                      {isPrimary ? 'Primary' : `Backup #${index}`}
                    </span>

                    <code className="text-xs font-mono text-text-primary truncate select-all">
                      {maskKey(key, isVisible)}
                    </code>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleKeyVisibility(index)}
                      className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
                      title={isVisible ? 'Hide key' : 'Show full key'}
                    >
                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyKey(key, index)}
                      className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
                      title="Copy key to clipboard"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-git-added" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(key)}
                        className="px-2 py-0.5 rounded-xs text-[10px] font-semibold text-text-muted hover:text-commito-coral hover:bg-base-2 border border-border transition cursor-pointer"
                        title="Set as first priority key"
                      >
                        Set Primary
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveKey(index)}
                      className="p-1 rounded-sm text-text-muted hover:text-git-removed hover:bg-git-removed-bg transition cursor-pointer"
                      title="Remove key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Model Configuration */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              AI Model Selection
            </h4>
          </div>
          <span className="text-[11px] text-text-muted">
            Choose LLM engine for diff analysis
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {MODEL_OPTIONS.map((model) => {
            const isSelected = selectedModel === model.id;

            return (
              <div
                key={model.id}
                role="button"
                tabIndex={0}
                onClick={() => handleModelChange(model.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleModelChange(model.id);
                  }
                }}
                className={`p-3 rounded-sm border cursor-pointer transition-all flex flex-col justify-between gap-2 text-left ${
                  isSelected
                    ? 'bg-base-1 border-commito-coral shadow-xs ring-1 ring-commito-coral/30'
                    : 'bg-base-1/50 border-border hover:bg-base-1 hover:border-border-strong'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-text-primary leading-tight">
                      {model.name}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs ${
                        isSelected
                          ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/30'
                          : 'bg-base-2 text-text-muted border border-border'
                      }`}
                    >
                      {model.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                    {model.desc}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px] font-mono text-text-muted">
                  <span className="truncate">{model.id}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-commito-coral stroke-[2.5]" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
