import { describe, it, expect, beforeEach } from 'vitest';
import { avatarCache } from './avatarCacheService';

describe('AvatarCacheService', () => {
  beforeEach(async () => {
    await avatarCache.clear();
  });

  it('stores and retrieves avatar in memory cache synchronously', async () => {
    const testUrl = 'https://avatars.example.com/user1.png';
    const fakeDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    expect(avatarCache.getSync(testUrl)).toBeNull();

    await avatarCache.set(testUrl, fakeDataUrl);

    expect(avatarCache.getSync(testUrl)).toBe(fakeDataUrl);
    const asyncResult = await avatarCache.get(testUrl);
    expect(asyncResult).toBe(fakeDataUrl);
  });

  it('handles null, undefined, or empty URLs gracefully', async () => {
    expect(avatarCache.getSync(null)).toBeNull();
    expect(avatarCache.getSync(undefined)).toBeNull();
    expect(avatarCache.getSync('')).toBeNull();
    expect(await avatarCache.get(null)).toBeNull();
    expect(await avatarCache.getOrFetchAvatar([])).toBeNull();
  });

  it('resolves candidate URLs from cached entries', async () => {
    const candidate1 = 'https://example.com/not-cached.png';
    const candidate2 = 'https://example.com/cached.png';
    const fakeData = 'data:image/png;base64,12345';

    await avatarCache.set(candidate2, fakeData);

    const resolved = await avatarCache.getOrFetchAvatar([candidate1, candidate2]);
    expect(resolved).toBe(fakeData);
  });
});
