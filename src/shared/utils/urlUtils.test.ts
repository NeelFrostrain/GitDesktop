import { describe, it, expect } from 'vitest';
import { getWebUrlFromRemoteUrl } from './urlUtils';

describe('getWebUrlFromRemoteUrl', () => {
  it('converts GitHub SSH URL to HTTPS web URL', () => {
    expect(getWebUrlFromRemoteUrl('git@github.com:user/repo.git')).toBe(
      'https://github.com/user/repo'
    );
  });

  it('converts GitLab SSH with subgroups to HTTPS web URL', () => {
    expect(getWebUrlFromRemoteUrl('git@gitlab.com:group/subgroup/project.git')).toBe(
      'https://gitlab.com/group/subgroup/project'
    );
  });

  it('cleans up HTTPS URL with .git and credentials', () => {
    expect(getWebUrlFromRemoteUrl('https://oauth2:secret@gitlab.com/org/repo.git')).toBe(
      'https://gitlab.com/org/repo'
    );
  });

  it('handles standard HTTPS URL', () => {
    expect(getWebUrlFromRemoteUrl('https://github.com/user/repo')).toBe(
      'https://github.com/user/repo'
    );
  });

  it('returns null for empty or invalid input', () => {
    expect(getWebUrlFromRemoteUrl('')).toBeNull();
  });
});
