import { describe, it, expect } from 'vitest';
import { stripAnsi, parseSessionLog } from './lib/ansiParser';
import { GIT_COMMAND_TREE } from './lib/gitCommandTree';

describe('ansiParser', () => {
  it('strips ANSI color and control codes correctly', () => {
    const raw = '\x1b[31mError:\x1b[0m \x1b[1mFile not found\x1b[0m\r\n';
    expect(stripAnsi(raw)).toBe('Error: File not found\r\n');
  });

  it('parses raw session log into structured command blocks', () => {
    const rawTranscript = `=== GIT DESKTOP TERMINAL SESSION ===
Repo: E:/Projects/demo
Session ID: 20260815_150000
Started: 2026-08-15T15:00:00Z
====================================

PS E:\\Projects\\demo> git status
On branch main
nothing to commit, working tree clean

PS E:\\Projects\\demo> git branch
* main
  feature-terminal
`;

    const parsed = parseSessionLog(rawTranscript);
    expect(parsed.length).toBe(2);
    expect(parsed[0].command).toBe('git status');
    expect(parsed[0].output).toContain('On branch main');
    expect(parsed[1].command).toBe('git branch');
    expect(parsed[1].output).toContain('feature-terminal');
  });
});

describe('gitCommandTree', () => {
  it('contains core Git commands with flags and descriptions', () => {
    expect(GIT_COMMAND_TREE.status).toBeDefined();
    expect(GIT_COMMAND_TREE.commit).toBeDefined();
    expect(GIT_COMMAND_TREE.checkout).toBeDefined();
    expect(GIT_COMMAND_TREE.push).toBeDefined();
    expect(GIT_COMMAND_TREE.stash).toBeDefined();

    const commitFlags = GIT_COMMAND_TREE.commit.flags.map((f) => f.flag);
    expect(commitFlags).toContain('-m');
    expect(commitFlags).toContain('--amend');

    const stashSubcommands = GIT_COMMAND_TREE.stash.subcommands;
    expect(stashSubcommands).toContain('pop');
    expect(stashSubcommands).toContain('apply');
  });
});
