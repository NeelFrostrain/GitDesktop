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
  showInitials?: boolean;
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

const AVATAR_PALETTES = [
  'bg-rose-950/60 text-rose-300 border-rose-800/40',
  'bg-orange-950/60 text-orange-300 border-orange-800/40',
  'bg-amber-950/60 text-amber-300 border-amber-800/40',
  'bg-emerald-950/60 text-emerald-300 border-emerald-800/40',
  'bg-teal-950/60 text-teal-300 border-teal-800/40',
  'bg-sky-950/60 text-sky-300 border-sky-800/40',
  'bg-indigo-950/60 text-indigo-300 border-indigo-800/40',
  'bg-purple-950/60 text-purple-300 border-purple-800/40',
  'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-800/40',
];

/**
 * Deterministic color styling for initials badge based on author name/email/handle.
 */
function getAvatarColorStyle(key: string, provider?: string): string {
  if (provider) {
    switch (provider.toLowerCase()) {
      case 'github':
        return 'bg-purple-950/50 text-purple-300 border-purple-800/40';
      case 'bitbucket':
        return 'bg-blue-950/50 text-blue-300 border-blue-800/40';
      case 'gitlab':
        return 'bg-orange-950/50 text-orange-400 border-orange-800/40';
    }
  }
  if (!key) return 'bg-base-2 text-text-muted border-border';
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

/**
 * Computes MD5 hex hash for Gravatar URLs in pure JS.
 */
function md5Hex(string: string): string {
  function rotateLeft(lValue: number, iShiftBits: number) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function addUnsigned(lX: number, lY: number) {
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
      return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    }
    return lResult ^ lX8 ^ lY8;
  }
  function F(x: number, y: number, z: number) { return (x & y) | (~x & z); }
  function G(x: number, y: number, z: number) { return (x & z) | (y & ~z); }
  function H(x: number, y: number, z: number) { return x ^ y ^ z; }
  function I(x: number, y: number, z: number) { return y ^ (x | ~z); }
  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function convertToWordArray(str: string) {
    let lWordCount;
    const lMessageLength = str.length;
    const lNumberOfWordsTempOne = lMessageLength + 8;
    const lNumberOfWordsTempTwo = (lNumberOfWordsTempOne - (lNumberOfWordsTempOne % 64)) / 64;
    const lNumberOfWords = (lNumberOfWordsTempTwo + 1) * 16;
    const lWordArray = Array(lNumberOfWords - 1);
    let lBytePosition = 0;
    let lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition);
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }
  function wordToHex(lValue: number) {
    let wordToHexValue = '', wordToHexValueTemp = '', lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      wordToHexValueTemp = '0' + lByte.toString(16);
      wordToHexValue = wordToHexValue + wordToHexValueTemp.substring(wordToHexValueTemp.length - 2);
    }
    return wordToHexValue;
  }
  const x = convertToWordArray(string);
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21;
  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = FF(a, b, c, d, x[k + 0], S11, 0xd76aa478);
    d = FF(d, a, b, c, x[k + 1], S12, 0xe8c7b756);
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070db);
    b = FF(b, c, d, a, x[k + 3], S14, 0xc1bdceee);
    a = FF(a, b, c, d, x[k + 4], S11, 0xf57c0faf);
    d = FF(d, a, b, c, x[k + 5], S12, 0x4787c62a);
    c = FF(c, d, a, b, x[k + 6], S13, 0xa8304613);
    b = FF(b, c, d, a, x[k + 7], S14, 0xfd469501);
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098d8);
    d = FF(d, a, b, c, x[k + 9], S12, 0x8b44f7af);
    c = FF(c, d, a, b, x[k + 10], S13, 0xffff5bb1);
    b = FF(b, c, d, a, x[k + 11], S14, 0x895cd7be);
    a = FF(a, b, c, d, x[k + 12], S11, 0x6b901122);
    d = FF(d, a, b, c, x[k + 13], S12, 0xfd987193);
    c = FF(c, d, a, b, x[k + 14], S13, 0xa679438e);
    b = FF(b, c, d, a, x[k + 15], S14, 0x49b40821);
    a = GG(a, b, c, d, x[k + 1], S21, 0xf61e2562);
    d = GG(d, a, b, c, x[k + 6], S22, 0xc040b340);
    c = GG(c, d, a, b, x[k + 11], S23, 0x265e5a51);
    b = GG(b, c, d, a, x[k + 0], S24, 0xe9b6c7aa);
    a = GG(a, b, c, d, x[k + 5], S21, 0xd62f105d);
    d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
    c = GG(c, d, a, b, x[k + 15], S23, 0xd8a1e681);
    b = GG(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8);
    a = GG(a, b, c, d, x[k + 9], S21, 0x21e1cde6);
    d = GG(d, a, b, c, x[k + 14], S22, 0xc33707d6);
    c = GG(c, d, a, b, x[k + 3], S23, 0xf4d50d87);
    b = GG(b, c, d, a, x[k + 8], S24, 0x455a14ed);
    a = GG(a, b, c, d, x[k + 13], S21, 0xa9e3e905);
    d = GG(d, a, b, c, x[k + 2], S22, 0xfcefa3f8);
    c = GG(c, d, a, b, x[k + 7], S23, 0x676f02d9);
    b = GG(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a);
    a = HH(a, b, c, d, x[k + 5], S31, 0xfffa3942);
    d = HH(d, a, b, c, x[k + 8], S32, 0x8771f681);
    c = HH(c, d, a, b, x[k + 11], S33, 0x6d9d6122);
    b = HH(b, c, d, a, x[k + 14], S34, 0xfde5380c);
    a = HH(a, b, c, d, x[k + 1], S31, 0xa4beea44);
    d = HH(d, a, b, c, x[k + 4], S32, 0x4bdecfa9);
    c = HH(c, d, a, b, x[k + 7], S33, 0xf6bb4b60);
    b = HH(b, c, d, a, x[k + 10], S34, 0xbebfbc70);
    a = HH(a, b, c, d, x[k + 13], S31, 0x289b7ec6);
    d = HH(d, a, b, c, x[k + 0], S32, 0xeaa127fa);
    c = HH(c, d, a, b, x[k + 3], S33, 0xd4ef3085);
    b = HH(b, c, d, a, x[k + 6], S34, 0x4881d05);
    a = HH(a, b, c, d, x[k + 9], S31, 0xd9d4d039);
    d = HH(d, a, b, c, x[k + 12], S32, 0xe6db99e5);
    c = HH(c, d, a, b, x[k + 15], S33, 0x1fa27cf8);
    b = HH(b, c, d, a, x[k + 2], S34, 0xc4ac5665);
    a = II(a, b, c, d, x[k + 0], S41, 0xf4292244);
    d = II(d, a, b, c, x[k + 7], S42, 0x432aff97);
    c = II(c, d, a, b, x[k + 14], S43, 0xab9423a7);
    b = II(b, c, d, a, x[k + 5], S44, 0xfc93a039);
    a = II(a, b, c, d, x[k + 12], S41, 0x655b59c3);
    d = II(d, a, b, c, x[k + 3], S42, 0x8f0ccc92);
    c = II(c, d, a, b, x[k + 10], S43, 0xffeff47d);
    b = II(b, c, d, a, x[k + 1], S44, 0x85845dd1);
    a = II(a, b, c, d, x[k + 8], S41, 0x6fa87e4f);
    d = II(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0);
    c = II(c, d, a, b, x[k + 6], S43, 0xa3014314);
    b = II(b, c, d, a, x[k + 13], S44, 0x4e0811a1);
    a = II(a, b, c, d, x[k + 4], S41, 0xf7537e82);
    d = II(d, a, b, c, x[k + 11], S42, 0xbd3af235);
    c = II(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb);
    b = II(b, c, d, a, x[k + 9], S44, 0xeb86d391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
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
  showInitials = true,
}) => {
  const { user } = useGitStore();
  const accounts = useAccountServicesStore((s) => s.accounts);
  const activeAccount = useAccountServicesStore((s) => s.activeAccount);

  // If ANY identifier prop is explicitly passed, do not fallback to global active session user
  const isExplicit =
    url !== undefined ||
    name !== undefined ||
    handle !== undefined ||
    email !== undefined ||
    provider !== undefined;

  const currentProvider =
    provider || (isExplicit ? undefined : user?.provider || activeAccount?.provider);
  const targetName =
    name !== undefined
      ? name
      : isExplicit
        ? ''
        : user?.name || user?.username || activeAccount?.display_name || '';
  const targetHandle =
    handle !== undefined ? handle : isExplicit ? '' : user?.username || activeAccount?.handle;
  const targetEmail =
    email !== undefined ? email : isExplicit ? '' : user?.email || activeAccount?.commit_email;

  const [gravatarShaUrl, setGravatarShaUrl] = useState<string | null>(null);
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
          setGravatarShaUrl(`https://www.gravatar.com/avatar/${hash}?d=404&s=128`);
        }
      });
    } else if (!isCancelled) {
      setGravatarShaUrl(null);
    }
    return () => {
      isCancelled = true;
    };
  }, [targetEmail]);

  // Determine candidate URLs in priority order for THIS specific entity
  const candidateUrls = useMemo(() => {
    const list: string[] = [];

    // 1. Explicit avatar URL for this entity
    const primaryUrl =
      url !== undefined ? url : isExplicit ? null : user?.avatar_url || activeAccount?.avatar_url;
    if (primaryUrl && primaryUrl !== 'null' && primaryUrl.trim() !== '') {
      let trimmed = primaryUrl.trim();
      if (trimmed.startsWith('/')) {
        trimmed = `https://gitlab.com${trimmed}`;
      }
      list.push(trimmed);
    }

    const normEmail = targetEmail?.trim().toLowerCase() || '';
    const normName = targetName?.trim().toLowerCase() || '';
    const normHandle = targetHandle?.trim().replace(/^@+/, '').toLowerCase() || '';

    // 2. Check if this entity's email, name or handle matches any configured/connected provider account
    if (normEmail || normName || normHandle) {
      const matchedAccount = accounts.find((a) => {
        if (normEmail && a.commit_email && a.commit_email.toLowerCase() === normEmail) return true;
        if (normEmail && a.handle && a.handle.toLowerCase() === normEmail) return true;
        if (normHandle && a.handle && a.handle.toLowerCase().replace(/^@+/, '') === normHandle) return true;
        if (normName && a.display_name && a.display_name.toLowerCase() === normName) return true;
        if (normName && a.handle && a.handle.toLowerCase().replace(/^@+/, '') === normName) return true;
        return false;
      });

      // ONLY use matchedAccount avatar if it specifically matches this user (NEVER leak activeAccount)
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

    // 3. GitHub noreply email detection (e.g. 12345+username@users.noreply.github.com or username@users.noreply.github.com)
    if (normEmail && normEmail.includes('@users.noreply.github.com')) {
      const ghMatch = normEmail.match(/(?:[0-9]+\+)?([a-zA-Z0-9_-]+)@users\.noreply\.github\.com/i);
      if (ghMatch && ghMatch[1]) {
        const ghUser = ghMatch[1];
        list.push(`https://github.com/${ghUser}.png?size=128`);
        list.push(`https://avatars.githubusercontent.com/${ghUser}?size=128`);
      }
    }

    // 4. Bot author identification (e.g. warp-agent-staging[bot] -> warp-agent-staging)
    if (normName.includes('[bot]') || normHandle.includes('[bot]')) {
      const botName = (normHandle || normName).replace(/\[bot\]/g, '').trim();
      if (botName && /^[a-zA-Z0-9_-]+$/.test(botName)) {
        list.push(`https://github.com/${botName}.png?size=128`);
        list.push(`https://avatars.githubusercontent.com/${botName}?size=128`);
      }
    }

    // 5. Direct provider avatar CDN (if handle is present and provider is GitHub)
    if (targetHandle) {
      const cleanHandle = targetHandle.trim().replace(/^@+/, '');
      if (cleanHandle && !cleanHandle.includes(' ') && /^[a-zA-Z0-9_-]+$/.test(cleanHandle)) {
        if (currentProvider?.toLowerCase() === 'github') {
          list.push(`https://github.com/${cleanHandle}.png?size=128`);
          list.push(`https://avatars.githubusercontent.com/${cleanHandle}?size=128`);
        }
      }
    }

    // 6. Gravatar MD5 & SHA-256 fallbacks if valid email is present
    if (normEmail && !normEmail.includes('noreply') && !normEmail.includes('example.com') && normEmail.includes('@')) {
      try {
        const md5 = md5Hex(normEmail);
        if (md5) {
          list.push(`https://www.gravatar.com/avatar/${md5}?d=404&s=128`);
        }
      } catch {}
    }
    if (gravatarShaUrl) {
      list.push(gravatarShaUrl);
    }

    // De-duplicate URLs while preserving priority
    return Array.from(new Set(list));
  }, [
    url,
    targetHandle,
    provider,
    isExplicit,
    user?.avatar_url,
    activeAccount?.avatar_url,
    currentProvider,
    gravatarShaUrl,
    targetEmail,
    targetName,
    accounts,
  ]);

  // Reset candidate index when candidate list changes
  const candidateUrlsKey = candidateUrls.join('|');
  const [prevCandidateUrlsKey, setPrevCandidateUrlsKey] = useState(candidateUrlsKey);
  if (prevCandidateUrlsKey !== candidateUrlsKey) {
    setPrevCandidateUrlsKey(candidateUrlsKey);
    setCandidateIndex(0);
  }

  const initials = useMemo(() => getInitials(targetName, targetHandle), [targetName, targetHandle]);
  const avatarKey = targetEmail || targetHandle || targetName || '';
  const colorStyle = useMemo(
    () => getAvatarColorStyle(avatarKey, currentProvider),
    [avatarKey, currentProvider]
  );
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

  // Fallback with User icon or initials with deterministic distinct color badge
  return (
    <div
      className={`${className} ${roundedClass} ${colorStyle} flex items-center justify-center flex-shrink-0 border shadow-xs select-none`}
      title={targetName || targetHandle || targetEmail || 'User'}
    >
      {showInitials && initials ? (
        <span className="text-[10px] font-mono font-bold leading-none tracking-tight uppercase">
          {initials}
        </span>
      ) : (
        <User className={`${iconClassName} opacity-80`} />
      )}
    </div>
  );
};
