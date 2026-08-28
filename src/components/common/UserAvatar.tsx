import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { avatarCache } from '../../services/accounts/avatarCacheService';

interface UserAvatarProps {
  url?: string | null;
  name?: string;
  handle?: string;
  email?: string;
  className?: string;
  iconClassName?: string;
  provider?: string;
}

/**
 * Extracts 1-2 uppercase initials from a name or handle.
 */
function getInitials(name?: string): string {
  if (!name) return '';
  const clean = name.trim().replace(/^@+/, '');
  if (!clean) return '';

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

/**
 * Returns provider-tailored background & text colors for initials placeholder.
 */
function getProviderStyle(provider?: string): string {
  switch (provider?.toLowerCase()) {
    case 'github':
      return 'bg-purple-950/40 text-purple-300 border-purple-800/40';
    case 'bitbucket':
      return 'bg-blue-950/40 text-blue-300 border-blue-800/40';
    case 'gitlab':
      return 'bg-orange-950/40 text-orange-400 border-orange-800/40';
    default:
      return 'bg-base-2 text-commito-coral border-border';
  }
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  url,
  name,
  handle,
  email,
  className = 'w-8 h-8',
  iconClassName = 'w-4 h-4',
  provider,
}) => {
  const { user } = useGitStore();

  // If ANY prop is explicitly passed, do not fallback to global active session user
  const isExplicit =
    url !== undefined ||
    name !== undefined ||
    handle !== undefined ||
    email !== undefined ||
    provider !== undefined;

  const currentProvider = provider || (isExplicit ? undefined : user?.provider);
  const targetName = name !== undefined ? name : (isExplicit ? '' : (user?.name || user?.username || ''));
  const targetHandle = handle !== undefined ? handle : (isExplicit ? '' : user?.username);
  const targetEmail = email !== undefined ? email : (isExplicit ? '' : user?.email);

  // Determine candidate URLs in priority order for THIS specific entity
  const candidateUrls = useMemo(() => {
    const list: string[] = [];

    // 1. Explicit avatar URL for this entity
    let primaryUrl = url !== undefined ? url : (isExplicit ? null : user?.avatar_url);
    if (primaryUrl && primaryUrl !== 'null' && primaryUrl.trim() !== '') {
      let trimmed = primaryUrl.trim();
      if (trimmed.startsWith('/')) {
        trimmed = `https://gitlab.com${trimmed}`;
      }
      list.push(trimmed);
    }

    // 2. Direct provider avatar CDN (only for this entity's provider and clean username)
    const rawUsername = (targetHandle || targetName || '').trim().replace(/^@+/, '');
    const cleanUsername = rawUsername.split(/\s+/)[0]; // First token for username

    if (cleanUsername && cleanUsername.length > 0) {
      if (currentProvider === 'github') {
        list.push(`https://github.com/${cleanUsername}.png`);
        list.push(`https://avatars.githubusercontent.com/${cleanUsername}`);
      } else if (currentProvider === 'gitlab') {
        list.push(`https://gitlab.com/${cleanUsername}.png`);
      }
    }

    // 3. Email fallback (only if specific valid non-noreply email)
    if (targetEmail && targetEmail.trim() && !targetEmail.includes('noreply') && !targetEmail.includes('example.com')) {
      list.push(`https://unavatar.io/${encodeURIComponent(targetEmail.trim())}`);
    }

    return list;
  }, [url, name, handle, email, provider, isExplicit, user?.avatar_url, currentProvider, targetName, targetHandle, targetEmail]);

  // Check sync memory cache first for 0ms immediate render
  const initialCached = useMemo(() => {
    for (const u of candidateUrls) {
      const cached = avatarCache.getSync(u);
      if (cached) return cached;
    }
    return null;
  }, [candidateUrls]);

  const [avatarSrc, setAvatarSrc] = useState<string | null>(initialCached);
  const [isLoading, setIsLoading] = useState<boolean>(!initialCached && candidateUrls.length > 0);
  const [hasFailed, setHasFailed] = useState<boolean>(false);

  // Fetch or load from persistent IndexedDB cache
  useEffect(() => {
    let isCancelled = false;

    // Check synchronous memory cache first
    for (const u of candidateUrls) {
      const mem = avatarCache.getSync(u);
      if (mem) {
        setAvatarSrc(mem);
        setIsLoading(false);
        setHasFailed(false);
        return;
      }
    }

    if (candidateUrls.length === 0) {
      setAvatarSrc(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasFailed(false);

    avatarCache
      .getOrFetchAvatar(candidateUrls)
      .then((resolved) => {
        if (isCancelled) return;
        if (resolved) {
          setAvatarSrc(resolved);
          setHasFailed(false);
        } else {
          setHasFailed(true);
        }
      })
      .catch(() => {
        if (!isCancelled) setHasFailed(true);
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [candidateUrls]);

  const initials = useMemo(() => getInitials(targetName || targetHandle), [targetName, targetHandle]);
  const providerStyle = useMemo(() => getProviderStyle(currentProvider), [currentProvider]);
  const isCustomRounded = className.includes('rounded-');
  const roundedClass = isCustomRounded ? '' : 'rounded-full';

  // If image is resolved and valid
  if (avatarSrc && !hasFailed) {
    return (
      <img
        src={avatarSrc}
        alt={targetName || targetHandle || 'Avatar'}
        referrerPolicy="no-referrer"
        onError={() => {
          // Invalidate failed source and trigger fallback
          setHasFailed(true);
        }}
        className={`${className} ${roundedClass} border border-border object-cover flex-shrink-0 shadow-xs select-none`}
      />
    );
  }

  // Fallback with initials or User icon
  return (
    <div
      className={`${className} ${roundedClass} ${providerStyle} flex items-center justify-center flex-shrink-0 border shadow-xs font-mono font-bold select-none ${
        isLoading ? 'animate-pulse' : ''
      }`}
      title={targetName || targetHandle || 'User'}
    >
      {initials ? (
        <span className="text-[10px] leading-none tracking-tight uppercase">
          {initials}
        </span>
      ) : (
        <User className={`${iconClassName} opacity-80`} />
      )}
    </div>
  );
};
