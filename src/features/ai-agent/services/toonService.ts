/**
 * TOON (Token-Oriented Object Notation) Encoder & Optimizer
 * Reference: https://github.com/toon-format/toon
 *
 * Designed to serialize structured data (tables, objects, lists, Git context, terminal logs)
 * into minimal tokens for LLM system instructions and prompt context.
 * Provides ~40-70% token savings compared to JSON and verbose Markdown.
 */

import { GitRepoContext, AgentAttachment } from '../types';

/**
 * Escapes a TOON cell value if it contains commas, newlines, or colons.
 */
export function escapeToonValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);

  const str = String(val).trim();
  if (str.length === 0) return '';

  // If string contains newlines, quotes, or commas, sanitize or escape
  if (str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`;
  }
  if (str.includes(',') || str.startsWith('"') || str.endsWith('"')) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return str;
}

/**
 * Generic TOON encoder for arbitrary objects, arrays, and primitive values.
 */
export function encodeToon(data: unknown, indentLevel = 0): string {
  const indent = '  '.repeat(indentLevel);

  if (data === null || data === undefined) return '';
  if (typeof data !== 'object') {
    return `${indent}${escapeToonValue(data)}`;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return `${indent}[0]:`;

    // Check if array is a uniform list of objects (Table format)
    const isUniformObjectArray =
      data.length > 0 &&
      data.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item));

    if (isUniformObjectArray) {
      // Collect unique keys across all objects
      const allKeys = Array.from(
        new Set(data.flatMap((item) => Object.keys(item as Record<string, unknown>)))
      );

      if (allKeys.length > 0) {
        const header = `${indent}[${data.length}]{${allKeys.join(',')}}:`;
        const rows = data.map((item) => {
          const rec = item as Record<string, unknown>;
          const values = allKeys.map((k) => escapeToonValue(rec[k]));
          return `${indent}  ${values.join(',')}`;
        });
        return [header, ...rows].join('\n');
      }
    }

    // Array of primitives
    const isPrimitiveArray = data.every((item) => typeof item !== 'object' || item === null);
    if (isPrimitiveArray) {
      const primitiveLine = data.map(escapeToonValue).join(', ');
      if (primitiveLine.length < 80 && !primitiveLine.includes('\n')) {
        return `${indent}[${data.length}]: ${primitiveLine}`;
      }
      return [
        `${indent}[${data.length}]:`,
        ...data.map((item) => `${indent}  ${escapeToonValue(item)}`),
      ].join('\n');
    }

    // Mixed array fallback
    return [
      `${indent}[${data.length}]:`,
      ...data.map((item) => encodeToon(item, indentLevel + 1)),
    ].join('\n');
  }

  // Generic Object key-value pairs
  const obj = data as Record<string, unknown>;
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;

    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${indent}${key}[0]:`);
        } else {
          const isUniformObjectArray = value.every(
            (item) => item !== null && typeof item === 'object' && !Array.isArray(item)
          );
          if (isUniformObjectArray) {
            const allKeys = Array.from(
              new Set(value.flatMap((item) => Object.keys(item as Record<string, unknown>)))
            );
            lines.push(`${indent}${key}[${value.length}]{${allKeys.join(',')}}:`);
            for (const item of value) {
              const rec = item as Record<string, unknown>;
              const values = allKeys.map((k) => escapeToonValue(rec[k]));
              lines.push(`${indent}  ${values.join(',')}`);
            }
          } else {
            const isPrimitiveArray = value.every(
              (item) => typeof item !== 'object' || item === null
            );
            if (isPrimitiveArray) {
              const line = value.map(escapeToonValue).join(', ');
              if (line.length < 80 && !line.includes('\n')) {
                lines.push(`${indent}${key}[${value.length}]: ${line}`);
              } else {
                lines.push(`${indent}${key}[${value.length}]:`);
                for (const item of value) {
                  lines.push(`${indent}  ${escapeToonValue(item)}`);
                }
              }
            } else {
              lines.push(`${indent}${key}[${value.length}]:`);
              for (const item of value) {
                lines.push(encodeToon(item, indentLevel + 1));
              }
            }
          }
        }
      } else {
        lines.push(`${indent}${key}:`);
        lines.push(encodeToon(value, indentLevel + 1));
      }
    } else {
      lines.push(`${indent}${key}: ${escapeToonValue(value)}`);
    }
  }

  return lines.join('\n');
}

export class ToonService {
  /**
   * Encodes Git Repository Context into an ultra-compact TOON string for LLM prompts.
   */
  static encodeGitContext(ctx: GitRepoContext): string {
    const lines: string[] = ['git_context:toon'];

    lines.push(`repo: ${escapeToonValue(ctx.repoName)}`);
    lines.push(`path: ${escapeToonValue(ctx.repoPath)}`);
    lines.push(
      `branch: ${escapeToonValue(ctx.currentBranch)} (ahead: ${ctx.ahead}, behind: ${ctx.behind})`
    );
    lines.push(`dirty_count: ${ctx.dirtyFilesCount}`);

    // Staged files table
    if (ctx.stagedFiles && ctx.stagedFiles.length > 0) {
      lines.push(`staged[${ctx.stagedFiles.length}]{status,path}:`);
      for (const f of ctx.stagedFiles.slice(0, 30)) {
        const parts = f.split(' ');
        const status = parts[0] || 'M';
        const filePath = parts.slice(1).join(' ');
        lines.push(`  ${escapeToonValue(status)},${escapeToonValue(filePath)}`);
      }
    } else {
      lines.push(`staged[0]:`);
    }

    // Unstaged files table
    if (ctx.unstagedFiles && ctx.unstagedFiles.length > 0) {
      lines.push(`unstaged[${ctx.unstagedFiles.length}]{status,path}:`);
      for (const f of ctx.unstagedFiles.slice(0, 30)) {
        const parts = f.split(' ');
        const status = parts[0] || 'M';
        const filePath = parts.slice(1).join(' ');
        lines.push(`  ${escapeToonValue(status)},${escapeToonValue(filePath)}`);
      }
    } else {
      lines.push(`unstaged[0]:`);
    }

    // Recent Commits table
    if (ctx.recentCommits && ctx.recentCommits.length > 0) {
      lines.push(`commits[${ctx.recentCommits.length}]{hash,time,author,message}:`);
      for (const c of ctx.recentCommits.slice(0, 10)) {
        lines.push(
          `  ${escapeToonValue(c.hash)},${escapeToonValue(c.time)},${escapeToonValue(c.author)},${escapeToonValue(c.message)}`
        );
      }
    } else {
      lines.push(`commits[0]:`);
    }

    return lines.join('\n');
  }

  /**
   * Encodes terminal command executions, outputs, or error logs into compact TOON notation.
   */
  static encodeTerminalContext(options: {
    command?: string;
    output?: string;
    exitCode?: number;
    cwd?: string;
  }): string {
    const { command = '', output = '', exitCode = 0, cwd = '' } = options;
    const lines: string[] = ['terminal:toon'];

    if (cwd) lines.push(`cwd: ${escapeToonValue(cwd)}`);
    if (command) lines.push(`cmd: ${escapeToonValue(command)}`);
    lines.push(`exit_code: ${exitCode}`);

    const cleanedOutput = output.trim();
    if (cleanedOutput) {
      const outputLines = cleanedOutput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      lines.push(`output[${outputLines.length}]:`);
      for (const line of outputLines.slice(0, 50)) {
        lines.push(`  ${escapeToonValue(line)}`);
      }
      if (outputLines.length > 50) {
        lines.push(`  ...[truncated ${outputLines.length - 50} lines]`);
      }
    } else {
      lines.push(`output[0]:`);
    }

    return lines.join('\n');
  }

  /**
   * Optimizes prompt attachments into TOON representation.
   */
  static formatAttachmentForPrompt(attachment: AgentAttachment): string {
    if (attachment.type === 'diff') {
      return `[ATTACHMENT: ${attachment.title} | format:toon-diff]\n${attachment.content}\n[/ATTACHMENT]`;
    }

    if (attachment.type === 'terminal') {
      return `[ATTACHMENT: ${attachment.title} | format:toon]\n${attachment.content}\n[/ATTACHMENT]`;
    }

    return `[ATTACHMENT: ${attachment.title}]\n${attachment.content}\n[/ATTACHMENT]`;
  }

  /**
   * Compresses user prompt or terminal inquiry to minimize unnecessary tokens.
   */
  static optimizePromptTokens(prompt: string): string {
    return prompt.trim().replace(/[ \t]+/g, ' ');
  }
}
