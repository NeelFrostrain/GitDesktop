import { useState, useCallback, useRef } from 'react';
import { GIT_COMMAND_TREE, GitFlag } from '../lib/gitCommandTree';
import { ptyBridge } from '../lib/ptyBridge';
import { AutocompleteSuggestion } from '../types';

export function useGitAutocomplete(repoPath: string | null) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [ghostText, setGhostText] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const debounceTimerRef = useRef<number | null>(null);
  const lastQueryRef = useRef<string>('');

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setSelectedIndex(0);
    setGhostText('');
    setIsVisible(false);
  }, []);

  const computeClientSuggestions = useCallback(
    (line: string, cursorPos: number): AutocompleteSuggestion[] => {
      const slice = line.slice(0, cursorPos);
      const isNewToken = slice.endsWith(' ') || slice.endsWith('\t');
      const tokens = slice.trim().split(/\s+/).filter(Boolean);

      if (tokens.length === 0) {
        return [];
      }

      // Check if starting with git
      if (tokens[0] !== 'git') {
        if ('git'.startsWith(tokens[0])) {
          return [
            {
              text: 'git',
              value: 'git',
              description: 'Git version control system',
              kind: 'command',
            },
          ];
        }
        return [];
      }

      // Token index 1: git <command>
      if (tokens.length === 1 && isNewToken) {
        // Show all top git commands
        return Object.entries(GIT_COMMAND_TREE).slice(0, 15).map(([cmd, def]) => ({
          text: cmd,
          value: cmd,
          description: def.description,
          kind: 'command',
        }));
      }

      if (tokens.length === 2 && !isNewToken) {
        const prefix = tokens[1].toLowerCase();
        return Object.entries(GIT_COMMAND_TREE)
          .filter(([cmd]) => cmd.toLowerCase().startsWith(prefix))
          .map(([cmd, def]) => ({
            text: cmd,
            value: cmd,
            description: def.description,
            kind: 'command',
          }));
      }

      const mainCmd = tokens[1]?.toLowerCase();
      const cmdDef = GIT_COMMAND_TREE[mainCmd];

      if (!cmdDef) {
        return [];
      }

      const currentToken = isNewToken ? '' : tokens[tokens.length - 1] || '';

      // Flags completion (e.g. - or --)
      if (currentToken.startsWith('-')) {
        const prefix = currentToken.toLowerCase();
        return cmdDef.flags
          .filter((f: GitFlag) => f.flag.toLowerCase().startsWith(prefix))
          .map((f: GitFlag) => ({
            text: f.flag,
            value: f.flag,
            description: f.description,
            kind: 'flag',
          }));
      }

      // Subcommands completion if available
      if (cmdDef.subcommands && cmdDef.subcommands.length > 0) {
        if (tokens.length === 2 && isNewToken) {
          return cmdDef.subcommands.map((sub: string) => ({
            text: sub,
            value: sub,
            description: `Subcommand for git ${mainCmd}`,
            kind: 'subcommand',
          }));
        }
        if (tokens.length === 3 && !isNewToken) {
          const prefix = tokens[2].toLowerCase();
          return cmdDef.subcommands
            .filter((sub: string) => sub.toLowerCase().startsWith(prefix))
            .map((sub: string) => ({
              text: sub,
              value: sub,
              description: `Subcommand for git ${mainCmd}`,
              kind: 'subcommand',
            }));
        }
      }

      return [];
    },
    []
  );

  const updateSuggestions = useCallback(
    (line: string, cursorPos: number) => {
      const slice = line.slice(0, cursorPos);
      if (slice.trim().length === 0) {
        clearSuggestions();
        return;
      }

      // First calculate instant client suggestions
      const clientMatches = computeClientSuggestions(line, cursorPos);

      if (clientMatches.length > 0) {
        setSuggestions(clientMatches);
        setSelectedIndex(0);
        setIsVisible(true);

        const currentToken = slice.split(/\s+/).pop() || '';
        const topMatch = clientMatches[0];
        if (topMatch && topMatch.value.toLowerCase().startsWith(currentToken.toLowerCase())) {
          setGhostText(topMatch.value.slice(currentToken.length));
        } else {
          setGhostText('');
        }
        return;
      }

      // Otherwise, query live backend repository suggestions (branches, remotes, files, stashes)
      if (!repoPath) {
        clearSuggestions();
        return;
      }

      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }

      lastQueryRef.current = slice;
      debounceTimerRef.current = window.setTimeout(async () => {
        try {
          const dynamicMatches = await ptyBridge.autocompleteSuggest(repoPath, line, cursorPos);
          if (lastQueryRef.current !== slice) return;

          if (dynamicMatches && dynamicMatches.length > 0) {
            setSuggestions(dynamicMatches);
            setSelectedIndex(0);
            setIsVisible(true);

            const currentToken = slice.split(/\s+/).pop() || '';
            const topMatch = dynamicMatches[0];
            if (topMatch && topMatch.value.toLowerCase().startsWith(currentToken.toLowerCase())) {
              setGhostText(topMatch.value.slice(currentToken.length));
            } else {
              setGhostText('');
            }
          } else {
            clearSuggestions();
          }
        } catch {
          clearSuggestions();
        }
      }, 70);
    },
    [repoPath, computeClientSuggestions, clearSuggestions]
  );

  const isInsideQuotes = useCallback((line: string, cursorPos: number): boolean => {
    const slice = line.slice(0, cursorPos);
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < slice.length; i++) {
      const char = slice[i];
      if (char === '"' && !inSingle) {
        inDouble = !inDouble;
      } else if (char === "'" && !inDouble) {
        inSingle = !inSingle;
      }
    }

    return inSingle || inDouble;
  }, []);

  const selectNext = useCallback(() => {
    setSelectedIndex((prev) => (suggestions.length > 0 ? (prev + 1) % suggestions.length : 0));
  }, [suggestions.length]);

  const selectPrev = useCallback(() => {
    setSelectedIndex((prev) =>
      suggestions.length > 0 ? (prev - 1 + suggestions.length) % suggestions.length : 0
    );
  }, [suggestions.length]);

  return {
    suggestions,
    selectedIndex,
    ghostText,
    isVisible,
    setSelectedIndex,
    updateSuggestions,
    clearSuggestions,
    isInsideQuotes,
    selectNext,
    selectPrev,
  };
}
