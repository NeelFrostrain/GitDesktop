import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useTerminalStore } from '../../features/terminal/store/terminalStore';
import { useSettingsStore } from '../../features/settings/store/useSettingsStore';
import { useAiAgentStore } from '../../features/ai-agent/store/useAiAgentStore';
import { SystemService } from '../../services/system/systemService';
import { GitService } from '../../services/git/gitService';

export interface PaletteCommand {
  id: string;
  title: string;
  category: 'Navigation' | 'Git Actions' | 'Branches' | 'Workspace';
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const {
    activeRepoPath,
    branches,
    setCurrentNavView,
    setIsCreateReleaseModalOpen,
    setIsCreateTagModalOpen,
    setIsMergeRequestModalOpen,
    setIsWorktreeModalOpen,
  } = useGitStore();

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const allCommands = useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [
      // Navigation
      {
        id: 'nav-changes',
        title: 'Go to Changes (Working Tree)',
        category: 'Navigation',
        action: () => setCurrentNavView('changes'),
        keywords: ['status', 'diff', 'diffs', 'staging', 'commit'],
      },
      {
        id: 'nav-history',
        title: 'Go to Commit History',
        category: 'Navigation',
        action: () => setCurrentNavView('history'),
        keywords: ['log', 'timeline', 'commits'],
      },
      {
        id: 'nav-graph',
        title: 'Go to Visual Git Graph Table',
        category: 'Navigation',
        action: () => setCurrentNavView('graph'),
        keywords: ['graph', 'tree', 'railway', 'network', 'timeline', 'branches'],
      },
      {
        id: 'nav-files',
        title: 'Go to Files Tree Explorer',
        category: 'Navigation',
        action: () => setCurrentNavView('files'),
        keywords: ['tree', 'browser', 'directory'],
      },
      {
        id: 'nav-stashes',
        title: 'Go to Stashes Manager',
        category: 'Navigation',
        action: () => setCurrentNavView('stashes'),
        keywords: ['stash', 'shelve', 'wip'],
      },
      {
        id: 'nav-worktrees',
        title: 'Open Git Worktrees Manager',
        category: 'Navigation',
        action: () => setIsWorktreeModalOpen(true),
        keywords: ['worktree', 'linked'],
      },
      {
        id: 'nav-settings',
        title: 'Open Settings & Themes',
        category: 'Navigation',
        shortcut: 'Ctrl+,',
        action: () => useSettingsStore.getState().openSettings(),
        keywords: ['preferences', 'appearance', 'theme', 'config'],
      },
      {
        id: 'nav-ai',
        title: 'Toggle AI Coding Agent',
        category: 'Navigation',
        shortcut: 'Ctrl+I',
        action: () => useAiAgentStore.getState().toggleIsOpen(),
        keywords: ['ai', 'agent', 'assistant', 'chat'],
      },
      {
        id: 'nav-terminal',
        title: 'Toggle Integrated Terminal',
        category: 'Navigation',
        shortcut: 'Ctrl+`',
        action: () => useTerminalStore.getState().toggleIsOpen(),
        keywords: ['console', 'shell', 'bash', 'powershell', 'cmd'],
      },

      // Git Actions
      {
        id: 'git-new-branch',
        title: 'Manage Branches / Create Branch...',
        category: 'Git Actions',
        action: () => setCurrentNavView('branches'),
        keywords: ['checkout', 'fork', 'branch', 'new branch'],
      },
      {
        id: 'git-create-pr',
        title: 'Create Merge / Pull Request...',
        category: 'Git Actions',
        action: () => setIsMergeRequestModalOpen(true),
        keywords: ['pr', 'mr', 'pull request', 'merge request'],
      },
      {
        id: 'git-draft-release',
        title: 'Draft New Release...',
        category: 'Git Actions',
        action: () => setIsCreateReleaseModalOpen(true),
        keywords: ['release', 'tag', 'changelog'],
      },
      {
        id: 'git-create-tag',
        title: 'Create Git Tag...',
        category: 'Git Actions',
        action: () => setIsCreateTagModalOpen(true),
        keywords: ['tag', 'version', 'v1'],
      },
      {
        id: 'git-stash-wip',
        title: 'Stash Working Changes (WIP)',
        category: 'Git Actions',
        action: () => {
          if (activeRepoPath) {
            GitService.createStash(activeRepoPath, 'WIP Stash from Command Palette', true);
          }
        },
        keywords: ['stash', 'shelve', 'save'],
      },

      // Workspace Tools
      {
        id: 'tool-vscode',
        title: 'Open Repository in VS Code',
        category: 'Workspace',
        action: () => {
          if (activeRepoPath) SystemService.openInVSCode(activeRepoPath);
        },
        keywords: ['editor', 'vscode', 'code'],
      },
      {
        id: 'tool-explorer',
        title: 'Show Repository in File Explorer',
        category: 'Workspace',
        action: () => {
          if (activeRepoPath) SystemService.showInExplorer(activeRepoPath);
        },
        keywords: ['finder', 'folder', 'files', 'explorer'],
      },
    ];

    // Append active branches for instant branch switching
    branches.forEach((b) => {
      if (!b.is_current) {
        list.push({
          id: `branch-${b.name}`,
          title: `Switch to branch: ${b.name}`,
          category: 'Branches',
          action: () => {
            if (activeRepoPath) {
              GitService.checkoutBranch(activeRepoPath, b.name);
            }
          },
          keywords: ['checkout', 'branch', b.name],
        });
      }
    });

    return list;
  }, [
    branches,
    activeRepoPath,
    setCurrentNavView,
    setIsCreateReleaseModalOpen,
    setIsCreateTagModalOpen,
    setIsMergeRequestModalOpen,
    setIsWorktreeModalOpen,
  ]);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase().trim();

    return allCommands.filter((cmd) => {
      if (cmd.title.toLowerCase().includes(q)) return true;
      if (cmd.category.toLowerCase().includes(q)) return true;
      if (cmd.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [allCommands, query]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev <= 0 ? Math.max(0, filteredCommands.length - 1) : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected) {
        onClose();
        selected.action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-start justify-center pt-[14vh] p-4 select-none font-sans animate-in fade-in duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-base-0 border border-border-strong rounded-sm shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[60vh] animate-in zoom-in-95 duration-100 ring-1 ring-black/40"
      >
        {/* Search Input Bar */}
        <div className="p-3 border-b border-border bg-base-1 flex items-center gap-2.5 shrink-0">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, action, or branch name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none font-sans"
          />
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-xs bg-base-0 border border-border text-text-muted shrink-0">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted italic">
              No matching commands found
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => {
                    onClose();
                    cmd.action();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2 rounded-xs flex items-center justify-between gap-3 cursor-pointer transition ${
                    isSelected
                      ? 'bg-base-2 text-text-primary border border-border-strong shadow-2xs font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-base-1 border border-transparent'
                  }`}
                >
                  <div className="flex items-center min-w-0">
                    <span className="text-xs truncate">{cmd.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
                      {cmd.category}
                    </span>
                    {cmd.shortcut && (
                      <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded-xs bg-base-0 border border-border text-commito-coral">
                        {cmd.shortcut}
                      </span>
                    )}
                    {isSelected && (
                      <ArrowRight className="w-3.5 h-3.5 text-commito-coral shrink-0" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Palette Footer Hints */}
        <div className="px-3 py-1.5 bg-base-1/50 border-t border-border flex items-center justify-between text-[10px] text-text-muted shrink-0 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Dismiss</span>
          </div>
          <span className="text-commito-coral font-semibold">Git Desktop Palette</span>
        </div>
      </div>
    </div>
  );
};
