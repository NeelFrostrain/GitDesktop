import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useGitStore } from '../../../store/useGitStore';
import { useLogStore } from '../../../store/useLogStore';
import { useSettingsStore } from '../../../features/settings/store/useSettingsStore';
import { GitService } from '../../../services/git/gitService';
import { toAppError } from '../../../shared/utils/errorUtils';

interface AiGenerateButtonProps {
  onAiGenerated: (titleOptions: string[], report: string, model: string) => void;
  onRequireApiKey: () => void;
}

export const AiGenerateButton: React.FC<AiGenerateButtonProps> = ({
  onAiGenerated,
  onRequireApiKey,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { activeRepoPath, stagedFiles } = useGitStore();
  const { getEffectiveValue } = useSettingsStore();

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

  const handleButtonClick = async () => {
    if (!activeRepoPath) return;

    const availableKey = getAnyAvailableKey();
    if (!availableKey) {
      onRequireApiKey();
      return;
    }

    setIsGenerating(true);
    useLogStore.getState().addLog('info', 'Git', '[Commit-AI] Analyzing code changes with AI...');

    try {
      const model = getEffectiveValue('ai.model') || undefined;

      const res = await GitService.generateAiCommitMessage(
        activeRepoPath,
        stagedFiles.length > 0,
        availableKey,
        model
      );

      const options =
        res.title_options && res.title_options.length > 0
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

      if (
        msg.toLowerCase().includes('groq_api_key') ||
        msg.toLowerCase().includes('api key') ||
        msg.toLowerCase().includes('all configured groq api keys')
      ) {
        onRequireApiKey();
        useLogStore
          .getState()
          .addLog('info', 'Git', '[Commit-AI] Please enter a valid Groq API Key to proceed.');
      } else {
        useLogStore
          .getState()
          .addLog('error', 'Git', `[Commit-AI] Failed to generate message: ${msg}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
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
  );
};
