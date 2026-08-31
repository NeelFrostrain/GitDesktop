import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserAvatar } from './UserAvatar';
import { avatarCache } from '../../services/accounts/avatarCacheService';
import { useGitStore } from '../../store/useGitStore';

describe('UserAvatar Component', () => {
  beforeEach(async () => {
    await avatarCache.clear();
    useGitStore.setState({
      user: {
        id: 'gitlab:1',
        name: 'Active User',
        username: 'activeuser',
        email: 'active@gitlab.com',
        avatar_url: 'https://gitlab.com/uploads/active-avatar.png',
        provider: 'gitlab',
        server_url: 'https://gitlab.com',
        web_url: 'https://gitlab.com',
      },
    });
  });

  it('renders initials fallback when no image is available', () => {
    render(<UserAvatar name="Neel Frostrain" provider="github" />);
    expect(screen.getByText('NF')).toBeTruthy();
  });

  it('renders user icon when name is empty', () => {
    const { container } = render(<UserAvatar name="" url="" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders cached image synchronously when available in memory cache', async () => {
    const avatarUrl = 'https://avatars.githubusercontent.com/u/12345?v=4';
    const fakeData =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    await avatarCache.set(avatarUrl, fakeData);

    render(<UserAvatar url={avatarUrl} name="Neel Frostrain" />);
    const img = screen.getByRole('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(avatarUrl);
  });

  it('does NOT leak active user avatar to commit authors with only name/email passed', () => {
    render(<UserAvatar name="Andy Carlson" email="andy@example.com" />);
    expect(screen.getByText('AC')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
