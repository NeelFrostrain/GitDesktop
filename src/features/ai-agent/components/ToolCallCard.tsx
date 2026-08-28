import React, { useState } from 'react';
import { Play, Copy, Check, X, CheckCircle2, Code2, FileCode2, Trash2, Save } from 'lucide-react';
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

  // Extract title and subtitle
  let title = '';
  let subtitle = '';
  if (isFileWrite) {
    title = toolCall.filePath || 'File Write';
    subtitle = 'File · Save / Apply changes to disk';
  } else if (isFileDelete) {
    title = toolCall.filePath || 'Delete File';
    subtitle = 'File · Remove from repository';
  } else {
    const commandText = toolCall.command || 'Git Action';
    title = commandText.trim().split('\n')[0] || 'git command';
    subtitle = 'Git · Terminal command';
  }

  return (
    <div className="rounded-md border border-border/80 bg-base-1/50 hover:bg-base-1/70 p-2.5 flex items-center justify-between gap-3 shadow-sm transition group/card select-none">
      {/* Left: Badge & Details */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Icon Badge */}
        <div className="w-9 h-9 rounded-sm border border-border/80 bg-black/40 flex items-center justify-center shrink-0 shadow-inner">
          {isFileWrite ? (
            <FileCode2 className="w-4 h-4 text-sky-400" />
          ) : isFileDelete ? (
            <Trash2 className="w-4 h-4 text-rose-400" />
          ) : (
            <Code2 className="w-4 h-4 text-commito-coral" />
          )}
        </div>

        {/* Text Details */}
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold text-text-primary font-mono truncate" title={title}>
            {title}
          </div>
          <div className="text-[10.5px] text-text-muted font-mono truncate mt-0.5">
            {subtitle}
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded-xs hover:bg-base-2 text-text-muted hover:text-text-primary transition cursor-pointer"
          title={isFileWrite ? 'Copy file contents' : 'Copy command'}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>

        {isExecuted && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-sm text-[11px] font-mono font-bold">
            <CheckCircle2 className="w-3 h-3" />
            <span>Applied</span>
          </span>
        )}

        {isRejected && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-base-2 border border-border text-text-faint rounded-sm text-[11px] font-mono">
            Skipped
          </span>
        )}

        {!isExecuted && !isRejected && (
          <>
            <button
              type="button"
              onClick={() => rejectToolCall(toolCall.id)}
              className="px-2 py-1.5 rounded-sm border border-border bg-base-1 hover:bg-base-2 text-text-muted hover:text-text-primary text-[11px] font-medium transition cursor-pointer flex items-center gap-1 whitespace-nowrap"
              title="Dismiss action"
            >
              <X className="w-3 h-3" />
              <span>Dismiss</span>
            </button>

            {isFileWrite && (
              <button
                type="button"
                onClick={() => executeToolCall(toolCall.id)}
                className="px-3 py-1.5 rounded-sm bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-[11.5px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs whitespace-nowrap active:scale-95"
              >
                <Save className="w-3 h-3 fill-current" />
                <span>Save File</span>
              </button>
            )}

            {isFileDelete && (
              <button
                type="button"
                onClick={() => executeToolCall(toolCall.id)}
                className="px-3 py-1.5 rounded-sm bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-[11.5px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs whitespace-nowrap active:scale-95"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete File</span>
              </button>
            )}

            {!isFileWrite && !isFileDelete && (
              <button
                type="button"
                onClick={() => executeToolCall(toolCall.id, true)}
                className="px-3 py-1.5 rounded-sm bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 text-white text-[11.5px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs whitespace-nowrap active:scale-95"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Run in Terminal</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
