import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';

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
  provider,
}) => {
  const [imgIndex, setImgIndex] = useState(0);
  const { user } = useGitStore();

  const currentProvider = provider || (user?.provider === 'gitlab' ? 'gitlab' : 'github');
  const targetName = name || user?.name || user?.username;
  const targetEmail = email || user?.email;
  const handle = targetName ? targetName.replace(/\s+/g, '').toLowerCase() : '';

  // Reset image fallback index when props change
  useEffect(() => {
    setImgIndex(0);
  }, [url, name, email, provider, user?.avatar_url]);

  // Candidate image sources in order of preference
  const candidateUrls: string[] = [];

  // 1. Explicit or store avatar URL
  let primaryUrl = url || (user?.avatar_url !== 'null' ? user?.avatar_url : null);
  if (primaryUrl && primaryUrl !== 'null' && primaryUrl.trim() !== '') {
    let trimmed = primaryUrl.trim();
    if (trimmed.startsWith('/')) {
      trimmed = `https://gitlab.com${trimmed}`;
    }
    candidateUrls.push(trimmed);
  }

  // 2. Direct GitHub public avatar (universal high-availability CDN)
  if (handle) {
    candidateUrls.push(`https://github.com/${handle}.png`);
  }

  // 3. Unavatar by email or handle
  if (targetEmail && targetEmail.trim()) {
    candidateUrls.push(`https://unavatar.io/${targetEmail.trim()}`);
  }

  if (handle) {
    if (currentProvider === 'gitlab') {
      candidateUrls.push(`https://unavatar.io/gitlab/${handle}`);
    } else {
      candidateUrls.push(`https://unavatar.io/github/${handle}`);
    }
  }

  // Current candidate URL
  const currentSrc = candidateUrls[imgIndex];

  if (currentSrc && imgIndex < candidateUrls.length) {
    return (
      <img
        src={currentSrc}
        alt={targetName || 'Avatar'}
        referrerPolicy="no-referrer"
        onError={() => setImgIndex((prev) => prev + 1)}
        className={`${className} rounded-full border border-border object-cover flex-shrink-0 shadow-xs`}
      />
    );
  }

  // Clean, visible default icon fallback
  return (
    <div
      className={`${className} rounded-full bg-base-2 text-commito-coral border-border flex items-center justify-center flex-shrink-0 border shadow-xs`}
    >
      <User className={`${iconClassName} text-commito-coral`} />
    </div>
  );
};
