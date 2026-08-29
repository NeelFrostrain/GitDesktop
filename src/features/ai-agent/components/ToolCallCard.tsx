import React, { useState } from 'react';
import { Play, Copy, Check, X, CheckCircle2, Terminal, FileCode2, Trash2, Save } from 'lucide-react';
import { AgentToolCall } from '../types';
import { useAiAgentStore } from '../store/useAiAgentStore';

interface ToolCallCardProps {
  toolCall: AgentToolCall;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall }) => {
  const { executeToolCall, rejectToolCall } = useAiAgentStore();
  const [copied, setCopied] = useState(false);

  const isFileWrite =
    toolCall.name === 'write_file' ||
    toolCall.name === 'create_file' ||
    toolCall.name === 'edit_file';
  const isFileDelete = toolCall.name === 'delete_file';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = isFileWrite
      ? toolCall.fileContent || toolCall.filePath || ''
      : toolCall.command || toolCall.filePath || '';
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isExecuted = toolCall.status === 'success';
  const isRejected = toolCall.status === 'rejected';

  let title = '';
  let subtitle = '';
  if (isFileWrite) {
    title = toolCall.filePath || 'File Write';
    subtitle = 'File Modification · Apply to disk';
  } else if (isFileDelete) {
    title = toolCall.filePath || 'Delete File';
    subtitle = 'File Deletion · Remove from disk';
  } else {
    const commandText = toolCall.command || 'Git Action';
    title = commandText.trim().split('\n')[0] || 'git command';
    subtitle = 'Terminal Command · Shell execution';
  }

  return (
    <div className="rounded-xl border border-border/90 hover:border-commito-coral/40 bg-gradient-to-br from-base-1/90 via-base-1/70 to-base-2/50 p-3 shadow-md transition group/card select-none space-y-2.5 overflow-hidden">
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Badge & Title */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Glowing Action Icon */}
          <div
            className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 shadow-inner ${
              isFileWrite
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                : isFileDelete
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-commito-coral/15 border-commito-coral/30 text-commito-coral shadow-[0_0_8px_rgba(224,86,56,0.2)]'
            }`}
          >
            {isFileWrite ? (
              <FileCode2 className="w-4 h-4" />
            ) : isFileDelete ? (
              <Trash2 className="w-4 h-4" />
            ) : (
              <Terminal className="w-4 h-4 animate-pulse" />
            )}
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold text-text-primary font-mono truncate" title={title}>
              {title}
            </div>
            <div className="text-[10px] text-text-muted/80 font-mono truncate flex items-center gap-1.5 mt-0.5">
              <span>{subtitle}</span>
            </div>
          </div>
        </div>

        {/* Right: Copy & Status Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-md hover:bg-base-2 text-text-muted hover:text-text-primary transition cursor-pointer"
            title={isFileWrite ? 'Copy file contents' : 'Copy command'}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {isExecuted && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg text-[10.5px] font-mono font-bold shadow-[0_0_8px_rgba(34,197,94,0.2)]">
              <CheckCircle2 className="w-3 h-3" />
              <span>Applied</span>
            </span>
          )}

          {isRejected && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-base-2 border border-border text-text-faint rounded-lg text-[10.5px] font-mono">
              Dismissed
            </span>
          )}
        </div>
      </div>

      {/* Command Code Preview Box (for shell commands) */}
      {!isFileWrite && !isFileDelete && toolCall.command && (
        <div className="relative rounded-lg bg-black/70 border border-border/80 px-3 py-2 font-mono text-[11px] text-emerald-400/90 overflow-x-auto selection:bg-commito-coral/30 flex items-center gap-2">
          <span className="text-commito-coral font-bold select-none">$</span>
          <span className="truncate text-text-primary">{toolCall.command}</span>
        </div>
      )}

      {/* Action Buttons Toolbar */}
      {!isExecuted && !isRejected && (
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
          <button
            type="button"
            onClick={() => rejectToolCall(toolCall.id)}
            className="px-2.5 py-1 rounded-md border border-border/80 bg-base-1 hover:bg-base-2 text-text-muted hover:text-text-primary text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
            title="Dismiss action"
          >
            <X className="w-3 h-3" />
            <span>Dismiss</span>
          </button>

          {isFileWrite && (
            <button
              type="button"
              onClick={() => executeToolCall(toolCall.id)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 active:from-sky-700 text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-[0_0_10px_rgba(2,132,199,0.3)] whitespace-nowrap active:scale-95"
            >
              <Save className="w-3 h-3 fill-current" />
              <span>Save File</span>
            </button>
          )}

          {isFileDelete && (
            <button
              type="button"
              onClick={() => executeToolCall(toolCall.id)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 active:from-rose-700 text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-[0_0_10px_rgba(225,29,72,0.3)] whitespace-nowrap active:scale-95"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete File</span>
            </button>
          )}

          {!isFileWrite && !isFileDelete && (
            <button
              type="button"
              onClick={() => executeToolCall(toolCall.id, true)}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-commito-coral to-orange-500 hover:from-commito-coralLight hover:to-orange-400 active:from-commito-coral text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-[0_0_12px_rgba(224,86,56,0.35)] whitespace-nowrap active:scale-95"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Run in Terminal</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

