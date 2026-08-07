import React, { useState } from 'react';
import { User } from 'lucide-react';

interface UserAvatarProps {
  url?: string | null;
  name?: string;
  className?: string;
  iconClassName?: string;
  provider?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  url,
  name,
  className = 'w-8 h-8',
  iconClassName = 'w-4 h-4',
  provider,
}) => {
  const [hasError, setHasError] = useState(false);

  const cleanUrl = url && url !== 'null' && url.trim() !== '' ? url.trim() : null;

  if (cleanUrl && !hasError) {
    return (
      <img
        src={cleanUrl}
        alt={name || 'Avatar'}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setHasError(true)}
        className={`${className} rounded-full border border-border object-cover flex-shrink-0`}
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
      className={`${className} rounded-full ${
        provider === 'github'
          ? 'bg-white/10 text-white border-white/20'
          : 'bg-gitlab-orange/20 text-gitlab-orange border-gitlab-orange/40'
      } flex items-center justify-center flex-shrink-0 text-xs font-bold border`}
    >
      {initials ? initials : <User className={`${iconClassName} text-gitlab-orange`} />}
    </div>
  );
};
