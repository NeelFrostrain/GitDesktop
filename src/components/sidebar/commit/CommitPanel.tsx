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
} from 'lucide-react';
import { useCommitForm } from '../../../hooks/useCommitForm';
import { useGitStore } from '../../../store/useGitStore';
import { UserAvatar } from '../../common/UserAvatar';
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
  const [aiTitleOptions, setAiTitleOptions] = useState<string[]>([]);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0);
  const [fullAiReport, setFullAiReport] = useState('');
  const [descriptionMode, setDescriptionMode] = useState<DescriptionMode>('report');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  const { status, stagedFiles, user, setIsUserConfigModalOpen } = useGitStore();
  const currentBranch = status?.current_branch || 'main';
  const count = stagedFiles.length;

  const conciseBullets = useMemo(() => {
    return extractConciseBullets(fullAiReport);
  }, [fullAiReport]);

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
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSelectingAi) {
          setIsSelectingAi(false);
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
  }, [isOpen, isSelectingAi]);

  const handleAiGenerated = (titleOptions: string[], report: string) => {
    setAiTitleOptions(titleOptions);
    setFullAiReport(report);
    setSelectedTitleIndex(0);
    setDescriptionMode('report');
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
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canCommit && !isCommitting) {
      e.preventDefault();
      onExecuteCommit();
    }
  };

  return (
    <div className="relative p-2.5 border-t border-border bg-base-1 flex-shrink-0 select-none">
      {/* Dropdown Menu (Floats upwards above the button) */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-2 right-2 mb-2 bg-base-1 border border-border-strong rounded-sm shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2.5"
        >
          {/* Unified Dialog Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-border/60 text-xs select-none">
            <div className="flex items-center gap-1.5 font-semibold text-text-primary">
              {isSelectingAi ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
                  <span>Choose commit title</span>
                  <span className="inline-flex items-center justify-center h-4 px-1.5 bg-base-2 border border-border rounded-sm text-[10px] font-mono font-medium leading-none text-text-muted">
                    {aiTitleOptions.length} suggestions
                  </span>
                </>
              ) : (
                <>
                  <GitCommit className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
                  <span>Commit Changes</span>
                  <span className="inline-flex items-center justify-center h-4 px-1.5 bg-base-2 border border-border rounded-sm text-[10px] font-mono font-medium leading-none text-text-muted">
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
              }}
              className="p-1 rounded-sm text-text-faint hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ========================================================================= */}
          {/* AI SELECTION VIEW (Titles + Description mode + Apply button) */}
          {/* ========================================================================= */}
          {isSelectingAi ? (
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
                <div className="text-[10px] font-semibold text-text-muted flex items-center gap-1">
                  <span>Description Format</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 select-none">
                  <button
                    type="button"
                    onClick={() => setDescriptionMode('report')}
                    className={`px-2 py-1.5 rounded-sm border text-[11px] font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      descriptionMode === 'report'
                        ? 'bg-commito-coral/15 border-commito-coral text-commito-coral font-semibold'
                        : 'bg-base-0 border-border hover:border-border-strong text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    <span>Full Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDescriptionMode('bullets')}
                    className={`px-2 py-1.5 rounded-sm border text-[11px] font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      descriptionMode === 'bullets'
                        ? 'bg-commito-coral/15 border-commito-coral text-commito-coral font-semibold'
                        : 'bg-base-0 border-border hover:border-border-strong text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <ListFilter className="w-3 h-3" />
                    <span>Bullets</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDescriptionMode('none')}
                    className={`px-2 py-1.5 rounded-sm border text-[11px] font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      descriptionMode === 'none'
                        ? 'bg-commito-coral/15 border-commito-coral text-commito-coral font-semibold'
                        : 'bg-base-0 border-border hover:border-border-strong text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Ban className="w-3 h-3" />
                    <span>None</span>
                  </button>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
                <button
                  type="button"
                  onClick={() => setIsSelectingAi(false)}
                  className="px-2 py-1 text-text-muted hover:text-text-primary hover:bg-base-2 rounded-sm flex items-center gap-1 cursor-pointer transition text-[11px]"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Cancel</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyAiSelection()}
                  className="px-3.5 py-1.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply to Commit</span>
                </button>
              </div>
            </div>
          ) : (
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
                <input
                  type="text"
                  autoFocus
                  placeholder="Summary (required)"
                  value={commitSummary}
                  onChange={(e) => setCommitSummary(e.target.value)}
                  onKeyDown={handleFormKeyDown}
                  className="flex-1 px-2.5 py-1.5 bg-base-0 border border-border focus:border-border-strong rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none font-sans font-medium transition"
                />
              </div>

              {/* Row 2: Description Textarea */}
              <textarea
                placeholder="Description (optional)"
                rows={4}
                value={commitDescription}
                onChange={(e) => setCommitDescription(e.target.value)}
                onKeyDown={handleFormKeyDown}
                className="w-full px-2.5 py-1.5 bg-base-0 border border-border focus:border-border-strong rounded-sm text-xs text-text-primary placeholder:text-text-faint focus:outline-none resize-none font-sans leading-relaxed min-h-[60px] transition"
              />

              {/* Row 3: Action Tools Toolbar */}
              <div className="flex items-center justify-between px-0.5 select-none -mt-1">
                <div className="flex items-center gap-1">
                  <AiGenerateButton onAiGenerated={handleAiGenerated} />
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
          <button
            onClick={onExecuteCommit}
            disabled={!canCommit || isCommitting || isSelectingAi}
            className={`w-full py-2 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs ${
              canCommit && !isSelectingAi
                ? 'bg-commito-coral hover:bg-commito-coralLight text-white cursor-pointer active:scale-[0.99]'
                : 'bg-base-2 text-text-faint border border-border cursor-not-allowed'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {isCommitting
                ? 'Committing...'
                : count > 0
                  ? `Commit ${count} file${count > 1 ? 's' : ''} to ${currentBranch}`
                  : `Commit to ${currentBranch}`}
            </span>
          </button>
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
