import { GitService } from './gitService';
import { PullRequestService, parseRemoteRepoInfo } from './pullRequestService';
import { ReleaseService } from './releaseService';
import { avatarCache } from '../accounts/avatarCacheService';
import { UnifiedMergeRequest, ReleaseInfo, CommitInfo, TagInfo, BranchInfo } from '../../types/git';
import { useLogStore } from '../../store/useLogStore';
import { useRemoteStore } from '../../store/remoteStore';
import { useGitStore } from '../../store/useGitStore';

export interface CachedPRData {
  prs: UnifiedMergeRequest[];
  totalCount: number;
  repoName: string;
  fetchedAt: number;
}

export interface CachedReleaseData {
  releases: ReleaseInfo[];
  fetchedAt: number;
}

export interface CachedCommitData {
  commits: CommitInfo[];
  fetchedAt: number;
}

export interface CachedTagData {
  tags: TagInfo[];
  fetchedAt: number;
}

export type CacheUpdateType = 'prs' | 'branches' | 'releases' | 'commits' | 'tags';
export type CacheListener = (repoPath: string, type: CacheUpdateType, data: unknown) => void;

const DB_NAME = 'commito_repo_cache_v1';
const STORE_NAME = 'repo_data';
const DB_VERSION = 1;
const MAX_REPO_CACHE_CAPACITY = 10;

class RepoCacheServiceClass {
  private prCache = new Map<string, CachedPRData>();
  private branchCache = new Map<string, BranchInfo[]>();
  private releaseCache = new Map<string, CachedReleaseData>();
  private commitCache = new Map<string, CachedCommitData>();
  private tagCache = new Map<string, CachedTagData>();
  private inFlightPrecaching = new Set<string>();
  private listeners = new Set<CacheListener>();
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private isIndexedDBAvailable: boolean;

  private enforceCapacity<T>(map: Map<string, T>, max = MAX_REPO_CACHE_CAPACITY): void {
    while (map.size > max) {
      const oldest = map.keys().next().value;
      if (oldest) {
        map.delete(oldest);
      } else {
        break;
      }
    }
  }

  constructor() {
    this.isIndexedDBAvailable = typeof window !== 'undefined' && 'indexedDB' in window;
    if (this.isIndexedDBAvailable) {
      this.initDBAndRehydrate();
    }
  }

  /**
   * Initializes IndexedDB and rehydrates in-memory cache for 0ms cold startup.
   */
  private async initDBAndRehydrate(): Promise<void> {
    if (!this.isIndexedDBAvailable) return;
    try {
      const db = await this.getDB();
      if (!db) return;

      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records: Array<{ key: string; type: string; data: unknown }> = req.result || [];
        for (const r of records) {
          if (!r.key || !r.type) continue;
          const repoPath = r.key;
          if (r.type === 'prs') {
            this.prCache.set(repoPath, r.data as CachedPRData);
          } else if (r.type === 'branches') {
            this.branchCache.set(repoPath, r.data as BranchInfo[]);
          } else if (r.type === 'releases') {
            this.releaseCache.set(repoPath, r.data as CachedReleaseData);
          } else if (r.type === 'commits') {
            this.commitCache.set(repoPath, r.data as CachedCommitData);
          } else if (r.type === 'tags') {
            this.tagCache.set(repoPath, r.data as CachedTagData);
          }
        }
      };
    } catch (err) {
      console.warn('[RepoCacheService] IndexedDB rehydration error:', err);
    }
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (!this.isIndexedDBAvailable) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private async persistToIndexedDB(repoPath: string, type: string, data: unknown): Promise<void> {
    if (!this.isIndexedDBAvailable || !repoPath) return;
    try {
      const db = await this.getDB();
      if (!db) return;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const id = `${repoPath}:${type}`;
      store.put({ id, key: repoPath, type, data, timestamp: Date.now() });
    } catch {}
  }

  /**
   * Subscribes to cache update events across any repository.
   */
  public subscribe(listener: CacheListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(repoPath: string, type: CacheUpdateType, data: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener(repoPath, type, data);
      } catch (err) {
        console.warn('[RepoCacheService] Listener error:', err);
      }
    }
  }

  /**
   * Retrieves cached Pull Requests for a repository.
   */
  public getPullRequests(repoPath: string): CachedPRData | null {
    if (!repoPath) return null;
    const data = this.prCache.get(repoPath);
    if (!data) return null;
    return data;
  }

  /**
   * Sets cached Pull Requests for a repository and notifies listeners.
   */
  public setPullRequests(
    repoPath: string,
    prs: UnifiedMergeRequest[],
    totalCount?: number,
    repoName?: string
  ): void {
    if (!repoPath) return;
    const total = totalCount ?? (prs[0]?.total_count || prs.length);
    const resolvedName = repoName ?? (prs[0]?.repo_full_name || '');
    const data: CachedPRData = {
      prs,
      totalCount: total,
      repoName: resolvedName,
      fetchedAt: Date.now(),
    };
    this.enforceCapacity(this.prCache);
    this.prCache.set(repoPath, data);
    this.notify(repoPath, 'prs', data);
    this.persistToIndexedDB(repoPath, 'prs', data);
  }

  /**
   * Retrieves cached branches for a repository.
   */
  public getBranches(repoPath: string): BranchInfo[] | null {
    if (!repoPath) return null;
    return this.branchCache.get(repoPath) || null;
  }

  /**
   * Sets cached branches for a repository and notifies listeners.
   */
  public setBranches(repoPath: string, branches: BranchInfo[]): void {
    if (!repoPath) return;
    this.enforceCapacity(this.branchCache);
    this.branchCache.set(repoPath, branches);
    this.notify(repoPath, 'branches', branches);
    this.persistToIndexedDB(repoPath, 'branches', branches);
  }

  /**
   * Retrieves cached releases for a repository.
   */
  public getReleases(repoPath: string): ReleaseInfo[] | null {
    if (!repoPath) return null;
    const data = this.releaseCache.get(repoPath);
    if (!data) return null;
    return data.releases;
  }

  /**
   * Sets cached releases for a repository.
   */
  public setReleases(repoPath: string, releases: ReleaseInfo[]): void {
    if (!repoPath) return;
    const data = {
      releases,
      fetchedAt: Date.now(),
    };
    this.enforceCapacity(this.releaseCache);
    this.releaseCache.set(repoPath, data);
    this.notify(repoPath, 'releases', releases);
    this.persistToIndexedDB(repoPath, 'releases', data);
  }

  /**
   * Retrieves cached initial commits for a repository.
   */
  public getCommits(repoPath: string): CommitInfo[] | null {
    if (!repoPath) return null;
    const data = this.commitCache.get(repoPath);
    if (!data) return null;
    return data.commits;
  }

  /**
   * Sets cached initial commits for a repository.
   */
  public setCommits(repoPath: string, commits: CommitInfo[]): void {
    if (!repoPath) return;
    const data = {
      commits,
      fetchedAt: Date.now(),
    };
    this.enforceCapacity(this.commitCache);
    this.commitCache.set(repoPath, data);
    this.notify(repoPath, 'commits', commits);
    this.persistToIndexedDB(repoPath, 'commits', data);
  }

  /**
   * Retrieves cached tags for a repository.
   */
  public getTags(repoPath: string): TagInfo[] | null {
    if (!repoPath) return null;
    const data = this.tagCache.get(repoPath);
    if (!data) return null;
    return data.tags;
  }

  /**
   * Sets cached tags for a repository.
   */
  public setTags(repoPath: string, tags: TagInfo[]): void {
    if (!repoPath) return;
    const data = {
      tags,
      fetchedAt: Date.now(),
    };
    this.enforceCapacity(this.tagCache);
    this.tagCache.set(repoPath, data);
    this.notify(repoPath, 'tags', tags);
    this.persistToIndexedDB(repoPath, 'tags', data);
  }

  /**
   * Pre-caches and warms everything associated with a repository from the cloud provider
   * and local git (Branches, PRs, releases, commit history, author profile pictures, tags).
   */
  public async precacheRepository(repoPath: string, force = false): Promise<void> {
    if (!repoPath) return;
    if (this.inFlightPrecaching.has(repoPath) && !force) return;

    this.inFlightPrecaching.add(repoPath);

    try {
      // 1. Pre-fetch Branches (local & remote)
      const branchesPromise = (async () => {
        try {
          const branches = await GitService.listBranches(repoPath);
          if (branches && branches.length > 0) {
            this.setBranches(repoPath, branches);
            if (useGitStore.getState().activeRepoPath === repoPath) {
              useGitStore.getState().setBranches(branches);
            }
          }
        } catch {}
      })();

      // 2. Pre-fetch remotes & cloud Pull Requests
      const prPromise = (async () => {
        try {
          let remotes = useRemoteStore.getState().remotes;
          if (remotes.length === 0) {
            try {
              const direct = await GitService.listRemotes(repoPath);
              if (direct && direct.length > 0) {
                remotes = direct;
                useRemoteStore.setState({ remotes: direct });
              }
            } catch {}
          }

          const upstream = remotes.find((r) => r.name.toLowerCase() === 'upstream');
          const origin = remotes.find((r) => r.name.toLowerCase() === 'origin');
          const primaryRemote = upstream || origin || remotes[0];
          const primaryInfo = parseRemoteRepoInfo(primaryRemote?.url || primaryRemote?.push_url);

          if (primaryInfo?.projectPath) {
            const prs = await PullRequestService.listOpenPullRequests(
              primaryInfo.projectPath,
              primaryInfo.serverUrl,
              primaryInfo.provider
            );

            if (prs) {
              const totalCount = prs[0]?.total_count || prs.length;
              const resolvedRepoName = prs[0]?.repo_full_name || primaryInfo.projectPath;
              this.setPullRequests(repoPath, prs, totalCount, resolvedRepoName);
            }
          }
        } catch {
          // Non-blocking background pre-fetch
        }
      })();

      // 3. Pre-fetch tags and releases in parallel
      const releasePromise = (async () => {
        try {
          const [releases, tags] = await Promise.all([
            ReleaseService.listReleases(repoPath).catch(() => []),
            GitService.listTags(repoPath).catch(() => []),
          ]);
          if (releases) this.setReleases(repoPath, releases);
          if (tags) {
            this.setTags(repoPath, tags);
            if (useGitStore.getState().activeRepoPath === repoPath) {
              useGitStore.getState().setTags(tags);
            }
          }
        } catch {}
      })();

      // 4. Pre-fetch initial commit history and warm author avatar cache
      const commitsPromise = (async () => {
        try {
          const commits = await GitService.getCommitHistory(repoPath, 60, 0).catch(() => []);
          if (commits && commits.length > 0) {
            this.setCommits(repoPath, commits);

            // Pre-warm avatar cache for authors with valid emails
            const authorEmails = Array.from(
              new Set(
                commits
                  .map((c) => c.author_email?.toLowerCase().trim())
                  .filter((email): email is string => Boolean(email))
              )
            );
            if (authorEmails.length > 0) {
              const gravatarUrls = authorEmails.map(
                (email) => `https://www.gravatar.com/avatar/${email}?d=404&s=80`
              );
              avatarCache.prefetchAvatars(gravatarUrls);
            }
          }
        } catch {}
      })();

      // Execute all warmers in parallel
      await Promise.allSettled([branchesPromise, prPromise, releasePromise, commitsPromise]);

      const repoName = repoPath.split(/[/\\]/).pop() || repoPath;
      useLogStore
        .getState()
        .addLog(
          'info',
          'Repo',
          `Pre-cached cloud repository data for '${repoName}' (PRs, releases, branches, tags, author avatars)`
        );
    } finally {
      this.inFlightPrecaching.delete(repoPath);
    }
  }

  /**
   * Clears cached data for a specific repository or all repositories.
   */
  public clearCache(repoPath?: string): void {
    if (repoPath) {
      this.prCache.delete(repoPath);
      this.branchCache.delete(repoPath);
      this.releaseCache.delete(repoPath);
      this.commitCache.delete(repoPath);
      this.tagCache.delete(repoPath);
    } else {
      this.prCache.clear();
      this.branchCache.clear();
      this.releaseCache.clear();
      this.commitCache.clear();
      this.tagCache.clear();
    }
  }
}

export const RepoCacheService = new RepoCacheServiceClass();
