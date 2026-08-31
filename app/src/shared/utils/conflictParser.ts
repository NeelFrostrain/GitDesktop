export interface ConflictHunk {
  id: string;
  startLine: number;
  currentContent: string;
  currentLabel: string;
  incomingContent: string;
  incomingLabel: string;
  baseContent?: string;
  choice: 'ours' | 'theirs' | 'both-ours-first' | 'both-theirs-first' | 'custom' | null;
  customContent: string;
}

export type ConflictSegment =
  { type: 'plain'; content: string } | { type: 'conflict'; hunk: ConflictHunk };

export interface ParsedConflictFile {
  hasConflicts: boolean;
  totalHunks: number;
  resolvedHunks: number;
  segments: ConflictSegment[];
}

/**
 * Parses raw text containing Git conflict markers (<<<<<<<, =======, >>>>>>>).
 */
export function parseConflictMarkers(raw: string): ParsedConflictFile {
  const lines = raw.split(/\r?\n/);
  const segments: ConflictSegment[] = [];

  let inConflict = false;
  let inOurs = false;
  let inTheirs = false;

  let currentOurs: string[] = [];
  let currentTheirs: string[] = [];
  let currentLabel = 'HEAD (Current)';
  let incomingLabel = 'Incoming Change';
  let plainBuffer: string[] = [];
  let hunkCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('<<<<<<<')) {
      if (plainBuffer.length > 0) {
        segments.push({ type: 'plain', content: plainBuffer.join('\n') });
        plainBuffer = [];
      }
      inConflict = true;
      inOurs = true;
      inTheirs = false;
      currentOurs = [];
      currentTheirs = [];
      currentLabel = line.replace(/^<{7}\s*/, '').trim() || 'Current / Ours';
      continue;
    }

    if (inConflict && line.startsWith('=======')) {
      inOurs = false;
      inTheirs = true;
      continue;
    }

    if (inConflict && line.startsWith('>>>>>>>')) {
      incomingLabel = line.replace(/^>{7}\s*/, '').trim() || 'Incoming / Theirs';
      hunkCount++;

      const hunk: ConflictHunk = {
        id: `hunk-${hunkCount}`,
        startLine: i,
        currentContent: currentOurs.join('\n'),
        currentLabel,
        incomingContent: currentTheirs.join('\n'),
        incomingLabel,
        choice: null,
        customContent: '',
      };

      segments.push({ type: 'conflict', hunk });
      inConflict = false;
      inOurs = false;
      inTheirs = false;
      continue;
    }

    if (inConflict) {
      if (inOurs) {
        currentOurs.push(line);
      } else if (inTheirs) {
        currentTheirs.push(line);
      }
    } else {
      plainBuffer.push(line);
    }
  }

  if (plainBuffer.length > 0) {
    segments.push({ type: 'plain', content: plainBuffer.join('\n') });
  }

  const conflictHunks = segments.filter(
    (s): s is { type: 'conflict'; hunk: ConflictHunk } => s.type === 'conflict'
  );

  return {
    hasConflicts: conflictHunks.length > 0,
    totalHunks: conflictHunks.length,
    resolvedHunks: conflictHunks.filter((s) => s.hunk.choice !== null).length,
    segments,
  };
}

/**
 * Reassembles resolved text from segments with applied choices.
 */
export function reconstructResolvedFile(segments: ConflictSegment[]): string {
  const parts: string[] = [];

  for (const seg of segments) {
    if (seg.type === 'plain') {
      parts.push(seg.content);
    } else {
      const { hunk } = seg;
      switch (hunk.choice) {
        case 'ours':
          parts.push(hunk.currentContent);
          break;
        case 'theirs':
          parts.push(hunk.incomingContent);
          break;
        case 'both-ours-first':
          parts.push([hunk.currentContent, hunk.incomingContent].filter(Boolean).join('\n'));
          break;
        case 'both-theirs-first':
          parts.push([hunk.incomingContent, hunk.currentContent].filter(Boolean).join('\n'));
          break;
        case 'custom':
          parts.push(hunk.customContent);
          break;
        default:
          // Unresolved fallback: keep original markers
          parts.push(
            `<<<<<<< ${hunk.currentLabel}\n${hunk.currentContent}\n=======\n${hunk.incomingContent}\n>>>>>>> ${hunk.incomingLabel}`
          );
          break;
      }
    }
  }

  return parts.join('\n');
}
