import { describe, it, expect, beforeEach } from 'vitest';
import { useAiAgentStore } from './store/useAiAgentStore';
import { GitContextService } from './services/gitContextService';
import { GeminiAgentService } from './services/geminiAgentService';
import { ToonService, encodeToon } from './services/toonService';

describe('AI Git Agent Store & Services', () => {
  beforeEach(() => {
    localStorage.clear();
    useAiAgentStore.setState({
      isOpen: false,
      status: 'idle',
      error: null,
      sessions: [],
      activeSessionId: null,
      pendingAttachments: [],
    });
  });

  it('initializes with default state and can toggle panel visibility', () => {
    const store = useAiAgentStore.getState();
    expect(store.isOpen).toBe(false);

    store.toggleIsOpen();
    expect(useAiAgentStore.getState().isOpen).toBe(true);

    store.setIsOpen(false);
    expect(useAiAgentStore.getState().isOpen).toBe(false);
  });

  it('creates, selects, and deletes chat sessions with persistence', () => {
    const store = useAiAgentStore.getState();

    const sessionId1 = store.createSession('/repo/alpha');
    expect(useAiAgentStore.getState().sessions.length).toBe(1);
    expect(useAiAgentStore.getState().activeSessionId).toBe(sessionId1);

    const sessionId2 = store.createSession('/repo/beta');
    expect(useAiAgentStore.getState().sessions.length).toBe(2);
    expect(useAiAgentStore.getState().activeSessionId).toBe(sessionId2);

    store.selectSession(sessionId1);
    expect(useAiAgentStore.getState().activeSessionId).toBe(sessionId1);

    store.deleteSession(sessionId1);
    expect(useAiAgentStore.getState().sessions.length).toBe(1);
    expect(useAiAgentStore.getState().activeSessionId).toBe(sessionId2);
  });

  it('manages context attachments properly', () => {
    const store = useAiAgentStore.getState();

    store.addAttachment({
      id: 'att-1',
      type: 'diff',
      title: 'Working Tree Diff',
      content: '+ added line',
    });

    expect(useAiAgentStore.getState().pendingAttachments.length).toBe(1);

    store.removeAttachment('att-1');
    expect(useAiAgentStore.getState().pendingAttachments.length).toBe(0);
  });

  it('encodes data and arrays into compact TOON format', () => {
    const tableData = [
      { id: '1', name: 'Alpha', status: 'open' },
      { id: '2', name: 'Beta', status: 'closed' },
    ];

    const encoded = encodeToon(tableData);
    expect(encoded).toContain('[2]{id,name,status}:');
    expect(encoded).toContain('1,Alpha,open');
    expect(encoded).toContain('2,Beta,closed');
  });

  it('formats git repo context into compact TOON prompt correctly', () => {
    const mockContext = {
      repoPath: 'E:/Projects/sample',
      repoName: 'sample',
      currentBranch: 'feature-ai',
      ahead: 1,
      behind: 0,
      dirtyFilesCount: 2,
      stagedFiles: ['MODIFIED src/App.tsx'],
      unstagedFiles: ['UNTRACKED README.md'],
      recentCommits: [
        {
          hash: 'a1b2c3d',
          author: 'Alice',
          message: 'feat: initial setup',
          time: '8/28/2026',
        },
      ],
    };

    const formatted = GitContextService.formatContextForPrompt(mockContext);
    expect(formatted).toContain('git_context:toon');
    expect(formatted).toContain('repo: sample');
    expect(formatted).toContain('branch: feature-ai (ahead: 1, behind: 0)');
    expect(formatted).toContain('staged[1]{status,path}:');
    expect(formatted).toContain('MODIFIED,src/App.tsx');
    expect(formatted).toContain('commits[1]{hash,time,author,message}:');
    expect(formatted).toContain('a1b2c3d,8/28/2026,Alice,feat: initial setup');
  });

  it('encodes terminal outputs and logs into TOON notation', () => {
    const termToon = ToonService.encodeTerminalContext({
      cwd: 'E:/Projects/gitlab-desktop',
      command: 'git status',
      exitCode: 0,
      output: 'On branch dev\nnothing to commit',
    });

    expect(termToon).toContain('terminal:toon');
    expect(termToon).toContain('cmd: git status');
    expect(termToon).toContain('exit_code: 0');
    expect(termToon).toContain('output[2]:');
    expect(termToon).toContain('On branch dev');
  });

  it('correctly extracts file write and file delete tool calls from model output', () => {
    const modelOutput = `
Here are the changes you requested:

[FILE_WRITE: src/utils/formatter.ts]
\`\`\`typescript
export function formatName(name: string) {
  return name.trim();
}
\`\`\`
[/FILE_WRITE]

And we can clean up the deprecated helper:
[FILE_DELETE: src/utils/oldHelper.ts]

Finally, test the build:
\`\`\`bash
npm run build
\`\`\`
`;

    // Access the private extractToolCalls via any cast or service method
    const tools = (GeminiAgentService as any).extractToolCalls(modelOutput);
    expect(tools.length).toBe(3);

    expect(tools[0].name).toBe('write_file');
    expect(tools[0].filePath).toBe('src/utils/formatter.ts');
    expect(tools[0].fileContent).toContain('export function formatName');

    expect(tools[1].name).toBe('delete_file');
    expect(tools[1].filePath).toBe('src/utils/oldHelper.ts');

    expect(tools[2].name).toBe('run_command');
    expect(tools[2].command).toBe('npm run build');
  });

  it('updates and persists agent security mode correctly', () => {
    const store = useAiAgentStore.getState();
    expect(useAiAgentStore.getState().securityMode).toBe('strict');

    store.setSecurityMode('sandboxed');
    expect(useAiAgentStore.getState().securityMode).toBe('sandboxed');
    expect(localStorage.getItem('ai_agent_security_mode')).toBe('sandboxed');

    store.setSecurityMode('full_access');
    expect(useAiAgentStore.getState().securityMode).toBe('full_access');
    expect(localStorage.getItem('ai_agent_security_mode')).toBe('full_access');
  });
});
