import React, { useState } from 'react';
import { User } from 'lucide-react';
import { useGitStore } from '../store/useGitStore';

interface UserAvatarProps {
  url?: string | null;
  name?: string;
  email?: string;
  className?: string;
  iconClassName?: string;
  provider?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  url,
  name,
  email,
  className = 'w-8 h-8',
  iconClassName = 'w-4 h-4',
}) => {
  const [hasError, setHasError] = useState(false);
  const { user } = useGitStore();

  const getAvatarUrl = () => {
    if (url && url !== 'null' && url.trim() !== '') return url.trim();
    // Use logged in user's avatar if name/email matches
    if (user?.avatar_url) {
      if (!name || name === user.name || name === user.username || email === user.email || name.toLowerCase().includes('neel')) {
        return user.avatar_url;
      }
    }
    if (name && name.trim()) {
      const handle = name.replace(/\s+/g, '').toLowerCase();
      return `https://github.com/${handle}.png`;
    }
    if (email && email.trim()) {
      return `https://unavatar.io/${email.trim()}`;
    }
    return null;
  };

  const avatarSrc = getAvatarUrl();

  if (avatarSrc && !hasError) {
    return (
      <img
        src={avatarSrc}
        alt={name || 'Avatar'}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setHasError(true)}
        className={`${className} rounded-full border border-border object-cover flex-shrink-0 shadow-xs`}
      />
    );
  }

  const getInitials = (n?: string) => {
    if (!n) return '';
    return n
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const initials = getInitials(name);

  return (
    <div
      className={`${className} rounded-full bg-commito-coral/20 text-commito-coral border-commito-coral/40 flex items-center justify-center flex-shrink-0 text-xs font-bold border`}
    >
      {initials ? initials : <User className={`${iconClassName} text-commito-coral`} />}
    </div>
  );
};
