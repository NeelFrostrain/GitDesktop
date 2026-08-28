import { create } from 'zustand';
import {
  AgentSession,
  AgentMessage,
  AgentStatus,
  AgentAttachment,
  AgentToolCall,
  AgentSecurityMode,
} from '../types';
import { GeminiAgentService } from '../services/geminiAgentService';
import { GitContextService } from '../services/gitContextService';
import { useSettingsStore } from '../../settings';
import { useGitStore } from '../../../store/useGitStore';
import { useTerminalStore } from '../../terminal/store/terminalStore';
import { ptyBridge } from '../../terminal/lib/ptyBridge';
import { listen } from '@tauri-apps/api/event';
import { useToastStore } from '../../../store/useToastStore';
import { useLogStore } from '../../../store/useLogStore';
import { SystemService } from '../../../services/system/systemService';
import { GitService } from '../../../services/git/gitService';

interface AiAgentState {
  isOpen: boolean;
  status: AgentStatus;
  securityMode: AgentSecurityMode;
  error: string | null;
  sessions: AgentSession[];
  activeSessionId: string | null;
  pendingAttachments: AgentAttachment[];

  // Panel View Actions
  setIsOpen: (isOpen: boolean) => void;
  toggleIsOpen: () => void;
  setSecurityMode: (mode: AgentSecurityMode) => void;

  // Session Actions
  createSession: (repoPath?: string) => string;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  clearActiveSession: () => void;

  // Attachment Actions
  addAttachment: (attachment: AgentAttachment) => void;
  removeAttachment: (attachmentId: string) => void;
  clearAttachments: () => void;
  attachWorkingDiff: () => Promise<void>;

  // Messaging & Execution
  sendMessage: (content: string) => Promise<void>;
  regenerateMessage: (assistantMsgId: string) => Promise<void>;
  executeToolCall: (toolCallId: string, runInTerminal?: boolean) => Promise<void>;
  rejectToolCall: (toolCallId: string) => void;
}

const SESSIONS_STORAGE_KEY = 'git_ai_agent_sessions_v1';
const ACTIVE_SESSION_STORAGE_KEY = 'git_ai_agent_active_session_v1';

const loadStoredSessions = (): AgentSession[] => {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredSessions = (sessions: AgentSession[], activeId: string | null) => {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    if (activeId) {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeId);
    }
  } catch {}
};

const initialSessions = loadStoredSessions();
let initialActiveId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);

if (!initialActiveId || !initialSessions.some((s) => s.id === initialActiveId)) {
  initialActiveId = initialSessions[0]?.id || null;
}

export const useAiAgentStore = create<AiAgentState>((set, get) => ({
  isOpen: false,
  status: 'idle',
  securityMode:
    (localStorage.getItem('ai_agent_security_mode') as AgentSecurityMode) || 'strict',
  error: null,
  sessions: initialSessions,
  activeSessionId: initialActiveId,
  pendingAttachments: [],

  setIsOpen: (isOpen) => set({ isOpen }),
  toggleIsOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setSecurityMode: (mode) => {
    try {
      localStorage.setItem('ai_agent_security_mode', mode);
    } catch {}
    set({ securityMode: mode });
  },

  createSession: (repoPath) => {
    const uniqueId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newSession: AgentSession = {
      id: uniqueId,
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      repoPath: repoPath || useGitStore.getState().activeRepoPath || undefined,
      messages: [
        {
          id: `msg-welcome-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content:
            "👋 **Hello! I'm your AI Git Agent.**\n\nI can inspect your repository changes, explain complex diffs, write commit messages, resolve merge conflicts, and execute Git operations on your integrated terminal.\n\nHow can I help with your repository today?",
          timestamp: Date.now(),
        },
      ],
    };

    set((state) => {
      const updated = [newSession, ...state.sessions];
      saveStoredSessions(updated, newSession.id);
      return {
        sessions: updated,
        activeSessionId: newSession.id,
        pendingAttachments: [],
        error: null,
      };
    });

    return newSession.id;
  },

  selectSession: (sessionId) => {
    set({ activeSessionId: sessionId, error: null });
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
  },

  deleteSession: (sessionId) => {
    set((state) => {
      const updated = state.sessions.filter((s) => s.id !== sessionId);
      const nextActiveId =
        state.activeSessionId === sessionId
          ? updated[0]?.id || null
          : state.activeSessionId;
      saveStoredSessions(updated, nextActiveId);
      return {
        sessions: updated,
        activeSessionId: nextActiveId,
      };
    });
  },

  clearActiveSession: () => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;

    set((state) => {
      const updated: AgentSession[] = state.sessions.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: Date.now(),
            messages: [
              {
                id: `msg-cleared-${Date.now()}`,
                role: 'assistant' as const,
                content: 'Chat session cleared. How can I help you next?',
                timestamp: Date.now(),
              },
            ],
          };
        }
        return s;
      });
      saveStoredSessions(updated, activeSessionId);
      return { sessions: updated, pendingAttachments: [], error: null };
    });
  },

  addAttachment: (attachment) => {
    set((state) => ({
      pendingAttachments: [...state.pendingAttachments, attachment],
    }));
  },

  removeAttachment: (attachmentId) => {
    set((state) => ({
      pendingAttachments: state.pendingAttachments.filter((a) => a.id !== attachmentId),
    }));
  },

  clearAttachments: () => set({ pendingAttachments: [] }),

  attachWorkingDiff: async () => {
    const activeRepo = useGitStore.getState().activeRepoPath;
    if (!activeRepo) {
      useToastStore.getState().showToast({
        type: 'warning',
        title: 'No Repository Open',
        message: 'Open a local repository first to attach its git diff.',
      });
      return;
    }

    const attachment = await GitContextService.getDiffAttachment(activeRepo, false);
    get().addAttachment(attachment);
    useToastStore.getState().showToast({
      type: 'info',
      title: 'Git Diff Attached',
      message: 'Attached working tree changes to prompt context.',
    });
  },

  sendMessage: async (content) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    let { activeSessionId, sessions } = get();

    // If no active session, create one
    if (!activeSessionId || !sessions.some((s) => s.id === activeSessionId)) {
      activeSessionId = get().createSession();
      sessions = get().sessions;
    }

    const activeRepo = useGitStore.getState().activeRepoPath;
    const attachments = [...get().pendingAttachments];

    const userMessage: AgentMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    // Update session state with user message immediately
    const updatedSessionsWithUser = sessions.map((s) => {
      if (s.id === activeSessionId) {
        // Auto-generate title if first message
        const isFirstUserMessage = s.messages.filter((m) => m.role === 'user').length === 0;
        const newTitle = isFirstUserMessage ? trimmed.slice(0, 32) : s.title;

        return {
          ...s,
          title: newTitle,
          updatedAt: Date.now(),
          messages: [...s.messages, userMessage],
        };
      }
      return s;
    });

    set({
      sessions: updatedSessionsWithUser,
      pendingAttachments: [],
      status: 'thinking',
      error: null,
    });
    saveStoredSessions(updatedSessionsWithUser, activeSessionId);

    // Retrieve settings
    const settingsStore = useSettingsStore.getState();
    const rawKeys =
      settingsStore.getEffectiveValue('ai.gemini_api_keys') ||
      settingsStore.getEffectiveValue('ai.google_api_keys');
    const activeKey = String(
      settingsStore.getEffectiveValue('ai.active_api_key') ||
        settingsStore.getEffectiveValue('ai.gemini_api_key') ||
        ''
    );
    const selectedModel = String(
      settingsStore.getEffectiveValue('ai.model') || 'gemini-2.5-flash-lite'
    );

    let keyPool: string[] = [];
    if (Array.isArray(rawKeys)) {
      keyPool = rawKeys.map(String).map((k) => k.trim()).filter(Boolean);
    } else if (typeof rawKeys === 'string' && rawKeys.trim()) {
      try {
        const parsed = JSON.parse(rawKeys);
        if (Array.isArray(parsed)) keyPool = parsed.map(String).map((k) => k.trim()).filter(Boolean);
        else keyPool = [rawKeys.trim()];
      } catch {
        keyPool = [rawKeys.trim()];
      }
    }

    if (activeKey.trim() && !keyPool.includes(activeKey.trim())) {
      keyPool.unshift(activeKey.trim());
    }

    // Collect Git Context
    let repoContextPrompt = '';
    if (activeRepo) {
      try {
        const ctx = await GitContextService.collectRepoContext(activeRepo);
        repoContextPrompt = GitContextService.formatContextForPrompt(ctx);
      } catch {}
    }

    // Get current session messages
    const currentSession = updatedSessionsWithUser.find((s) => s.id === activeSessionId);
    const historyMessages = currentSession ? currentSession.messages : [userMessage];

    try {
      const response = await GeminiAgentService.sendChatMessage({
        apiKeyPool: keyPool,
        activeApiKey: activeKey,
        model: selectedModel,
        messages: historyMessages,
        repoContextPrompt,
      });

      const assistantMessage: AgentMessage = {
        id: `msg-agent-${Date.now()}`,
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        toolCalls: response.toolCalls.length > 0 ? response.toolCalls : undefined,
        modelUsed: response.modelUsed,
      };

      set((state) => {
        const finalSessions = state.sessions.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              updatedAt: Date.now(),
              messages: [...s.messages, assistantMessage],
            };
          }
          return s;
        });

        saveStoredSessions(finalSessions, activeSessionId);
        return {
          sessions: finalSessions,
          status: 'idle',
          error: null,
        };
      });

      useLogStore.getState().addLog(
        'info',
        'System',
        `[AI-Agent] Agent responded using ${response.modelUsed} (${response.toolCalls.length} tool suggestions)`
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorAssistantMessage: AgentMessage = {
        id: `msg-error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Agent Error:** ${errorMsg}\n\n*Please ensure you have a valid Google Gemini API Key configured in Settings > AI.*`,
        timestamp: Date.now(),
        error: errorMsg,
      };

      set((state) => {
        const finalSessions = state.sessions.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              updatedAt: Date.now(),
              messages: [...s.messages, errorAssistantMessage],
            };
          }
          return s;
        });

        saveStoredSessions(finalSessions, activeSessionId);
        return {
          sessions: finalSessions,
          status: 'error',
          error: errorMsg,
        };
      });
    }
  },

  regenerateMessage: async (assistantMsgId: string) => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return;

    const currentSession = sessions.find((s) => s.id === activeSessionId);
    if (!currentSession) return;

    const msgIndex = currentSession.messages.findIndex((m) => m.id === assistantMsgId);
    if (msgIndex === -1) return;

    const historyBefore = currentSession.messages.slice(0, msgIndex);
    if (historyBefore.length === 0) return;

    set((state) => {
      const updated = state.sessions.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: Date.now(),
            messages: historyBefore,
          };
        }
        return s;
      });
      saveStoredSessions(updated, activeSessionId);
      return { sessions: updated, status: 'thinking', error: null };
    });

    const activeRepo = currentSession.repoPath || useGitStore.getState().activeRepoPath;

    const settings = useSettingsStore.getState();
    const rawKeys = settings.getEffectiveValue('ai.gemini_api_keys');
    const activeKey = String(settings.getEffectiveValue('ai.active_api_key') || '');
    const selectedModel = String(settings.getEffectiveValue('ai.model') || 'gemini-2.5-flash-lite');

    let keyPool: string[] = [];
    if (rawKeys) {
      try {
        const parsed = JSON.parse(rawKeys);
        if (Array.isArray(parsed)) keyPool = parsed.map(String).map((k) => k.trim()).filter(Boolean);
        else keyPool = [rawKeys.trim()];
      } catch {
        keyPool = [rawKeys.trim()];
      }
    }
    if (activeKey.trim() && !keyPool.includes(activeKey.trim())) {
      keyPool.unshift(activeKey.trim());
    }

    let repoContextPrompt = '';
    if (activeRepo) {
      try {
        const ctx = await GitContextService.collectRepoContext(activeRepo);
        repoContextPrompt = GitContextService.formatContextForPrompt(ctx);
      } catch {}
    }

    try {
      const response = await GeminiAgentService.sendChatMessage({
        apiKeyPool: keyPool,
        activeApiKey: activeKey,
        model: selectedModel,
        messages: historyBefore,
        repoContextPrompt,
      });

      const newAssistantMessage: AgentMessage = {
        id: `msg-agent-${Date.now()}`,
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        toolCalls: response.toolCalls.length > 0 ? response.toolCalls : undefined,
        modelUsed: response.modelUsed,
      };

      set((state) => {
        const finalSessions = state.sessions.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              updatedAt: Date.now(),
              messages: [...s.messages, newAssistantMessage],
            };
          }
          return s;
        });

        saveStoredSessions(finalSessions, activeSessionId);
        return {
          sessions: finalSessions,
          status: 'idle',
          error: null,
        };
      });

      // Automatic execution based on configured security mode
      const currentMode = get().securityMode;
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const tool of response.toolCalls) {
          if (currentMode === 'full_access') {
            // Full access: automatically execute tool operations
            setTimeout(() => {
              get().executeToolCall(tool.id, true);
            }, 300);
          } else if (currentMode === 'sandboxed') {
            // Sandboxed: auto-apply safe file creations/modifications; commands & deletes require confirmation
            if (
              tool.name === 'write_file' ||
              tool.name === 'create_file' ||
              tool.name === 'edit_file'
            ) {
              setTimeout(() => {
                get().executeToolCall(tool.id);
              }, 300);
            }
          }
          // Strict: requires review for all operations (waits for user to click button)
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorAssistantMessage: AgentMessage = {
        id: `msg-error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Agent Error:** ${errorMsg}\n\n*Please ensure you have a valid Google Gemini API Key configured in Settings > AI.*`,
        timestamp: Date.now(),
        error: errorMsg,
      };

      set((state) => {
        const finalSessions = state.sessions.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              updatedAt: Date.now(),
              messages: [...s.messages, errorAssistantMessage],
            };
          }
          return s;
        });

        saveStoredSessions(finalSessions, activeSessionId);
        return {
          sessions: finalSessions,
          status: 'error',
          error: errorMsg,
        };
      });
    }
  },

  executeToolCall: async (toolCallId, runInTerminal = true) => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return;

    const currentSession = sessions.find((s) => s.id === activeSessionId);
    if (!currentSession) return;

    let targetTool: AgentToolCall | null = null;
    let targetMsgId: string | null = null;

    for (const msg of currentSession.messages) {
      if (msg.toolCalls) {
        const found = msg.toolCalls.find((t) => t.id === toolCallId);
        if (found) {
          targetTool = found;
          targetMsgId = msg.id;
          break;
        }
      }
    }

    if (!targetTool) return;

    const activeRepo = useGitStore.getState().activeRepoPath;

    // Mark tool as executed immediately
    set((state) => {
      const updated: AgentSession[] = state.sessions.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: s.messages.map((m) => {
              if (m.id === targetMsgId && m.toolCalls) {
                return {
                  ...m,
                  toolCalls: m.toolCalls.map((t): AgentToolCall =>
                    t.id === toolCallId ? { ...t, status: 'success', executedAt: Date.now() } : t
                  ),
                };
              }
              return m;
            }),
          };
        }
        return s;
      });
      saveStoredSessions(updated, activeSessionId);
      return { sessions: updated };
    });

    // Case A: File Write / Create / Edit Tool
    if (
      (targetTool.name === 'write_file' ||
        targetTool.name === 'create_file' ||
        targetTool.name === 'edit_file') &&
      targetTool.filePath &&
      targetTool.fileContent !== undefined
    ) {
      if (!activeRepo) {
        useToastStore.getState().showToast({
          type: 'error',
          title: 'No Active Repository',
          message: 'Please open a repository to create or modify files.',
        });
        return;
      }

      try {
        await SystemService.saveFileContent(activeRepo, targetTool.filePath, targetTool.fileContent);
        // Refresh git status to reflect changed / created files
        const st = await GitService.getRepoStatus(activeRepo).catch(() => null);
        if (st) useGitStore.getState().setStatus(st);

        useToastStore.getState().showToast({
          type: 'success',
          title: 'File Saved',
          message: `Saved: ${targetTool.filePath}`,
        });

        // Automatically feed back confirmation to the AI Agent
        await get().sendMessage(
          `Applied file change: \`${targetTool.filePath}\` was saved to disk successfully.`
        );
      } catch (err) {
        useToastStore.getState().showToast({
          type: 'error',
          title: 'File Save Failed',
          message: String(err),
        });
      }
      return;
    }

    // Case B: File Delete Tool
    if (targetTool.name === 'delete_file' && targetTool.filePath) {
      if (!activeRepo) {
        useToastStore.getState().showToast({
          type: 'error',
          title: 'No Active Repository',
          message: 'Please open a repository to delete files.',
        });
        return;
      }

      try {
        await SystemService.deleteFile(activeRepo, targetTool.filePath);
        // Refresh git status to reflect deleted files
        const st = await GitService.getRepoStatus(activeRepo).catch(() => null);
        if (st) useGitStore.getState().setStatus(st);

        useToastStore.getState().showToast({
          type: 'success',
          title: 'File Deleted',
          message: `Deleted: ${targetTool.filePath}`,
        });

        // Automatically feed back confirmation to the AI Agent
        await get().sendMessage(
          `Deleted \`${targetTool.filePath}\` from the repository successfully.`
        );
      } catch (err) {
        useToastStore.getState().showToast({
          type: 'error',
          title: 'File Delete Failed',
          message: String(err),
        });
      }
      return;
    }

    // Case C: Run Command Tool
    if (targetTool.command && runInTerminal && activeRepo) {
      const command = targetTool.command.trim();

      // 1. Open Terminal Panel
      useTerminalStore.getState().setIsOpen(true);

      const safeRepoId = activeRepo.replace(/\\/g, '/').replace(/:/g, '_');
      let capturedOutput = '';
      let unlisten: (() => void) | null = null;

      try {
        unlisten = await listen<string>(`terminal:${safeRepoId}:data`, (event) => {
          if (event.payload) {
            capturedOutput += event.payload;
          }
        });
      } catch {}

      // 2. Dispatch command to active PTY terminal session with CRLF (\r\n) so Enter is pressed!
      try {
        await ptyBridge.write(activeRepo, `${command}\r\n`);
        useToastStore.getState().showToast({
          type: 'success',
          title: 'Executing in Terminal',
          message: `Sent: ${command.slice(0, 48)}`,
        });
      } catch (err) {
        useToastStore.getState().showToast({
          type: 'info',
          title: 'Terminal Dispatched',
          message: `Command sent to terminal: ${command}`,
        });
      }

      // 3. Wait for command output to stream in from the terminal
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (unlisten) {
        unlisten();
      }

      // 4. Clean up ANSI color codes and command echo
      let cleanOutput = capturedOutput
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
        .replace(/\x1b\].*?\x07/g, '')
        .replace(/\r/g, '')
        .trim();

      // If output starts with the command echo, strip it to keep output concise
      if (cleanOutput.startsWith(command)) {
        cleanOutput = cleanOutput.slice(command.length).trim();
      }

      // 5. Automatically feed the terminal response back to the AI Agent!
      const observationContent = cleanOutput
        ? `Output from \`${command}\` in terminal:\n\`\`\`\n${cleanOutput}\n\`\`\``
        : `Executed \`${command}\` in terminal successfully.`;

      // Trigger automatic AI response to this execution result
      await get().sendMessage(observationContent);
    }
  },

  rejectToolCall: (toolCallId) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;

    set((state) => {
      const updated: AgentSession[] = state.sessions.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: s.messages.map((m) => {
              if (m.toolCalls) {
                return {
                  ...m,
                  toolCalls: m.toolCalls.map((t): AgentToolCall =>
                    t.id === toolCallId ? { ...t, status: 'rejected' } : t
                  ),
                };
              }
              return m;
            }),
          };
        }
        return s;
      });
      saveStoredSessions(updated, activeSessionId);
      return { sessions: updated };
    });
  },
}));
