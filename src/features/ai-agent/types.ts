export type AgentRole = 'user' | 'assistant' | 'system';

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'error';

export type AgentSecurityMode = 'strict' | 'sandboxed' | 'full_access';

export interface AgentToolCall {
  id: string;
  name:
    | 'run_command'
    | 'write_file'
    | 'create_file'
    | 'edit_file'
    | 'delete_file'
    | 'read_file'
    | string;
  command?: string;
  filePath?: string;
  fileContent?: string;
  args?: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'failed' | 'rejected';
  output?: string;
  error?: string;
  executedAt?: number;
}

export interface AgentAttachment {
  id: string;
  type: 'diff' | 'status' | 'log' | 'branches' | 'file' | 'terminal';
  title: string;
  content: string;
  meta?: Record<string, unknown>;
}

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  timestamp: number;
  attachments?: AgentAttachment[];
  toolCalls?: AgentToolCall[];
  error?: string;
  modelUsed?: string;
}

export interface AgentSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  repoPath?: string;
  messages: AgentMessage[];
}

export interface GitRepoContext {
  repoPath: string;
  repoName: string;
  currentBranch: string;
  upstreamBranch?: string;
  ahead: number;
  behind: number;
  dirtyFilesCount: number;
  stagedFiles: string[];
  unstagedFiles: string[];
  recentCommits: Array<{
    hash: string;
    author: string;
    message: string;
    time: string;
  }>;
  diffSummary?: string;
}
