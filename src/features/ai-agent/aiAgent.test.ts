import { describe, it, expect, beforeEach } from 'vitest';
import { useAiAgentStore } from './store/useAiAgentStore';
import { GitContextService } from './services/gitContextService';

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

  it('formats git repo context into markdown prompt correctly', () => {
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
    expect(formatted).toContain('`sample`');
    expect(formatted).toContain('`feature-ai`');
    expect(formatted).toContain('MODIFIED src/App.tsx');
    expect(formatted).toContain('feat: initial setup');
  });
});
