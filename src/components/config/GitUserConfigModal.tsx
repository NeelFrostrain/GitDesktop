import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Link as LinkIcon, GitCommit } from 'lucide-react';
import { useGitUserConfig } from '../../hooks/useGitUserConfig';
import { ConfigHeader } from './ConfigHeader';
import { RemoteIdentitySection } from './RemoteIdentitySection';
import { ProfileAvatarSection } from './ProfileAvatarSection';
import { GitIdentityForm } from './GitIdentityForm';
import { ConfigFooter } from './ConfigFooter';

export const GitUserConfigModal: React.FC = () => {
  const {
    isUserConfigModalOpen,
    activeRepoName,
    selectedProvider,
    name,
    setName,
    email,
    setEmail,
    avatarUrl,
    selectedSyncAccount,
    allAvailableAccounts,
    isDropdownOpen,
    setIsDropdownOpen,
    isSubmitting,
    modalError,
    fileInputRef,
    dropdownRef,
    isValidEmail,
    isFormValid,
    handleSyncAccountChange,
    handleImageUpload,
    handleRemoveAvatar,
    handleSave,
    handleClose,
  } = useGitUserConfig();

  if (!isUserConfigModalOpen) return null;

  const isManualMode = selectedSyncAccount === 'custom';

  const selectedItem =
    allAvailableAccounts.find(
      (a) =>
        a.id === selectedSyncAccount ||
        a.id === selectedSyncAccount?.replace(/^active:/, '') ||
        `active:${a.id}` === selectedSyncAccount
    ) || (selectedSyncAccount !== 'custom' ? allAvailableAccounts[0] : undefined);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-10000 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans animate-in fade-in duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-base-0 border border-border-strong rounded-md shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-100 max-h-[90vh]"
      >
        <ConfigHeader onClose={handleClose} repoName={activeRepoName} />

        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {modalError && (
            <div className="p-2.5 bg-git-removed-bg border border-git-removed/40 rounded-sm flex items-start gap-2 text-xs text-git-removed animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-git-removed shrink-0 mt-0.5" />
              <div className="leading-snug">{modalError}</div>
            </div>
          )}

          {/* 1. Remote Connected Identity Selector */}
          <RemoteIdentitySection
            selectedSyncAccount={selectedSyncAccount}
            onSyncAccountChange={handleSyncAccountChange}
            accounts={allAvailableAccounts}
            isDropdownOpen={isDropdownOpen}
            onToggleDropdown={() => setIsDropdownOpen(!isDropdownOpen)}
            dropdownRef={dropdownRef}
          />

          {/* 2. Unified Active Identity & Commit Preview Card */}
          <div className="space-y-1.5 font-sans select-none">
            <div className="flex items-center justify-between">
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint flex items-center gap-1.5">
                <GitCommit className="w-3 h-3 text-commito-coral" />
                <span>Author Identity & Commit Preview</span>
              </label>
              {isManualMode && (
                allAvailableAccounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSyncAccountChange(allAvailableAccounts[0].id)}
                    className="text-[11px] text-commito-coral hover:text-commito-coralLight font-semibold flex items-center gap-1 cursor-pointer transition"
                  >
                    <LinkIcon className="w-3 h-3" />
                    <span>Sync with Account</span>
                  </button>
                )
              ) 
              // : (
              //   <button
              //     type="button"
              //     onClick={() => setSelectedSyncAccount('custom')}
              //     className="text-[11px] text-text-muted hover:text-commito-coral font-semibold flex items-center gap-1 cursor-pointer transition"
              //   >
              //     <Edit3 className="w-3 h-3" />
              //     <span>Customize Manually</span>
              //   </button>
              // )
              }
            </div>

            <div className="p-3.5 bg-base-1 border border-border rounded-sm space-y-3.5 shadow-2xs">
              {/* Top Identity Card Header */}
              <div className="flex items-center gap-3 min-w-0">
                <ProfileAvatarSection
                  avatarUrl={avatarUrl}
                  name={name}
                  provider={selectedItem?.provider || selectedProvider}
                  fileInputRef={fileInputRef}
                  onImageUpload={handleImageUpload}
                  onRemoveAvatar={handleRemoveAvatar}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-text-primary truncate">
                      {name || 'Unknown Author'}
                    </h3>
                    {!isManualMode && selectedItem && (
                      <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs border text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shrink-0">
                        Synced
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-muted font-mono truncate mt-0.5">
                    {email || 'No email configured'}
                  </div>
                </div>
              </div>

              {/* Editable Fields (When in Manual Mode) */}
              {isManualMode && (
                <div className="pt-2 border-t border-border/70">
                  <GitIdentityForm
                    name={name}
                    onNameChange={setName}
                    email={email}
                    onEmailChange={setEmail}
                    isValidEmail={isValidEmail}
                  />
                </div>
              )}

              {/* Live Commit Header Box Preview */}
              <div className="p-2.5 bg-base-2/70 border border-border/80 rounded-xs space-y-1 font-mono text-[11px] shadow-2xs">
                {/* <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-faint flex items-center justify-between">
                  <span>Git Commit Output Preview</span>
                  <span className="text-[9px] text-text-muted lowercase">git log format</span>
                </div>
                <div className="text-[10px] text-text-faint truncate">
                  commit 8f2c3a1 (HEAD -&gt; {activeRepoName ? 'main' : 'master'})
                </div> */}
                <div className="text-[11px] text-text-secondary truncate">
                  Author:{' '}
                  <span className="text-text-primary font-bold">{name || 'Your Name'}</span>{' '}
                  <span className="text-commito-coral">&lt;{email || 'your-email@example.com'}&gt;</span>
                </div>
              </div>
            </div>
          </div>

          <ConfigFooter
            onClose={handleClose}
            isValid={isFormValid}
            isSubmitting={isSubmitting}
          />
        </form>
      </div>
    </div>,
    document.body
  );
};
