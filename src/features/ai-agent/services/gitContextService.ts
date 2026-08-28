import { GitService } from '../../../services/git/gitService';
import { GitRepoContext, AgentAttachment } from '../types';

export class GitContextService {
  /**
   * Builds a structured summary of the current Git repository state.
   */
  static async collectRepoContext(repoPath: string): Promise<GitRepoContext> {
    const repoName = repoPath.split(/[/\\]/).filter(Boolean).pop() || 'Repository';

    let currentBranch = 'main';
    let ahead = 0;
    let behind = 0;
    let dirtyFilesCount = 0;
    const stagedFiles: string[] = [];
    const unstagedFiles: string[] = [];
    const recentCommits: GitRepoContext['recentCommits'] = [];

    try {
      const status = await GitService.getRepoStatus(repoPath);
      currentBranch = status.current_branch || 'main';
      ahead = status.ahead || 0;
      behind = status.behind || 0;
      dirtyFilesCount = status.files?.length || 0;

      if (status.files) {
        for (const file of status.files) {
          if (file.staged) {
            stagedFiles.push(`${file.status.toUpperCase()} ${file.path}`);
          } else {
            unstagedFiles.push(`${file.status.toUpperCase()} ${file.path}`);
          }
        }
      }
    } catch {
      // Gracefully handle partial read errors
    }

    try {
      const commits = await GitService.getCommitHistory(repoPath, 8);
      if (Array.isArray(commits)) {
        for (const c of commits) {
          recentCommits.push({
            hash: c.short_sha || (c.sha ? c.sha.slice(0, 7) : '—'),
            author: c.author_name || 'Unknown',
            message: c.message ? c.message.split('\n')[0] : '—',
            time: c.relative_date || (c.timestamp ? new Date(c.timestamp * 1000).toLocaleDateString() : ''),
          });
        }
      }
    } catch {
      // Gracefully handle history read errors
    }

    return {
      repoPath,
      repoName,
      currentBranch,
      ahead,
      behind,
      dirtyFilesCount,
      stagedFiles,
      unstagedFiles,
      recentCommits,
    };
  }

  /**
   * Fetches the current working directory diff (staged and unstaged) as an attachment.
   */
  static async getDiffAttachment(repoPath: string, stagedOnly = false): Promise<AgentAttachment> {
    try {
      const status = await GitService.getRepoStatus(repoPath);
      const filesToDiff = (status.files || []).filter((f) => (stagedOnly ? f.staged : true));

      if (filesToDiff.length === 0) {
        return {
          id: `diff-${Date.now()}`,
          type: 'diff',
          title: stagedOnly ? 'Staged Git Diff' : 'Working Tree Git Diff',
          content: 'No diff changes detected in repository (clean working tree).',
        };
      }

      // Collect diffs for up to 8 files
      const diffSnippets: string[] = [];
      for (const file of filesToDiff.slice(0, 8)) {
        try {
          const fileDiff = await GitService.getFileDiff(repoPath, file.path, file.staged);
          if (fileDiff && fileDiff.lines && fileDiff.lines.length > 0) {
            const patchText = fileDiff.lines
              .map((l) => `${l.line_type === 'addition' ? '+' : l.line_type === 'deletion' ? '-' : ' '} ${l.content}`)
              .join('\n');
            diffSnippets.push(`--- a/${file.path}\n+++ b/${file.path}\n${patchText}`);
          }
        } catch {}
      }

      const combinedDiff = diffSnippets.join('\n\n') || 'No textual changes detected in selected files.';
      const truncated =
        combinedDiff.length > 20000
          ? `${combinedDiff.slice(0, 20000)}\n\n...[Diff truncated for context limits]...`
          : combinedDiff;

      return {
        id: `diff-${Date.now()}`,
        type: 'diff',
        title: stagedOnly ? 'Staged Git Diff' : 'Working Tree Git Diff',
        content: truncated,
        meta: { filesCount: filesToDiff.length },
      };
    } catch (err) {
      return {
        id: `diff-error-${Date.now()}`,
        type: 'diff',
        title: 'Git Diff Error',
        content: `Failed to read git diff: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Formats repo context into a clean markdown prompt prefix for the system instruction.
   */
  static formatContextForPrompt(ctx: GitRepoContext): string {
    return [
      `### Active Repository Information:`,
      `- **Repository Name:** \`${ctx.repoName}\``,
      `- **Directory Path:** \`${ctx.repoPath}\``,
      `- **Current Branch:** \`${ctx.currentBranch}\` (Ahead: ${ctx.ahead}, Behind: ${ctx.behind})`,
      `- **Uncommitted Changes:** ${ctx.dirtyFilesCount} modified/untracked files`,
      ctx.stagedFiles.length > 0
        ? `- **Staged Files (${ctx.stagedFiles.length}):**\n  ${ctx.stagedFiles.slice(0, 20).map((f) => `\`${f}\``).join(', ')}`
        : '- **Staged Files:** (none)',
      ctx.unstagedFiles.length > 0
        ? `- **Unstaged Changes (${ctx.unstagedFiles.length}):**\n  ${ctx.unstagedFiles.slice(0, 20).map((f) => `\`${f}\``).join(', ')}`
        : '- **Unstaged Changes:** (clean)',
      ctx.recentCommits.length > 0
        ? `- **Recent Commits:**\n` +
          ctx.recentCommits
            .map((c) => `  - \`${c.hash}\` ${c.message} (${c.author})`)
            .join('\n')
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
}
