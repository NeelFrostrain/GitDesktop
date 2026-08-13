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
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
        <ConfigHeader onClose={handleClose} />

        <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto">
          {modalError && (
            <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded-md flex items-start gap-2 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Git Identity
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedSyncAccount('custom')}
                  className="text-[11px] text-commito-coral hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit Manually</span>
                </button>
              </div>

              <div className="p-3 bg-base-0 border border-border rounded-md flex items-center justify-between text-xs">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="font-bold text-text-primary truncate">{name}</div>
                  <div className="text-[11px] text-text-muted font-mono truncate">{email}</div>
                </div>
                <span className="text-[10px] text-emerald-400 font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded flex-shrink-0">
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
