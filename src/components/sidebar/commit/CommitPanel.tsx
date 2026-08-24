import React, { useState, useRef, useEffect } from 'react';
import { GitCommit, ChevronUp, X } from 'lucide-react';
import { useCommitForm } from '../../../hooks/useCommitForm';
import { useGitStore } from '../../../store/useGitStore';
import { UserAvatar } from '../../common/UserAvatar';
import { CommitOptions } from './CommitOptions';
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
    commitOptions,
    setCommitOptions,
    isCommitting,
    isOptionsMenuOpen,
    setIsOptionsMenuOpen,
    optionsMenuRef,
    hasActiveOptions,
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

  const hasDraft = Boolean(commitSummary.trim() || commitDescription.trim());

  return (
    <div className="relative p-2.5 border-t border-border bg-base-1 flex-shrink-0">
      {/* Dropdown Menu (Floats upwards above the button) */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-2 right-2 mb-2 bg-base-1 border border-border-strong rounded-sm shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2.5"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-border/80 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-text-primary">
              <GitCommit className="w-3.5 h-3.5 text-commito-coral" />
              <span>Initialize Commit</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-base-2 border border-border rounded-sm text-text-muted">
                {count} {count === 1 ? 'file' : 'files'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Form: Avatar + Summary */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUserConfigModalOpen(true)}
              title="Configure Git User Identity & Avatar"
              className="rounded-full hover:ring-2 hover:ring-commito-coral/50 transition cursor-pointer flex-shrink-0"
            >
              <UserAvatar
                url={user?.avatar_url}
                name={user?.name || user?.username}
                provider={user?.provider}
                className="w-7 h-7"
                iconClassName="w-3.5 h-3.5"
              />
            </button>
            <input
              type="text"
              autoFocus
              placeholder="Summary (required)"
              value={commitSummary}
              onChange={(e) => setCommitSummary(e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-base-0 border border-border rounded-sm text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral/50 font-sans"
            />
          </div>

          {/* Description Textarea + Tools Toolbar */}
          <div className="bg-base-0 border border-border rounded-sm focus-within:border-commito-coral/50 transition flex flex-col overflow-hidden">
            <textarea
              placeholder="Description (optional)"
              rows={3}
              value={commitDescription}
              onChange={(e) => setCommitDescription(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-transparent text-xs text-text-primary placeholder-text-muted focus:outline-none resize-none font-sans"
            />
            <div className="px-2 py-1 bg-base-0/80 border-t border-border/40 flex items-center justify-start gap-1.5">
              <AiGenerateButton onGenerate={handleAiGenerate} />
              <CoAuthorButton onAddCoAuthor={handleAddCoAuthor} />
              <CommitActions
                isVisible={Boolean(commitSummary || commitDescription)}
                onClear={clearForm}
              />
              <CommitOptions
                options={commitOptions}
                onOptionsChange={setCommitOptions}
                isOpen={isOptionsMenuOpen}
                onToggle={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
                optionsRef={optionsMenuRef}
                hasActiveOptions={hasActiveOptions}
              />
            </div>
          </div>

          {/* Primary Commit Action Button */}
          <button
            onClick={onExecuteCommit}
            disabled={!canCommit || isCommitting}
            className={`w-full py-2 rounded-sm text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm ${
              canCommit
                ? 'bg-commito-coral hover:bg-commito-coralHover text-white cursor-pointer'
                : 'bg-base-2 text-text-muted cursor-not-allowed border border-border'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>
              {isCommitting
                ? 'Committing...'
                : `Commit ${count > 0 ? `${count} file${count > 1 ? 's' : ''}` : ''} to ${currentBranch}`}
            </span>
            {hasActiveOptions && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"
                title="Custom commit options active"
              />
            )}
          </button>
        </div>
      )}

      {/* Main Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full py-2 px-3 rounded-sm text-xs font-semibold flex items-center justify-between transition cursor-pointer border ${
          isOpen
            ? 'bg-commito-coral text-white border-commito-coral shadow-sm'
            : hasDraft
            ? 'bg-base-2 hover:bg-base-3 text-text-primary border-commito-coral/50'
            : 'bg-base-2 hover:bg-base-3 text-text-primary border-border hover:border-border-strong'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GitCommit className={`w-3.5 h-3.5 flex-shrink-0 ${isOpen ? 'text-white' : 'text-commito-coral'}`} />
          <span className="truncate">Initialize commit</span>
          {count > 0 && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-sm border ${
                isOpen
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
          className={`w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-white' : 'text-text-muted'
          }`}
        />
      </button>
    </div>
  );
};
