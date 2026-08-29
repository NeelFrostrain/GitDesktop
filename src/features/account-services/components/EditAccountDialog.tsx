import React, { useState, useRef } from 'react';
import { X, User, Mail, Camera, Trash2, Image as ImageIcon } from 'lucide-react';
import { ProviderAccount } from '../types';
import { useAccountServicesStore } from '../store/accountStore';
import { UserAvatar } from '../../../components/common/UserAvatar';
import { Button } from '../../../components/common/Button';

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
  const [avatarUrl, setAvatarUrl] = useState<string>(account.avatar_url || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP, SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      await updateAccount(account.id, {
        display_name: displayName.trim(),
        commit_email: commitEmail.trim(),
        avatar_url: avatarUrl.trim(),
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
      <div className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-base-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-commito-coral" />
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Edit Account ({account.handle})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 bg-base-0">
          {error && (
            <div className="p-2.5 bg-git-removed-bg border border-git-removed/40 rounded-sm text-xs text-git-removed">
              {error}
            </div>
          )}

          {/* Avatar Preview & Customizer */}
          <div className="flex items-center gap-3.5 p-3 rounded-sm border border-border bg-base-1/50">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/png, image/jpeg, image/webp, image/svg+xml"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-11 h-11 rounded-sm overflow-hidden border border-border hover:border-border-strong transition cursor-pointer shrink-0 group"
              title="Click to upload custom picture"
            >
              <UserAvatar
                url={avatarUrl || null}
                name={displayName || account.display_name}
                handle={account.handle}
                email={commitEmail || account.commit_email}
                provider={account.provider}
                className="w-full h-full object-cover"
                iconClassName="w-4 h-4"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                <Camera className="w-3 h-3" />
                <span className="text-[7.5px] font-bold uppercase tracking-wider mt-0.5">Edit</span>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-xs font-semibold text-text-primary">Profile Avatar</div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => fileInputRef.current?.click()}
                  leftIcon={<ImageIcon className="w-3 h-3" />}
                >
                  Upload
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    variant="soft-danger"
                    size="xs"
                    onClick={handleRemoveAvatar}
                    leftIcon={<Trash2 className="w-3 h-3" />}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-text-muted" />
              <span>Display Nickname</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Neel Frostrain"
              className="w-full bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none transition"
              required
            />
            <p className="text-[10.5px] text-text-muted">
              Local display name shown in Git Desktop.
            </p>
          </div>

          {/* Commit Email */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-text-muted" />
              <span>Commit Author Email Override</span>
            </label>
            <input
              type="email"
              value={commitEmail}
              onChange={(e) => setCommitEmail(e.target.value)}
              placeholder="e.g. neelofficial0812@gmail.com"
              className="w-full bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm px-2.5 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none transition"
            />
            <p className="text-[10.5px] text-text-muted">
              Used for Git commit authorship (`user.email`) when this account is active.
            </p>
          </div>

          {/* Custom Avatar URL input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-text-muted" />
              <span>Avatar Image URL (Optional)</span>
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://... or leave empty for initials"
              className="w-full bg-base-1 border border-border hover:border-border-strong focus:border-border-strong rounded-sm px-2.5 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none transition"
            />
            <p className="text-[10.5px] text-text-muted">
              Leave blank to use provider initials fallback (e.g. NF).
            </p>
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="coral"
              size="sm"
              isLoading={isSaving}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
