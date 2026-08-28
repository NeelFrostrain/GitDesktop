import React, { useState } from 'react';
import {
  Sparkles,
  GitCommit,
  GitBranch,
  AlertTriangle,
  Archive,
  Search,
  ChevronDown,
} from 'lucide-react';
import { useAiAgentStore } from '../store/useAiAgentStore';

const PROMPT_TEMPLATES = [
  {
    icon: Sparkles,
    label: 'Explain Changes',
    prompt: 'Please analyze my working tree and staged changes and explain what was modified and why.',
    attachDiff: true,
  },
  {
    icon: GitCommit,
    label: 'Draft Commit',
    prompt: 'Generate a conventional commit message (type, scope, title, and bulleted summary) based on my current changes.',
    attachDiff: true,
  },
  {
    icon: GitBranch,
    label: 'Branch Strategy',
    prompt: 'How should I organize my branches and PRs for this feature safely without losing work?',
  },
  {
    icon: AlertTriangle,
    label: 'Resolve Conflicts',
    prompt: 'I have git conflicts or diverged branches. What is the safest step-by-step procedure to resolve them?',
  },
  {
    icon: Archive,
    label: 'Stash & Switch',
    prompt: 'How do I safely stash all untracked and modified work, switch to main, pull latest changes, and restore my stash?',
  },
  {
    icon: Search,
    label: 'Review History',
    prompt: 'Review my recent commits and check if everything looks consistent and ready for code review.',
  },
];

export const QuickPromptChips: React.FC = () => {
  const { sendMessage, attachWorkingDiff } = useAiAgentStore();
  const [isExpanded, setIsExpanded] = useState(true);

  const handlePromptClick = async (tpl: typeof PROMPT_TEMPLATES[0]) => {
    if (tpl.attachDiff) {
      await attachWorkingDiff();
    }
    await sendMessage(tpl.prompt);
  };

  return (
    <div className="space-y-1 select-none">
      {/* Collapsible Header Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-1 py-0.5 text-text-muted hover:text-text-primary transition cursor-pointer group"
        title={isExpanded ? 'Collapse Quick Prompts' : 'Expand Quick Prompts'}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-2.5 h-2.5 text-commito-coral" />
          <span className="text-[10.5px] font-semibold text-text-muted group-hover:text-text-primary">
            Quick Prompts
          </span>
          <span className="text-[9.5px] font-mono text-text-faint">
            ({PROMPT_TEMPLATES.length})
          </span>
        </div>

        <ChevronDown
          className={`w-3 h-3 text-text-muted group-hover:text-text-primary transition-transform duration-150 ${
            isExpanded ? '' : '-rotate-90'
          }`}
        />
      </button>

      {/* Chips Container */}
      {isExpanded && (
        <div className="flex flex-wrap items-center justify-start gap-1.5 py-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {PROMPT_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <button
                key={tpl.label}
                type="button"
                onClick={() => handlePromptClick(tpl)}
                className="flex items-center gap-1 px-2 py-1 rounded-sm bg-base-1 hover:bg-base-2 active:bg-base-3 border border-border/80 hover:border-commito-coral/50 text-text-secondary hover:text-text-primary text-[10.5px] font-medium whitespace-nowrap transition cursor-pointer active:scale-95 shadow-2xs group"
              >
                <Icon className="w-2.5 h-2.5 text-commito-coral group-hover:scale-110 transition-transform flex-shrink-0" />
                <span>{tpl.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
