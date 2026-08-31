import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
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

  const displayText = isFileWrite
    ? `Save ${toolCall.filePath || 'file'}`
    : isFileDelete
      ? `Delete ${toolCall.filePath || 'file'}`
      : toolCall.command || 'git action';

  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-sm border border-border bg-base-1/90 hover:border-border-strong transition select-none text-xs">
      {/* Left: Command / File info with $ prompt and copy button */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 font-mono text-[11px]">
        {!isFileWrite && !isFileDelete && (
          <span className="text-text-muted font-bold select-none shrink-0">$</span>
        )}
        <span
          className="truncate text-text-primary font-medium"
          title={toolCall.command || toolCall.filePath || displayText}
        >
          {displayText}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="p-0.5 text-text-muted hover:text-text-primary rounded-xs transition cursor-pointer shrink-0"
          title="Copy"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>

      {/* Right: Actions or status */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isExecuted && (
          <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xs text-[10px] font-mono font-medium">
            Applied
          </span>
        )}

        {isRejected && (
          <span className="px-2 py-0.5 bg-base-2 border border-border text-text-muted rounded-xs text-[10px] font-mono">
            Dismissed
          </span>
        )}

        {!isExecuted && !isRejected && (
          <>
            <button
              type="button"
              onClick={() => rejectToolCall(toolCall.id)}
              className="px-2 py-0.5 rounded-xs hover:bg-base-2 text-text-muted hover:text-text-primary text-[11px] font-medium transition cursor-pointer"
            >
              Dismiss
            </button>

            {isFileWrite && (
              <button
                type="button"
                onClick={() => executeToolCall(toolCall.id)}
                className="px-2.5 py-0.5 rounded-xs bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 text-white text-[11px] font-semibold transition cursor-pointer shadow-2xs whitespace-nowrap"
              >
                Save
              </button>
            )}

            {isFileDelete && (
              <button
                type="button"
                onClick={() => executeToolCall(toolCall.id)}
                className="px-2.5 py-0.5 rounded-xs bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-[11px] font-semibold transition cursor-pointer shadow-2xs whitespace-nowrap"
              >
                Delete
              </button>
            )}

            {!isFileWrite && !isFileDelete && (
              <button
                type="button"
                onClick={() => executeToolCall(toolCall.id, true)}
                className="px-2.5 py-0.5 rounded-xs bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 text-white text-[11px] font-semibold transition cursor-pointer shadow-2xs whitespace-nowrap"
              >
                Run in Terminal
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
