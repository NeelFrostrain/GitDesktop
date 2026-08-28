/**
 * Utility functions for URL parsing and remote conversion.
 */

/**
 * Converts a Git Remote URL (SSH, HTTPS, or HTTP) to a clean web browser URL.
 * Supports GitHub, GitLab, Bitbucket, Azure DevOps, Gitea, etc.
 */
export function getWebUrlFromRemoteUrl(remoteUrl: string): string | null {
  if (!remoteUrl) return null;
  let url = remoteUrl.trim();

  // Handle SSH format: git@github.com:owner/repo.git or ssh://git@gitlab.com/owner/repo.git
  if (url.startsWith('git@') || url.includes('@')) {
    const match = url.match(/@([^:/]+)[:/](.+)/);
    if (match) {
      const host = match[1];
      let path = match[2];
      path = path.replace(/\.git$/, '');
      return `https://${host}/${path}`;
    }
  }

  // Handle HTTP / HTTPS
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Strip basic auth if present: https://user:pass@domain.com/...
    url = url.replace(/^(https?:\/\/)[^@]+@/, '$1');
    url = url.replace(/\.git$/, '');
    return url;
  }

  return null;
}
