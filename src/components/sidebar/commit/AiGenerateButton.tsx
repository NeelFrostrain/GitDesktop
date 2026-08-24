import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, Key, X, ExternalLink } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { useLogStore } from '../../../store/useLogStore';
import { useSettingsStore } from '../../../features/settings/store/useSettingsStore';
import { GitService } from '../../../services/git/gitService';
import { toAppError } from '../../../shared/utils/errorUtils';

interface AiGenerateButtonProps {
  onAiGenerated: (titleOptions: string[], report: string, model: string) => void;
}

export const AiGenerateButton: React.FC<AiGenerateButtonProps> = ({ onAiGenerated }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApiKeyPromptOpen, setIsApiKeyPromptOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { activeRepoPath, stagedFiles } = useGitStore();
  const { getEffectiveValue, setSettingValue, openSettings } = useSettingsStore();

  useEffect(() => {
    if (!isApiKeyPromptOpen) return;

    setTimeout(() => inputRef.current?.focus(), 50);

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsApiKeyPromptOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isApiKeyPromptOpen]);

  const getAnyAvailableKey = (): string | undefined => {
    const activeKey = getEffectiveValue('ai.active_api_key');
    if (activeKey && String(activeKey).trim()) {
      return String(activeKey).trim();
    }

    const rawKeys = getEffectiveValue('ai.groq_api_keys');
    if (Array.isArray(rawKeys) && rawKeys.length > 0) {
      const first = String(rawKeys[0]).trim();
      if (first) return first;
    } else if (typeof rawKeys === 'string' && rawKeys.trim()) {
      try {
        const parsed = JSON.parse(rawKeys);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = String(parsed[0]).trim();
          if (first) return first;
        }
      } catch {
        return rawKeys.trim();
      }
    }

    return undefined;
  };

  const executeGeneration = async (apiKey?: string) => {
    if (!activeRepoPath) return;

    setIsGenerating(true);
    setIsApiKeyPromptOpen(false);
    useLogStore.getState().addLog('info', 'Git', '[Commit-AI] Analyzing code changes with AI...');

    try {
      const activeKey = apiKey || getAnyAvailableKey();
      const model = getEffectiveValue('ai.model') || undefined;

      const res = await GitService.generateAiCommitMessage(
        activeRepoPath,
        stagedFiles.length > 0,
        activeKey,
        model
      );

      const options = res.title_options && res.title_options.length > 0
        ? res.title_options
        : [res.summary];

      onAiGenerated(options, res.report, res.model_used);

      useLogStore
        .getState()
        .addLog(
          'success',
          'Git',
          `[Commit-AI] Generated ${options.length} commit message options with ${res.model_used}`
        );
    } catch (err) {
      const appErr = toAppError(err);
      const msg = appErr.message || '';

      if (msg.toLowerCase().includes('groq_api_key') || msg.toLowerCase().includes('api key')) {
        setIsApiKeyPromptOpen(true);
        useLogStore.getState().addLog('info', 'Git', '[Commit-AI] Please enter your Groq API Key to proceed.');
      } else {
        useLogStore
          .getState()
          .addLog('error', 'Git', `[Commit-AI] Failed to generate message: ${msg}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleButtonClick = () => {
    const availableKey = getAnyAvailableKey();
    executeGeneration(availableKey);
  };

  const handleSaveKeyAndGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = newApiKey.trim();
    if (!key) return;

    await setSettingValue('ai.active_api_key', key);
    const existing = getEffectiveValue('ai.groq_api_keys');
    let list: string[] = [];
    if (Array.isArray(existing)) {
      list = [...existing];
    } else if (typeof existing === 'string' && existing.trim()) {
      try {
        const p = JSON.parse(existing);
        if (Array.isArray(p)) list = p;
      } catch {
        list = [existing.trim()];
      }
    }
    if (!list.includes(key)) {
      list.push(key);
      await setSettingValue('ai.groq_api_keys', list);
    }

    setNewApiKey('');
    setIsApiKeyPromptOpen(false);
    executeGeneration(key);
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={isGenerating}
        title="Analyze changes with Commit-AI"
        className="p-1 rounded-sm text-text-muted hover:text-commito-coral hover:bg-base-2 transition cursor-pointer text-xs flex items-center justify-center active:scale-95 disabled:opacity-50"
      >
        {isGenerating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-commito-coral" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Groq API Key Setup Popover */}
      {isApiKeyPromptOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full left-0 mb-2 w-80 bg-base-1 border border-border-strong rounded-sm shadow-2xl p-3 text-xs select-none animate-in fade-in zoom-in-95 duration-100 font-sans space-y-2.5 z-50"
        >
          <div className="flex items-center justify-between text-text-muted pb-1.5 border-b border-border/60">
            <div className="flex items-center gap-1.5 font-semibold text-text-primary text-[11px]">
              <Key className="w-3.5 h-3.5 text-commito-coral" />
              <span>Groq API Key Required</span>
            </div>
            <button
              type="button"
              onClick={() => setIsApiKeyPromptOpen(false)}
              className="p-0.5 rounded text-text-faint hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <p className="text-[11px] text-text-muted leading-relaxed">
            Enter your Groq API key to generate commit titles and technical reports with Commit-AI.
          </p>

          <form onSubmit={handleSaveKeyAndGenerate} className="space-y-2">
            <input
              ref={inputRef}
              type="password"
              placeholder="gsk_..."
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-base-0 border border-border focus:border-border-strong rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none font-mono"
            />

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setIsApiKeyPromptOpen(false);
                  openSettings('ai', 'API Keys & Providers');
                }}
                className="text-[11px] text-text-muted hover:text-commito-coral flex items-center gap-1 cursor-pointer"
              >
                <span>Settings</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>

              <button
                type="submit"
                disabled={!newApiKey.trim()}
                className="px-3 py-1 bg-commito-coral hover:bg-commito-coralLight disabled:opacity-50 text-white rounded-sm text-xs font-semibold shadow-xs cursor-pointer active:scale-95 transition"
              >
                Save &amp; Generate
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
