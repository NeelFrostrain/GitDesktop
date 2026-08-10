import React from 'react';
import { useCommitForm } from '../../../hooks/useCommitForm';
import { CommitMessageForm } from './CommitMessageForm';
import { CommitOptions } from './CommitOptions';
import { CommitActions } from './CommitActions';
import { CommitButton } from './CommitButton';

export const CommitPanel: React.FC = () => {
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

  return (
    <div className="p-3 border-t border-border bg-base-1 space-y-2 flex-shrink-0">
      <CommitMessageForm
        summary={commitSummary}
        onSummaryChange={setCommitSummary}
        description={commitDescription}
        onDescriptionChange={setCommitDescription}
      >
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
      </CommitMessageForm>

      <CommitButton
        canCommit={canCommit}
        isCommitting={isCommitting}
        onCommit={handleCommit}
        hasActiveOptions={hasActiveOptions}
      />
    </div>
  );
};
