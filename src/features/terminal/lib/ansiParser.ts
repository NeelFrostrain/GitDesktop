import { ParsedCommandLog } from '../types';

/**
 * Strips ANSI escape sequences from terminal text.
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

/**
 * Parses raw terminal session log text into structured command blocks.
 */
export function parseSessionLog(rawContent: string): ParsedCommandLog[] {
  const clean = stripAnsi(rawContent).replace(/\r\n/g, '\n');
  const lines = clean.split('\n');
  const result: ParsedCommandLog[] = [];

  let currentCommand: string | null = null;
  let currentOutput: string[] = [];
  let currentTimestamp: string | undefined;
  let currentExitCode: number | undefined;

  const pushCurrent = () => {
    if (currentCommand !== null) {
      result.push({
        id: `cmd-${result.length}-${Date.now()}`,
        command: currentCommand.trim(),
        output: currentOutput.join('\n').trim(),
        timestamp: currentTimestamp,
        exitCode: currentExitCode,
      });
      currentCommand = null;
      currentOutput = [];
      currentTimestamp = undefined;
      currentExitCode = undefined;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for session header
    if (line.startsWith('=== GIT DESKTOP TERMINAL SESSION ===') || line.startsWith('Started:')) {
      if (line.startsWith('Started:')) {
        currentTimestamp = line.replace('Started:', '').trim();
      }
      continue;
    }
    if (
      line.startsWith('====================================') ||
      line.startsWith('Repo:') ||
      line.startsWith('Session ID:')
    ) {
      continue;
    }

    // Check for prompt patterns
    const isPowerShellPrompt = line.includes('PS ') && line.includes('>');
    const isBashPrompt = line.startsWith('$ ') || (line.includes(':') && line.includes('$ '));

    if (isPowerShellPrompt || isBashPrompt) {
      pushCurrent();
      if (isPowerShellPrompt) {
        const parts = line.split('>');
        currentCommand = parts.slice(1).join('>').trim();
      } else if (line.startsWith('$ ')) {
        currentCommand = line.substring(2).trim();
      } else {
        const parts = line.split('$ ');
        currentCommand = parts.slice(1).join('$ ').trim();
      }
      continue;
    }

    if (currentCommand !== null) {
      currentOutput.push(line);
    } else if (line.trim().length > 0) {
      // General output before first command
      currentOutput.push(line);
    }
  }

  pushCurrent();

  // If no prompts were detected (e.g. raw output only), return full output as single block
  if (result.length === 0 && clean.trim().length > 0) {
    result.push({
      id: `cmd-0-${Date.now()}`,
      command: 'Session Transcript',
      output: clean.trim(),
    });
  }

  return result;
}
