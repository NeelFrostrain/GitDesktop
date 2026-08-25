import React, { RefObject } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { UserAvatar } from '../common/UserAvatar';

interface ProfileAvatarSectionProps {
  avatarUrl: string | null;
  name: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAvatar: () => void;
}

export const ProfileAvatarSection: React.FC<ProfileAvatarSectionProps> = ({
  avatarUrl,
  name,
  fileInputRef,
  onImageUpload,
  onRemoveAvatar,
}) => {
  return (
    <div className="space-y-1.5 font-sans select-none">
      <label className="text-[10.5px] font-bold uppercase tracking-wider text-text-faint block">
        Profile
      </label>

      <div className="p-3 bg-base-1 border border-border rounded-sm flex items-center gap-3.5 shadow-2xs">
        <UserAvatar
          url={avatarUrl}
          name={name || 'User'}
          className="w-10 h-10 rounded-sm ring-1 ring-border/80"
          iconClassName="w-4 h-4"
        />

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-text-primary truncate leading-tight">
            {name || 'User Identity'}
          </h4>
          <p className="text-[10.5px] text-text-muted truncate mt-0.5">
            App profile image
          </p>

          <div className="flex items-center gap-1.5 pt-1.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImageUpload}
              accept="image/png, image/jpeg, image/webp, image/svg+xml"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-6 px-2.5 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-[10.5px] font-semibold text-text-primary flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Upload className="w-2.5 h-2.5 text-commito-coral" />
              <span>Upload</span>
            </button>

            {avatarUrl && (
              <button
                type="button"
                onClick={onRemoveAvatar}
                className="h-6 px-2.5 bg-base-2 hover:bg-git-removed-bg border border-border hover:border-git-removed/40 rounded-sm text-[10.5px] font-semibold text-git-removed hover:text-danger flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
