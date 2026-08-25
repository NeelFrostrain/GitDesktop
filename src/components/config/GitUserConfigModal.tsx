import React from 'react';
import { AlertCircle, Edit3 } from 'lucide-react';
import { useGitUserConfig } from '../../hooks/useGitUserConfig';
import { ConfigHeader } from './ConfigHeader';
import { RemoteIdentitySection } from './RemoteIdentitySection';
import { ProfileAvatarSection } from './ProfileAvatarSection';
import { GitIdentityForm } from './GitIdentityForm';
import { ConfigFooter } from './ConfigFooter';

export const GitUserConfigModal: React.FC = () => {
  const {
    isUserConfigModalOpen,
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
    setSelectedSyncAccount,
  } = useGitUserConfig();

  if (!isUserConfigModalOpen) return null;

  const isManualMode = selectedSyncAccount === 'custom';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-0 border border-border-strong rounded-sm shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
        <ConfigHeader onClose={handleClose} />

        <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto">
          {modalError && (
            <div className="p-2.5 bg-git-removed-bg border border-git-removed/40 rounded-sm flex items-start gap-2 text-xs text-git-removed">
              <AlertCircle className="w-4 h-4 text-git-removed shrink-0 mt-0.5" />
              <div className="leading-snug">{modalError}</div>
            </div>
          )}

          <RemoteIdentitySection
            selectedSyncAccount={selectedSyncAccount}
            onSyncAccountChange={handleSyncAccountChange}
            accounts={allAvailableAccounts}
            isDropdownOpen={isDropdownOpen}
            onToggleDropdown={() => setIsDropdownOpen(!isDropdownOpen)}
            dropdownRef={dropdownRef}
          />

          <ProfileAvatarSection
            avatarUrl={avatarUrl}
            name={name}
            fileInputRef={fileInputRef}
            onImageUpload={handleImageUpload}
            onRemoveAvatar={handleRemoveAvatar}
          />

          {/* Show Git Identity Form when Unlinked/Manual is selected, or a synced summary card when linked */}
          {isManualMode ? (
            <GitIdentityForm
              name={name}
              onNameChange={setName}
              email={email}
              onEmailChange={setEmail}
              isValidEmail={isValidEmail}
            />
          ) : (
            <div className="space-y-1.5 font-sans select-none">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint">
                  Git Identity
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedSyncAccount('custom')}
                  className="text-[11px] text-commito-coral hover:text-commito-coralLight font-semibold flex items-center gap-1 cursor-pointer transition"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit Manually</span>
                </button>
              </div>

              <div className="p-3 bg-base-1 border border-border rounded-sm flex items-center justify-between text-xs shadow-2xs">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="font-bold text-text-primary truncate">{name}</div>
                  <div className="text-[11px] text-text-muted font-mono truncate mt-0.5">{email}</div>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded-xs shrink-0">
                  Synced
                </span>
              </div>
            </div>
          )}

          <ConfigFooter
            onClose={handleClose}
            isValid={isFormValid}
            isSubmitting={isSubmitting}
          />
        </form>
      </div>
    </div>
  );
};
