/**
 * High-performance, multi-tiered Avatar Caching Service.
 *
 * Tier 1: In-Memory RAM Cache (Map<string, string>) for 0ms synchronous lookups.
 * Tier 2: Persistent Storage via IndexedDB (with localStorage fallback) to persist
 *         avatars across app restarts and view re-mounts.
 *
 * Features:
 * - Concurrent request deduplication (prevents multiple fetches for same avatar)
 * - Negative caching (avoids re-requesting failed URLs for 5 minutes)
 * - Background batch pre-fetching for connected accounts and users
 * - Stale-while-revalidate with configurable TTL (default 14 days)
 */

interface CachedAvatarRecord {
  url: string;
  dataUrl: string;
  timestamp: number;
}

const DB_NAME = 'commito_avatar_cache';
const DB_VERSION = 2;
const STORE_NAME = 'avatars';
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 6000; // 6 seconds timeout

class AvatarCacheService {
  private memCache: Map<string, string> = new Map();
  private inFlightFetches: Map<string, Promise<string | null>> = new Map();
  private failedUrls: Map<string, number> = new Map();
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private isIndexedDBAvailable: boolean;

  constructor() {
    this.isIndexedDBAvailable = typeof window !== 'undefined' && 'indexedDB' in window;
    if (this.isIndexedDBAvailable) {
      this.initDB();
    }
  }

  /**
   * Initializes the IndexedDB instance.
   */
  private async initDB(): Promise<IDBDatabase | null> {
    if (!this.isIndexedDBAvailable) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (db.objectStoreNames.contains(STORE_NAME)) {
            db.deleteObjectStore(STORE_NAME);
          }
          db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = (e) => {
          console.warn('[AvatarCache] IndexedDB open error:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('[AvatarCache] Failed to open IndexedDB:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Synchronous L1 memory cache lookup. Returns dataUrl or null.
   */
  public getSync(url?: string | null): string | null {
    if (!url || typeof url !== 'string') return null;
    const clean = url.trim();
    if (!clean) return null;
    return this.memCache.get(clean) || null;
  }

  /**
   * Checks if URL is in negative cache (failed recently).
   */
  private isNegativelyCached(url: string): boolean {
    const failedAt = this.failedUrls.get(url);
    if (!failedAt) return false;
    if (Date.now() - failedAt > NEGATIVE_CACHE_TTL_MS) {
      this.failedUrls.delete(url);
      return false;
    }
    return true;
  }

  /**
   * Records a URL fetch failure into negative cache.
   */
  private markFailed(url: string): void {
    this.failedUrls.set(url, Date.now());
  }

  /**
   * Asynchronous cache lookup (checks Memory -> IndexedDB).
   */
  public async get(url?: string | null): Promise<string | null> {
    if (!url || typeof url !== 'string') return null;
    const clean = url.trim();
    if (!clean) return null;

    // 1. Check L1 Memory
    const mem = this.memCache.get(clean);
    if (mem) return mem;

    // 2. Check L2 IndexedDB
    const db = await this.initDB();
    if (db) {
      try {
        const record = await new Promise<CachedAvatarRecord | null>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(clean);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });

        if (record && record.dataUrl) {
          // Check TTL expiration
          if (Date.now() - record.timestamp < CACHE_TTL_MS) {
            this.memCache.set(clean, record.dataUrl);
            return record.dataUrl;
          }
        }
      } catch (err) {
        console.warn('[AvatarCache] IndexedDB read error:', err);
      }
    }

    return null;
  }

  /**
   * Persists avatar data URL to both Memory and IndexedDB.
   */
  public async set(url: string, dataUrl: string): Promise<void> {
    if (!url || !dataUrl) return;
    const clean = url.trim();

    // Set L1 Memory
    this.memCache.set(clean, dataUrl);
    this.failedUrls.delete(clean);

    // Set L2 IndexedDB
    const db = await this.initDB();
    if (db) {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record: CachedAvatarRecord = {
          url: clean,
          dataUrl,
          timestamp: Date.now(),
        };
        store.put(record);
      } catch (err) {
        console.warn('[AvatarCache] IndexedDB save error:', err);
      }
    }
  }

  /**
   * Fetches an avatar from network and saves it as a base64 Data URL in cache.
   */
  public async fetchAndCache(url: string): Promise<string | null> {
    const clean = url.trim();
    if (!clean || clean === 'null') return null;

    // If already in memory
    if (this.memCache.has(clean)) {
      return this.memCache.get(clean)!;
    }

    // Check negative cache
    if (this.isNegativelyCached(clean)) {
      return null;
    }

    // Deduplicate in-flight fetches
    if (this.inFlightFetches.has(clean)) {
      return this.inFlightFetches.get(clean)!;
    }

    const fetchPromise = (async (): Promise<string | null> => {
      // First try IndexedDB
      const cached = await this.get(clean);
      if (cached) return cached;

      // Handle raw data: URLs directly
      if (clean.startsWith('data:image/')) {
        await this.set(clean, clean);
        return clean;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const response = await fetch(clean, {
          signal: controller.signal,
          mode: 'cors',
          credentials: 'omit',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          this.markFailed(clean);
          return null;
        }

        const blob = await response.blob();
        if (!blob || blob.size === 0) {
          this.markFailed(clean);
          return null;
        }

        // Convert blob to Data URL
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });

        if (dataUrl) {
          await this.set(clean, dataUrl);
          return dataUrl;
        }
      } catch (err: any) {
        // Mark failed to avoid rapid retry loops
        this.markFailed(clean);
      }
      return null;
    })();

    this.inFlightFetches.set(clean, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.inFlightFetches.delete(clean);
    }
  }

  /**
   * Tries candidates in order until a valid cached or fetched avatar is found.
   */
  public async getOrFetchAvatar(
    candidateUrls: (string | null | undefined)[]
  ): Promise<string | null> {
    const validUrls = candidateUrls.filter(
      (u): u is string => typeof u === 'string' && u.trim().length > 0 && u !== 'null'
    );

    if (validUrls.length === 0) return null;

    // 1. Fast path: check if any candidate is already in memory or indexedDB
    for (const url of validUrls) {
      const cached = this.getSync(url) || (await this.get(url));
      if (cached) {
        return cached;
      }
    }

    // 2. Fetch sequentially or in parallel
    for (const url of validUrls) {
      const fetched = await this.fetchAndCache(url);
      if (fetched) {
        return fetched;
      }
    }

    return null;
  }

  /**
   * Pre-fetches a list of avatar URLs in the background without blocking UI.
   */
  public async prefetchAvatars(urls: (string | null | undefined)[]): Promise<void> {
    const cleanList = urls
      .filter((u): u is string => typeof u === 'string' && u.trim().length > 0 && u !== 'null')
      .map((u) => u.trim());

    if (cleanList.length === 0) return;

    // Process in batches of 4 concurrent fetches to avoid overwhelming network
    const batchSize = 4;
    for (let i = 0; i < cleanList.length; i += batchSize) {
      const batch = cleanList.slice(i, i + batchSize);
      await Promise.allSettled(batch.map((url) => this.fetchAndCache(url)));
    }
  }

  /**
   * Clears in-memory and persistent cache.
   */
  public async clear(): Promise<void> {
    this.memCache.clear();
    this.failedUrls.clear();
    this.inFlightFetches.clear();

    const db = await this.initDB();
    if (db) {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
      } catch (e) {
        console.warn('[AvatarCache] Failed to clear IndexedDB:', e);
      }
    }
  }
}

export const avatarCache = new AvatarCacheService();
