import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useAccountServicesStore } from '../../features/account-services/store/accountStore';

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
function getInitials(name?: string, handle?: string): string {
  const clean = (name || handle || '').trim().replace(/^@+/, '');
  if (!clean || clean.toLowerCase() === 'you' || clean.toLowerCase() === 'user') return '';

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

/**
 * Computes SHA-256 hex string for a given text using SubtleCrypto.
 */
async function sha256Hex(text: string): Promise<string> {
  const normalized = text.trim().toLowerCase();
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    try {
      const data = new TextEncoder().encode(normalized);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return '';
    }
  }
  return '';
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
  const accounts = useAccountServicesStore((s) => s.accounts);

  // If ANY prop is explicitly passed, do not fallback to global active session user
  const isExplicit =
    url !== undefined ||
    name !== undefined ||
    handle !== undefined ||
    email !== undefined ||
    provider !== undefined;

  const currentProvider = provider || (isExplicit ? undefined : user?.provider);
  const targetName =
    name !== undefined ? name : isExplicit ? '' : user?.name || user?.username || '';
  const targetHandle = handle !== undefined ? handle : isExplicit ? '' : user?.username;
  const targetEmail = email !== undefined ? email : isExplicit ? '' : user?.email;

  const [gravatarUrl, setGravatarUrl] = useState<string | null>(null);
  const [candidateIndex, setCandidateIndex] = useState<number>(0);

  // Compute Gravatar SHA-256 URL asynchronously if email is present
  useEffect(() => {
    let isCancelled = false;
    if (
      targetEmail &&
      targetEmail.trim() &&
      !targetEmail.includes('noreply') &&
      !targetEmail.includes('example.com')
    ) {
      sha256Hex(targetEmail).then((hash) => {
        if (!isCancelled && hash) {
          setGravatarUrl(`https://www.gravatar.com/avatar/${hash}?d=404&s=128`);
        }
      });
    } else if (!isCancelled) {
      // No valid email — clear any stale Gravatar URL
      setGravatarUrl(null);
    }
    return () => {
      isCancelled = true;
    };
  }, [targetEmail]);

  // Determine candidate URLs in priority order for THIS specific entity
  const candidateUrls = useMemo(() => {
    const list: string[] = [];

    // 1. Explicit avatar URL for this entity
    const primaryUrl = url !== undefined ? url : isExplicit ? null : user?.avatar_url;
    if (primaryUrl && primaryUrl !== 'null' && primaryUrl.trim() !== '') {
      let trimmed = primaryUrl.trim();
      if (trimmed.startsWith('/')) {
        trimmed = `https://gitlab.com${trimmed}`;
      }
      list.push(trimmed);
    }

    // 2. Check if this entity's email or name matches any configured/connected provider account
    const normEmail = targetEmail?.trim().toLowerCase();
    const normName = targetName?.trim().toLowerCase();
    const normHandle = targetHandle?.trim().replace(/^@+/, '').toLowerCase();

    if (normEmail || normName || normHandle) {
      // Find matching account in connected registry
      const matchedAccount = accounts.find((a) => {
        if (normEmail && a.commit_email && a.commit_email.toLowerCase() === normEmail) return true;
        if (normEmail && a.handle && a.handle.toLowerCase() === normEmail) return true;
        if (normHandle && a.handle && a.handle.toLowerCase().replace(/^@+/, '') === normHandle)
          return true;
        if (normName && a.display_name && a.display_name.toLowerCase() === normName) return true;
        if (normName && a.handle && a.handle.toLowerCase().replace(/^@+/, '') === normName)
          return true;
        return false;
      });

      if (matchedAccount) {
        if (matchedAccount.avatar_url && matchedAccount.avatar_url.trim()) {
          list.push(matchedAccount.avatar_url.trim());
        }
        if (matchedAccount.provider === 'github' && matchedAccount.handle) {
          const h = matchedAccount.handle.replace(/^@+/, '');
          list.push(`https://github.com/${h}.png?size=128`);
          list.push(`https://avatars.githubusercontent.com/${h}?size=128`);
        }
      }
    }

    // 3. Direct provider avatar CDN (ONLY if an explicit username/handle is provided, never from display name)
    if (targetHandle) {
      const cleanHandle = targetHandle.trim().replace(/^@+/, '');
      if (cleanHandle && !cleanHandle.includes(' ') && /^[a-zA-Z0-9_-]+$/.test(cleanHandle)) {
        if (currentProvider?.toLowerCase() === 'github') {
          list.push(`https://github.com/${cleanHandle}.png?size=128`);
          list.push(`https://avatars.githubusercontent.com/${cleanHandle}?size=128`);
        }
      }
    }

    // 4. Gravatar fallback if computed
    if (gravatarUrl) {
      list.push(gravatarUrl);
    }

    // De-duplicate URLs while preserving priority
    return Array.from(new Set(list));
  }, [
    url,
    targetHandle,
    provider,
    isExplicit,
    user?.avatar_url,
    currentProvider,
    gravatarUrl,
    targetEmail,
    targetName,
    accounts,
  ]);

  // Reset candidate index when candidate list changes.
  // By tracking a "canonical key" derived from the list we can initialise
  // candidateIndex to 0 inside useMemo so there is no separate effect-triggered
  // setState call, satisfying the react-hooks/set-state-in-effect rule.
  const candidateUrlsKey = candidateUrls.join('|');
  const [prevCandidateUrlsKey, setPrevCandidateUrlsKey] = useState(candidateUrlsKey);
  if (prevCandidateUrlsKey !== candidateUrlsKey) {
    setPrevCandidateUrlsKey(candidateUrlsKey);
    setCandidateIndex(0);
  }

  const initials = useMemo(() => getInitials(targetName, targetHandle), [targetName, targetHandle]);
  const providerStyle = useMemo(() => getProviderStyle(currentProvider), [currentProvider]);
  const isCustomRounded = className.includes('rounded-');
  const roundedClass = isCustomRounded ? '' : 'rounded-full';

  const currentSrc = candidateIndex < candidateUrls.length ? candidateUrls[candidateIndex] : null;

  if (currentSrc) {
    return (
      <img
        key={currentSrc}
        src={currentSrc}
        alt={targetName || targetHandle || 'Avatar'}
        referrerPolicy="no-referrer"
        onError={() => {
          setCandidateIndex((prev) => prev + 1);
        }}
        className={`${className} ${roundedClass} border border-border object-cover flex-shrink-0 shadow-xs select-none`}
      />
    );
  }

  // Fallback with initials or User icon
  return (
    <div
      className={`${className} ${roundedClass} ${providerStyle} flex items-center justify-center flex-shrink-0 border shadow-xs font-mono font-bold select-none`}
      title={targetName || targetHandle || 'User'}
    >
      {initials ? (
        <span className="text-[10px] leading-none tracking-tight uppercase">{initials}</span>
      ) : (
        <User className={`${iconClassName} opacity-80`} />
      )}
    </div>
  );
};
