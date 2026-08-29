import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  GitCommit,
  ChevronUp,
  X,
  Sparkles,
  Check,
  ArrowLeft,
  FileText,
  ListFilter,
  Ban,
  Key,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useCommitForm } from '../../../hooks/useCommitForm';
import { useGitStore } from '../../../store/useGitStore';
import { useLogStore } from '../../../store/useLogStore';
import { useSettingsStore } from '../../../features/settings/store/useSettingsStore';
import { GitService } from '../../../services/git/gitService';
import { UserAvatar } from '../../common/UserAvatar';
import { Button } from '../../common/Button';
import { AiGenerateButton } from './AiGenerateButton';
import { CoAuthorButton } from './CoAuthorButton';
import { CommitActions } from './CommitActions';

type DescriptionMode = 'report' | 'bullets' | 'none';

function extractConciseBullets(report: string): string {
  if (!report || !report.trim()) return '';
  const lines = report.split('\n');
  const bullets: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('- ') ||
      trimmed.startsWith('* ') ||
      trimmed.startsWith('• ') ||
      trimmed.startsWith('+ ')
    ) {
      bullets.push(trimmed);
      if (bullets.length >= 6) break;
    }
  }

  if (bullets.length > 0) {
    return bullets.join('\n');
  }

  // Fallback: take first few non-empty lines
  return lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.endsWith(':'))
    .slice(0, 4)
    .map((l) => `- ${l}`)
    .join('\n');
}

export const CommitPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSelectingAi, setIsSelectingAi] = useState(false);
  const [isApiKeyPrompt, setIsApiKeyPrompt] = useState(false);
  const [newApiKeyInput, setNewApiKeyInput] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [isInlineGenerating, setIsInlineGenerating] = useState(false);

  const [aiTitleOptions, setAiTitleOptions] = useState<string[]>([]);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0);
  const [fullAiReport, setFullAiReport] = useState('');
  const [descriptionMode, setDescriptionMode] = useState<DescriptionMode>('report');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  const {
    commitSummary,
    setCommitSummary,
    commitDescription,
    setCommitDescription,
    isCommitting,
    canCommit,
    handleCommit,
    clearForm,
  } = useCommitForm();

  const { status, stagedFiles, user, activeRepoPath, setIsUserConfigModalOpen } = useGitStore();
  const { getEffectiveValue, setSettingValue, openSettings } = useSettingsStore();

  const currentBranch = status?.current_branch || 'main';
  const count = stagedFiles.length;

  const conciseBullets = useMemo(() => {
    return extractConciseBullets(fullAiReport);
  }, [fullAiReport]);

  useEffect(() => {
    if (isApiKeyPrompt) {
      const existing = String(getEffectiveValue('ai.active_api_key') || '').trim();
      if (existing && !newApiKeyInput) {
        setNewApiKeyInput(existing);
      }
      setInlineError(null);
      setTimeout(() => keyInputRef.current?.focus(), 50);
    }
  }, [isApiKeyPrompt]);

  // Close dropdown on click outside or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setIsSelectingAi(false);
        setIsApiKeyPrompt(false);
        setInlineError(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSelectingAi || isApiKeyPrompt) {
          setIsSelectingAi(false);
          setIsApiKeyPrompt(false);
          setInlineError(null);
        } else {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSelectingAi, isApiKeyPrompt]);

  const handleAiGenerated = (titleOptions: string[], report: string) => {
    setAiTitleOptions(titleOptions);
    setFullAiReport(report);
    setSelectedTitleIndex(0);
    setDescriptionMode('report');
    setIsApiKeyPrompt(false);
    setInlineError(null);
    setIsSelectingAi(true);
  };

  const handleApplyAiSelection = (titleOverride?: string) => {
    const chosenTitle =
      titleOverride || aiTitleOptions[selectedTitleIndex] || aiTitleOptions[0] || '';

    if (chosenTitle) {
      setCommitSummary(chosenTitle);
    }

    if (descriptionMode === 'report') {
      setCommitDescription(fullAiReport);
    } else if (descriptionMode === 'bullets') {
      setCommitDescription(conciseBullets);
    } else if (descriptionMode === 'none') {
      setCommitDescription('');
    }

    setIsSelectingAi(false);
  };

  const handleSaveKeyAndGenerateInline = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = newApiKeyInput.trim();
    if (!key || !activeRepoPath) return;

    setIsInlineGenerating(true);
    setInlineError(null);
    try {
      await setSettingValue('ai.active_api_key', key);
      const existing =
        getEffectiveValue('ai.gemini_api_keys') || getEffectiveValue('ai.google_api_keys');
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
        await setSettingValue('ai.gemini_api_keys', list);
      }

      if (stagedFiles.length > 0) {
        await GitService.stageFiles(activeRepoPath, stagedFiles);
      }

      const model = getEffectiveValue('ai.model') || undefined;
      const res = await GitService.generateAiCommitMessage(
        activeRepoPath,
        true, // Strictly analyze staged files
        key,
        model
      );

      const options =
        res.title_options && res.title_options.length > 0 ? res.title_options : [res.summary];

      setNewApiKeyInput('');
      setIsApiKeyPrompt(false);
      setInlineError(null);
      handleAiGenerated(options, res.report);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      setInlineError(errMsg);
      useLogStore
        .getState()
        .addLog('error', 'Git', `[Commit-AI] Key verification failed: ${errMsg}`);
    } finally {
      setIsInlineGenerating(false);
    }
  };

  const handleAddCoAuthor = (trailer: string) => {
    if (commitDescription.trim()) {
      setCommitDescription(`${commitDescription.trim()}\n\n${trailer}`);
    } else {
      setCommitDescription(trailer);
    }
  };

  const onExecuteCommit = async () => {
    await handleCommit();
    setIsOpen(false);
    setIsSelectingAi(false);
    setIsApiKeyPrompt(false);
    setInlineError(null);
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canCommit && !isCommitting) {
      e.preventDefault();
      onExecuteCommit();
    }
  };

  return (
    <div className="relative p-2 border-t border-border bg-base-1 flex-shrink-0 select-none">
      {/* Dropdown Menu (Floats upwards above the button, precisely fits sidebar width) */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-2 right-2 mb-2 bg-base-1 border border-border-strong rounded-sm shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2.5 max-w-full"
        >
          {/* Unified Dialog Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-border/60 text-xs select-none">
            <div className="flex items-center gap-1.5 font-semibold text-text-primary min-w-0">
              {isApiKeyPrompt ? (
                <>
                  <Key className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
                  <span className="truncate">Google Gemini API Key Required</span>
                </>
              ) : isSelectingAi ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
                  <span className="truncate">Choose commit title</span>
                  <span className="inline-flex items-center justify-center h-4 px-1.5 bg-base-2 border border-border rounded-sm text-[10px] font-mono font-medium leading-none text-text-muted flex-shrink-0">
                    {aiTitleOptions.length}
                  </span>
                </>
              ) : (
                <>
                  <GitCommit className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
                  <span className="truncate">Commit Changes</span>
                  <span className="inline-flex items-center justify-center h-4 px-1.5 bg-base-2 border border-border rounded-sm text-[10px] font-mono font-medium leading-none text-text-muted flex-shrink-0">
                    {count} {count === 1 ? 'file' : 'files'}
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsSelectingAi(false);
                setIsApiKeyPrompt(false);
                setInlineError(null);
              }}
              className="p-1 rounded-sm text-text-faint hover:text-text-primary hover:bg-base-2 transition cursor-pointer flex-shrink-0"
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ========================================================================= */}
          {/* INLINE API KEY SETUP (Fits sidebar 100%) */}
          {/* ========================================================================= */}
          {isApiKeyPrompt ? (
            <div className="flex flex-col gap-2.5 animate-in fade-in duration-100 font-sans text-xs">
              <p className="text-[11px] text-text-muted leading-relaxed">
                Enter your free Google Gemini API key to generate commit titles and technical
                reports with Commit-AI.
              </p>

              {/* Guide Box */}
              <div className="p-2.5 bg-base-0 border border-border rounded-sm space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between gap-1 flex-wrap font-semibold text-text-primary">
                  <span className="flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
                    <span>How to get a key:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => openUrl('https://aistudio.google.com/app/apikey')}
                    className="text-commito-coral hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <span>aistudio.google.com/app/apikey</span>
                    <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                  </button>
                </div>
                <ol className="list-decimal list-inside text-text-muted text-[10.5px] space-y-0.5 pl-0.5">
                  <li>Sign in to Google AI Studio (free &amp; instant)</li>
                  <li>
                    Click &quot;Create API Key&quot; &amp; copy your{' '}
                    <code className="font-mono text-commito-coral">AIza...</code>
                  </li>
                  <li>Paste below and click Save &amp; Generate</li>
                </ol>
              </div>

              {/* Inline Error Banner */}
              {inlineError && (
                <div className="p-2 bg-git-deleted/15 border border-git-deleted/30 rounded text-[11px] text-git-deleted break-words leading-relaxed">
                  {inlineError}
                </div>
              )}

              {/* Key Input Form */}
              <form onSubmit={handleSaveKeyAndGenerateInline} className="space-y-2">
                <input
                  ref={keyInputRef}
                  type="text"
                  placeholder="AIza..."
                  value={newApiKeyInput}
                  onChange={(e) => {
                    setNewApiKeyInput(e.target.value);
                    if (inlineError) setInlineError(null);
                  }}
                  className="w-full px-2.5 py-1.5 bg-base-0 border border-border focus:border-border-strong rounded-sm text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none"
                />

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsApiKeyPrompt(false);
                        setInlineError(null);
                      }}
                      className="px-2 py-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-sm cursor-pointer transition text-[11px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsApiKeyPrompt(false);
                        setInlineError(null);
                        openSettings('ai', 'API Keys & Providers');
                      }}
                      className="text-[11px] text-text-muted hover:text-commito-coral flex items-center gap-1 cursor-pointer"
                    >
                      <span>Settings</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <Button
                    type="submit"
                    variant="coral"
                    size="sm"
                    disabled={!newApiKeyInput.trim() || isInlineGenerating}
                    isLoading={isInlineGenerating}
                    leftIcon={!isInlineGenerating ? <Check className="w-3.5 h-3.5" /> : undefined}
                  >
                    Save &amp; Generate
                  </Button>
                </div>
              </form>
            </div>
          ) : isSelectingAi ? (
            /* ========================================================================= */
            /* AI SELECTION VIEW (Titles + Description mode + Apply button) */
            /* ========================================================================= */
            <div className="flex flex-col gap-2.5 animate-in fade-in duration-100 font-sans">
              {/* Title Options List */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {aiTitleOptions.map((opt, idx) => {
                  const isSelected = idx === selectedTitleIndex;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedTitleIndex(idx)}
                      onDoubleClick={() => handleApplyAiSelection(opt)}
                      className={`p-2.5 rounded-sm cursor-pointer flex items-start gap-2 transition text-xs select-none bg-base-0 border ${
                        isSelected
                          ? 'border-commito-coral ring-1 ring-commito-coral/50 text-text-primary font-medium shadow-xs'
                          : 'border-border hover:border-border-strong text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <span className="text-[10px] font-mono font-bold text-commito-coral mt-0.5 flex-shrink-0">
                        {idx + 1}.
                      </span>
                      <span className="flex-1 font-mono text-[11px] leading-snug break-words">
                        {opt}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-git-added flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Description Mode Selector Row */}
              <div className="pt-0.5 space-y-1">
                <div className="text-[10px] font-semibold text-text-muted flex items-center justify-between">
                  <span>Description Format</span>
                  <span className="text-[9.5px] font-mono text-text-faint">
                    {descriptionMode === 'report'
                      ? 'Full Report'
                      : descriptionMode === 'bullets'
                        ? 'Key Bullets'
                        : 'Summary Only'}
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-base-0 p-0.5 rounded border border-border">
                  <button
                    type="button"
                    onClick={() => setDescriptionMode('report')}
                    className={`flex-1 py-1 px-1 rounded-xs text-[10.5px] font-medium flex items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap ${
                      descriptionMode === 'report'
                        ? 'bg-commito-coral/20 text-commito-coral font-semibold shadow-2xs border border-commito-coral/40'
                        : 'text-text-muted hover:text-text-primary hover:bg-base-2 border border-transparent'
                    }`}
                    title="Include rich technical report in commit description"
                  >
                    <FileText className="w-3 h-3 flex-shrink-0" />
                    <span>Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDescriptionMode('bullets')}
                    className={`flex-1 py-1 px-1 rounded-xs text-[10.5px] font-medium flex items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap ${
                      descriptionMode === 'bullets'
                        ? 'bg-commito-coral/20 text-commito-coral font-semibold shadow-2xs border border-commito-coral/40'
                        : 'text-text-muted hover:text-text-primary hover:bg-base-2 border border-transparent'
                    }`}
                    title="Include concise bullet points in commit description"
                  >
                    <ListFilter className="w-3 h-3 flex-shrink-0" />
                    <span>Bullets</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDescriptionMode('none')}
                    className={`flex-1 py-1 px-1 rounded-xs text-[10.5px] font-medium flex items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap ${
                      descriptionMode === 'none'
                        ? 'bg-commito-coral/20 text-commito-coral font-semibold shadow-2xs border border-commito-coral/40'
                        : 'text-text-muted hover:text-text-primary hover:bg-base-2 border border-transparent'
                    }`}
                    title="No commit description (summary only)"
                  >
                    <Ban className="w-3 h-3 flex-shrink-0" />
                    <span>None</span>
                  </button>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsSelectingAi(false)}
                  leftIcon={<ArrowLeft className="w-3 h-3" />}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  variant="coral"
                  size="sm"
                  onClick={() => handleApplyAiSelection()}
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                >
                  Apply to Commit
                </Button>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* STANDARD COMMIT FORM */
            /* ========================================================================= */
            <>
              {/* Row 1: Author Avatar + Summary Input */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsUserConfigModalOpen(true)}
                  title={`Git author: ${user?.name || user?.username || 'Click to configure author'}`}
                  className="rounded-full hover:ring-2 hover:ring-commito-coral/50 transition cursor-pointer flex-shrink-0"
                >
                  <UserAvatar
                    url={user?.avatar_url}
                    name={user?.name || user?.username}
                    provider={user?.provider}
                    className="w-6 h-6"
                    iconClassName="w-3 h-3"
                  />
                </button>

                <div className="flex-1 min-w-0 relative">
                  <input
                    type="text"
                    placeholder="Commit summary (e.g. feat: add payment flow)"
                    value={commitSummary}
                    onChange={(e) => setCommitSummary(e.target.value)}
                    onKeyDown={handleFormKeyDown}
                    className="w-full px-2.5 py-1.5 bg-base-0 border border-border focus:border-border-strong rounded-sm text-xs font-medium text-text-primary placeholder:text-text-faint focus:outline-none transition shadow-2xs font-sans"
                    autoFocus
                  />
                </div>
              </div>

              {/* Row 2: Commit Description (Optional) */}
              <textarea
                rows={4}
                placeholder="Add an optional extended description / technical report..."
                value={commitDescription}
                onChange={(e) => setCommitDescription(e.target.value)}
                onKeyDown={handleFormKeyDown}
                className="w-full px-2.5 py-1.5 bg-base-0 border border-border focus:border-border-strong rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none resize-none font-sans leading-relaxed min-h-[60px] transition"
              />

              {/* Row 3: Action Tools Toolbar */}
              <div className="flex items-center justify-between px-0.5 select-none -mt-1">
                <div className="flex items-center gap-1">
                  <AiGenerateButton
                    onAiGenerated={handleAiGenerated}
                    onRequireApiKey={() => setIsApiKeyPrompt(true)}
                  />
                  <CoAuthorButton onAddCoAuthor={handleAddCoAuthor} />
                  <CommitActions
                    isVisible={Boolean(commitSummary.trim() || commitDescription.trim())}
                    onClear={clearForm}
                  />
                </div>

                <span className="text-[10px] font-mono text-text-faint select-none">
                  Ctrl+Enter
                </span>
              </div>
            </>
          )}

          {/* Primary Commit Action Button */}
          <Button
            type="button"
            variant={
              canCommit && !isSelectingAi && !isApiKeyPrompt && count > 0 ? 'coral' : 'secondary'
            }
            size="md"
            onClick={onExecuteCommit}
            disabled={!canCommit || isCommitting || isSelectingAi || isApiKeyPrompt || count === 0}
            isLoading={isCommitting}
            leftIcon={
              !isCommitting ? <GitCommit className="w-3.5 h-3.5 flex-shrink-0" /> : undefined
            }
            className="w-full justify-center"
          >
            <span>
              {isCommitting
                ? 'Committing...'
                : count > 0
                  ? `Commit ${count} file${count > 1 ? 's' : ''} to ${currentBranch}`
                  : 'No staged files to commit'}
            </span>
          </Button>
        </div>
      )}

      {/* Main Commit Trigger Button in Sidebar Footer */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full py-2 px-3 rounded-sm text-xs font-semibold flex items-center justify-between transition cursor-pointer border shadow-xs ${
          isOpen
            ? 'bg-base-2 text-text-primary border-border-strong'
            : 'bg-base-1 hover:bg-base-2 text-text-primary border-border hover:border-border-strong'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GitCommit className="w-3.5 h-3.5 flex-shrink-0 text-commito-coral" />
          <span className="truncate">Initialize commit</span>
          {count > 0 && (
            <span
              className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-sm text-[10px] font-mono font-bold leading-none border ${
                isOpen
                  ? 'bg-white/20 border-white/30 text-white'
                  : 'bg-base-0 border-border text-text-muted'
              }`}
            >
              {count}
            </span>
          )}
        </div>

        <ChevronUp
          className={`w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-white' : 'text-text-muted'
          }`}
        />
      </button>
    </div>
  );
};
