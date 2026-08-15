import { LogLevel } from './types';

/**
 * Color mapping for LogLevels.
 * IMPORTANT: This map is used ONLY by terminal rendering paths
 * (features/terminal/hooks/useRepoTerminal.ts and the Terminal Panel's 'App Log' tab).
 * LogViewer and other UI components outside the terminal must use neutral styling.
 */
export const LOG_LEVEL_TERMINAL_COLOR: Record<LogLevel, string> = {
  Debug: '#6b7280', // gray
  Info: '#60a5fa', // blue
  Success: '#4ade80', // green
  Warn: '#facc15', // yellow
  Error: '#f87171', // red
};

export const LOG_LEVEL_TERMINAL_TAG: Record<LogLevel, string> = {
  Debug: 'DEBUG',
  Info: 'INFO',
  Success: 'SUCCESS',
  Warn: 'WARN',
  Error: 'ERROR',
};
