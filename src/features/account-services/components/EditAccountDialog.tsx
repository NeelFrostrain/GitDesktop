import React, { useState } from 'react';
import { X, User, Mail, Check, Loader2 } from 'lucide-react';
import { ProviderAccount } from '../types';
import { useAccountServicesStore } from '../store/accountStore';

interface EditAccountDialogProps {
  account: ProviderAccount;
  isOpen: boolean;
  onClose: () => void;
}

export const EditAccountDialog: React.FC<EditAccountDialogProps> = ({
  account,
  isOpen,
  onClose,
}) => {
  const { updateAccount } = useAccountServicesStore();
  const [displayName, setDisplayName] = useState(account.display_name);
  const [commitEmail, setCommitEmail] = useState(account.commit_email);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      await updateAccount(account.id, {
        display_name: displayName.trim(),
        commit_email: commitEmail.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update account details');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none animate-fadeIn">
      <div className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-commito-coral" />
            <h3 className="text-sm font-bold text-text-primary">
              Edit Account Info ({account.handle})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 bg-git-removed-bg border border-git-removed/40 rounded-md text-xs text-git-removed">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-text-muted" />
              <span>Display Nickname</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Neel Frostrain"
              className="w-full bg-base-2 border border-border rounded-md px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral transition"
              required
            />
            <p className="text-[10px] text-text-muted">
              Local display name shown in Git Desktop.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-text-muted" />
              <span>Commit Author Email Override</span>
            </label>
            <input
              type="email"
              value={commitEmail}
              onChange={(e) => setCommitEmail(e.target.value)}
              placeholder="e.g. neelofficial0812@gmail.com"
              className="w-full bg-base-2 border border-border rounded-md px-3 py-2 text-xs font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral transition"
            />
            <p className="text-[10px] text-text-muted">
              Used for Git commit authorship (`user.email`) when this account is active.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-base-2 hover:bg-base-3 border border-border text-text-secondary hover:text-text-primary rounded-md text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 bg-commito-coral hover:bg-commito-coralHover text-white rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
