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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150 font-sans">
      <div className="bg-surface-elevated border border-border-subtle rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-commito-coral" />
            <h3 className="text-sm font-semibold text-text">
              Edit Account ({account.handle})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/25 rounded-md text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-subtle flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-text-muted" />
              <span>Display Nickname</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Neel Frostrain"
              className="w-full bg-surface border border-border-subtle focus:border-commito-coral rounded-md px-3 py-2 text-xs text-text placeholder-text-muted/60 focus:outline-none transition"
              required
            />
            <p className="text-[11px] text-text-muted">
              Local display name shown in Git Desktop.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-subtle flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-text-muted" />
              <span>Commit Author Email Override</span>
            </label>
            <input
              type="email"
              value={commitEmail}
              onChange={(e) => setCommitEmail(e.target.value)}
              placeholder="e.g. neelofficial0812@gmail.com"
              className="w-full bg-surface border border-border-subtle focus:border-commito-coral rounded-md px-3 py-2 text-xs font-mono text-text placeholder-text-muted/60 focus:outline-none transition"
            />
            <p className="text-[11px] text-text-muted">
              Used for Git commit authorship (`user.email`) when this account is active.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-surface hover:bg-surface-hover border border-border-subtle text-text-subtle hover:text-text rounded-md text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 bg-commito-coral hover:bg-commito-coral-hover text-white rounded-md text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
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
