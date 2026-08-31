import React, { RefObject } from 'react';
import { Trash2, Camera } from 'lucide-react';
import { UserAvatar } from '../common/UserAvatar';

interface ProfileAvatarSectionProps {
  avatarUrl: string | null;
  name: string;
  provider?: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAvatar: () => void;
}

export const ProfileAvatarSection: React.FC<ProfileAvatarSectionProps> = ({
  avatarUrl,
  name,
  provider,
  fileInputRef,
  onImageUpload,
  onRemoveAvatar,
}) => {
  return (
    <div className="relative group shrink-0">
      <input
        type="file"
        ref={fileInputRef}
        onChange={onImageUpload}
        accept="image/png, image/jpeg, image/webp, image/svg+xml"
        className="hidden"
      />

      <div
        onClick={() => fileInputRef.current?.click()}
        className="relative w-12 h-12 rounded-full overflow-hidden border border-border group-hover:border-commito-coral/60 transition cursor-pointer shadow-2xs"
        title="Click to upload custom avatar"
      >
        <UserAvatar
          url={avatarUrl}
          name={name || 'User'}
          provider={provider}
          className="w-full h-full object-cover"
          iconClassName="w-5 h-5"
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
          <Camera className="w-3.5 h-3.5" />
          <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">Edit</span>
        </div>
      </div>

      {avatarUrl && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveAvatar();
          }}
          title="Reset avatar to default"
          className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-base-1 border border-border hover:border-git-removed/50 hover:bg-git-removed/20 text-text-muted hover:text-git-removed flex items-center justify-center transition cursor-pointer shadow-xs"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
};
