export type LogLevel = 'Debug' | 'Info' | 'Success' | 'Warn' | 'Error';

export type LogCategory =
  | 'Git'
  | 'Account'
  | 'Remote'
  | 'Signing'
  | 'Activity'
  | 'Repo'
  | 'Terminal'
  | 'App';

export interface LogEntry {
  id: string;
  at: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  repo_id?: string;
  metadata?: Record<string, any>;
}

export interface LogFilter {
  categories?: LogCategory[];
  levels?: LogLevel[];
  repo_id?: string;
  search?: string;
  this_repo_only?: boolean;
}
