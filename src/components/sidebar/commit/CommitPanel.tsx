import React, { useState, useRef, useEffect } from 'react';
import { GitCommit, ChevronUp, X } from 'lucide-react';
import { useCommitForm } from '../../../hooks/useCommitForm';
import { useGitStore } from '../../../store/useGitStore';
import { UserAvatar } from '../../common/UserAvatar';
import { AiGenerateButton } from './AiGenerateButton';
import { CoAuthorButton } from './CoAuthorButton';
import { CommitActions } from './CommitActions';

export const CommitPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
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
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleAiGenerate = (summary: string, description: string) => {
    setCommitSummary(summary);
    setCommitDescription(description);
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
  };

  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canCommit && !isCommitting) {
      e.preventDefault();
      onExecuteCommit();
    }
  };

  const hasDraft = Boolean(commitSummary.trim() || commitDescription.trim());

  return (
    <div className="relative p-2.5 border-t border-border bg-base-1 flex-shrink-0 select-none">
      {/* Dropdown Menu (Floats upwards above the button) */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-2 right-2 mb-2 bg-base-1 border border-border-strong rounded-sm shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2.5"
        >
          {/* Dialog Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-border/60 text-xs select-none">
            <div className="flex items-center gap-1.5 font-semibold text-text-primary">
              <GitCommit className="w-3.5 h-3.5 text-commito-coral flex-shrink-0" />
              <span>Commit Changes</span>
              <span className="inline-flex items-center justify-center h-4 px-1.5 bg-base-2 border border-border rounded-sm text-[10px] font-mono font-medium leading-none text-text-muted">
                {count} {count === 1 ? 'file' : 'files'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-sm text-text-faint hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

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
              <AiGenerateButton onGenerate={handleAiGenerate} />
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

          {/* Primary Commit Action Button */}
          <button
            onClick={onExecuteCommit}
            disabled={!canCommit || isCommitting}
            className={`w-full py-2 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs ${canCommit
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

      {/* Main Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full py-2 px-3 rounded-sm text-xs font-semibold flex items-center justify-between transition cursor-pointer border shadow-xs ${isOpen
          ? 'bg-base-2 text-text-primary border-border-strong'
          : 'bg-base-1 hover:bg-base-2 text-text-primary border-border hover:border-border-strong'
          }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GitCommit className="w-3.5 h-3.5 flex-shrink-0 text-commito-coral" />
          <span className="truncate">Initialize commit</span>
          {count > 0 && (
            <span
              className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-sm text-[10px] font-mono font-bold leading-none border ${isOpen
                ? 'bg-white/20 border-white/30 text-white'
                : 'bg-base-0 border-border text-text-muted'
                }`}
            >
              {count}
            </span>
          )}
          {hasDraft && !isOpen && (
            <span className="w-1.5 h-1.5 rounded-full bg-commito-coral" title="Draft in progress" />
          )}
        </div>

        <ChevronUp
          className={`w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180 text-white' : 'text-text-muted'
            }`}
        />
      </button>
    </div>
  );
};
