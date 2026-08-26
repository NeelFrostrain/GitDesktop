import { invoke } from '@tauri-apps/api/core';
import { ReleaseInfo, AiReleaseNotesResult } from '../../types/git';

/**
 * Service for managing repository releases and annotated release markers.
 */
export class ReleaseService {
  /**
   * Generates AI-powered release notes comparing commits between new tag and previous tag.
   */
  static async generateAiReleaseNotes(
    repoPath: string,
    targetTag: string,
    previousTag?: string | null,
    targetBranch?: string | null,
    customApiKey?: string | null,
    model?: string | null
  ): Promise<AiReleaseNotesResult> {
    return invoke<AiReleaseNotesResult>('generate_ai_release_notes_cmd', {
      repoPath,
      targetTag,
      previousTag: previousTag || null,
      targetBranch: targetBranch || null,
      customApiKey: customApiKey || null,
      model: model || null,
    });
  }

  /**
   * Lists all releases and release tags in the repository.
   */
  static async listReleases(repoPath: string): Promise<ReleaseInfo[]> {
    return invoke<ReleaseInfo[]>('list_releases_cmd', { repoPath });
  }

  /**
   * Creates a new release and associated annotated tag.
   */
  static async createRelease(
    repoPath: string,
    tagName: string,
    name: string,
    description: string,
    targetRef?: string | null,
    pushImmediately = true,
    remote?: string | null,
    isLatest?: boolean,
    isPrerelease?: boolean,
    filePaths?: string[]
  ): Promise<ReleaseInfo> {
    return invoke<ReleaseInfo>('create_release_cmd', {
      repoPath,
      tagName,
      name,
      description,
      targetRef: targetRef || null,
      pushImmediately,
      remote: remote || null,
      isLatest: isLatest ?? null,
      isPrerelease: isPrerelease ?? null,
      filePaths: filePaths && filePaths.length > 0 ? filePaths : null,
    });
  }

  /**
   * Updates an existing release title and changelog notes.
   */
  static async updateRelease(
    repoPath: string,
    tagName: string,
    name: string,
    description: string,
    pushImmediately = true,
    remote?: string | null,
    isLatest?: boolean,
    isPrerelease?: boolean,
    filePaths?: string[]
  ): Promise<ReleaseInfo> {
    return invoke<ReleaseInfo>('update_release_cmd', {
      repoPath,
      tagName,
      name,
      description,
      pushImmediately,
      remote: remote || null,
      isLatest: isLatest ?? null,
      isPrerelease: isPrerelease ?? null,
      filePaths: filePaths && filePaths.length > 0 ? filePaths : null,
    });
  }

  /**
   * Deletes a release and optionally removes the associated local and remote tags.
   */
  static async deleteRelease(
    repoPath: string,
    tagName: string,
    deleteTag = true,
    remote?: string | null
  ): Promise<void> {
    return invoke('delete_release_cmd', {
      repoPath,
      tagName,
      deleteTag,
      remote: remote || null,
    });
  }
}
