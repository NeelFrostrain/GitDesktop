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
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
        Profile
      </label>

      <div className="p-2.5 bg-base-0 border border-border rounded-md flex items-center gap-3">
        <UserAvatar
          url={avatarUrl}
          name={name || 'User'}
          className="w-10 h-10 ring-1 ring-border"
          iconClassName="w-4 h-4"
        />

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-text-primary truncate leading-tight">
            {name || 'User Identity'}
          </h4>
          <p className="text-[10px] text-text-muted truncate">
            App profile image
          </p>

          <div className="flex items-center gap-1.5 pt-1">
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
              className="px-2 py-0.5 bg-base-1 hover:bg-base-2 border border-border rounded text-[10px] font-semibold text-text-primary flex items-center gap-1 transition cursor-pointer"
            >
              <Upload className="w-2.5 h-2.5 text-commito-coral" />
              <span>Upload</span>
            </button>

            {avatarUrl && (
              <button
                type="button"
                onClick={onRemoveAvatar}
                className="px-2 py-0.5 bg-base-1 hover:bg-base-2 border border-border rounded text-[10px] font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 transition cursor-pointer"
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
