export interface TerminalSessionInfo {
  repo_id: string;
  session_id: string;
  is_alive: boolean;
  pid?: number;
}

export interface HistoryEntry {
  cmd: string;
  at: string;
  exit_code?: number | null;
}

export interface LogSessionSummary {
  session_id: string;
  repo_id: string;
  date: string;
  command_count: number;
  size_bytes: number;
  duration_secs?: number;
}

export type AutocompleteKind =
  | 'command'
  | 'subcommand'
  | 'flag'
  | 'branch'
  | 'remote'
  | 'file'
  | 'stash'
  | 'tag';

export interface AutocompleteSuggestion {
  text: string;
  value: string;
  description?: string;
  kind: AutocompleteKind;
}

export interface ParsedCommandLog {
  id: string;
  command: string;
  timestamp?: string;
  exitCode?: number;
  output: string;
}
