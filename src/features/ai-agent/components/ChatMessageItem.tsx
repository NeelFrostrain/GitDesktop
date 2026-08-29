import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Copy,
  Check,
  Paperclip,
  Volume2,
  VolumeX,
  RotateCw,
  Play,
} from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { renderSafeMarkdown } from '../../../shared/utils/markdown';
import { AgentMessage } from '../types';
import { ToolCallCard } from './ToolCallCard';
import { useAiAgentStore } from '../store/useAiAgentStore';

interface ChatMessageItemProps {
  message: AgentMessage;
  isLatest?: boolean;
}

const formatRelativeTime = (timestamp: number): string => {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
};

const formatTime = (ts: number): string => {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Splits text into natural tokens for streaming
 */
const tokenizeContent = (text: string): string[] => {
  const tokens: string[] = [];
  const regex = /(\s+|\n+|```[\s\S]*?```|`[^`\n]*`|\*\*[^*\n]*\*\*|[^\s\n`*]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[0]);
  }
  return tokens.length > 0 ? tokens : [text];
};

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, isLatest = false }) => {
  const regenerateMessage = useAiAgentStore((s) => s.regenerateMessage);
  const executeAllToolCallsChained = useAiAgentStore((s) => s.executeAllToolCallsChained);
  const status = useAiAgentStore((s) => s.status);

  const [copied, setCopied] = useState(false);
  const [copiedChained, setCopiedChained] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isUser = message.role === 'user';
  const isThinking = status === 'thinking';

  // Pending command tool calls that can be chained together
  const pendingCommands = useMemo(() => {
    if (!message.toolCalls) return [];
    return message.toolCalls.filter(
      (t) => t.command && t.status !== 'success' && t.status !== 'rejected'
    );
  }, [message.toolCalls]);

  // Tokenize message for natural token-by-token streaming
  const tokens = useMemo(() => tokenizeContent(message.content), [message.content]);

  // Only run typing typewriter effect if this message was generated in the last 4 seconds
  const isFresh = message.role === 'assistant' && isLatest && Date.now() - message.timestamp < 4000;
  const [displayedTokenCount, setDisplayedTokenCount] = useState<number>(() =>
    isFresh ? 0 : tokens.length
  );

  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFresh) {
      setDisplayedTokenCount(tokens.length);
      return;
    }

    let isCancelled = false;
    let index = 0;
    const total = tokens.length;
    if (total === 0) return;

    const speedMultiplier = total > 120 ? Math.max(0.35, 120 / total) : 1;

    const streamToken = () => {
      if (isCancelled) return;

      if (index >= total) {
        setDisplayedTokenCount(total);
        return;
      }

      const chunk = total > 80 && Math.random() > 0.45 ? 2 : 1;
      index = Math.min(total, index + chunk);
      setDisplayedTokenCount(index);

      const latestToken = tokens[index - 1] || '';

      let delay = (16 + Math.random() * 12) * speedMultiplier;
      if (latestToken.includes('\n\n')) {
        delay = 120 * speedMultiplier;
      } else if (/[.!?]$/.test(latestToken.trim())) {
        delay = 95 * speedMultiplier;
      } else if (/[,:;]$/.test(latestToken.trim())) {
        delay = 55 * speedMultiplier;
      }

      setTimeout(streamToken, Math.max(10, delay));
    };

    const initialTimer = setTimeout(streamToken, 60);
    return () => {
      isCancelled = true;
      clearTimeout(initialTimer);
    };
  }, [isFresh, tokens]);

  const isTyping = displayedTokenCount < tokens.length;
  const visibleContent = isTyping ? tokens.slice(0, displayedTokenCount).join('') : message.content;

  // Auto-scroll chat container down as tokens stream in
  useEffect(() => {
    if (isTyping && messageRef.current) {
      const scrollParent = messageRef.current.closest('.overflow-y-auto');
      if (scrollParent) {
        scrollParent.scrollTop = scrollParent.scrollHeight;
      }
    }
  }, [displayedTokenCount, isTyping]);

  const handleSkipTyping = () => {
    if (isTyping) {
      setDisplayedTokenCount(tokens.length);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeech = () => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanSpeechText = message.content
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/[`*_#]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleRegenerate = async () => {
    if (isThinking) return;
    await regenerateMessage(message.id);
  };

  // Convert markdown to rich HTML with marked
  const renderedHtml = useMemo(() => {
    if (!visibleContent.trim()) return '';

    let contentToParse = visibleContent;
    if (message.toolCalls && message.toolCalls.length > 0) {
      for (const tool of message.toolCalls) {
        if (tool.command) {
          const escaped = tool.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const blockRegex = new RegExp(
            '```(?:bash|sh|git|shell)?\\s*\\n' + escaped + '\\s*```',
            'gi'
          );
          contentToParse = contentToParse.replace(blockRegex, '');
        }
      }
    }

    try {
      return renderSafeMarkdown(contentToParse);
    } catch {
      return visibleContent;
    }
  }, [visibleContent, message.toolCalls]);

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      e.preventDefault();
      try {
        openUrl(anchor.href);
      } catch {
        window.open(anchor.href, '_blank', 'noopener,noreferrer');
      }
    }
  };

  // --------------------------------------------------------------------------
  // USER MESSAGE VIEW
  // --------------------------------------------------------------------------
  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1 mb-4 group/user-msg select-text">
        <div className="flex items-center gap-1.5 text-[10px] text-text-muted select-none">
          <span>{formatTime(message.timestamp)}</span>
          <span className="font-semibold text-text-primary">You</span>
        </div>

        {/* User Bubble */}
        <div className="max-w-[90%] px-2.5 py-1.5 rounded-sm bg-base-2 border border-border text-xs text-text-primary shadow-2xs leading-relaxed space-y-1.5">
          <p className="whitespace-pre-wrap">{message.content}</p>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="pt-1.5 border-t border-border/40 flex items-center gap-1.5 flex-wrap">
              {message.attachments.map((att) => (
                <div
                  key={att.id}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs bg-base-1 border border-border text-[10px] font-mono text-commito-coral"
                  title={att.content.slice(0, 100)}
                >
                  <Paperclip className="w-2.5 h-2.5" />
                  <span>{att.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Actions (Copy, Read, Retry) */}
        <div className="flex items-center gap-1 pt-0.5 text-text-muted select-none opacity-0 group-hover/user-msg:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-xs hover:bg-base-2 hover:text-text-primary transition cursor-pointer"
            title="Copy prompt"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            type="button"
            onClick={handleToggleSpeech}
            className={`p-1 rounded-xs hover:bg-base-2 transition cursor-pointer ${
              isSpeaking ? 'text-commito-coral bg-commito-coral/15' : 'hover:text-text-primary'
            }`}
            title={isSpeaking ? 'Stop reading' : 'Read aloud'}
          >
            {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>

          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isThinking}
            className="p-1 rounded-xs hover:bg-base-2 hover:text-commito-coral transition cursor-pointer disabled:opacity-30"
            title="Retry prompt"
          >
            <RotateCw className={`w-3 h-3 ${isThinking ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // AI ASSISTANT MESSAGE VIEW (Direct Clean Inner Text)
  // --------------------------------------------------------------------------
  return (
    <div ref={messageRef} className="mb-6 group/msg select-text space-y-2">
      {/* Subtle Meta Header */}
      <div className="flex items-center justify-between text-[11px] text-text-muted/60 select-none pb-0.5">
        <div className="flex items-center gap-2">
          {message.modelUsed && (
            <span className="font-mono text-[10px] text-text-muted/80">{message.modelUsed}</span>
          )}
        </div>
        <span className="font-mono text-[10px] text-text-muted/60">
          {formatRelativeTime(message.timestamp)}
        </span>
      </div>

      {/* Main Inner Text Content (Direct Clean Text - No Outer Box/Card) */}
      <div
        onClick={(e) => {
          handleSkipTyping();
          handleContentClick(e);
        }}
        className="text-xs text-text-primary leading-relaxed cursor-text select-text"
      >
        <div dangerouslySetInnerHTML={{ __html: renderedHtml }} className="agent-markdown" />

        {/* Glowing typing cursor */}
        {isTyping && (
          <span className="inline-flex items-center ml-1 text-commito-coral animate-pulse select-none">
            <span className="w-1.5 h-3.5 bg-commito-coral rounded-xs shadow-[0_0_8px_rgba(224,86,56,0.7)]" />
          </span>
        )}
      </div>

      {/* Bottom Tool Calls / Command Blocks (if any) */}
      {!isTyping && message.toolCalls && message.toolCalls.length > 0 && (
        <div className="pt-2 space-y-2 animate-in fade-in duration-200">
          {/* Chained Batch Execution Bar */}
          {pendingCommands.length > 1 && (
            <div className="p-2.5 bg-base-1/50 hover:bg-base-1/70 border border-border/80 rounded-sm flex items-center justify-between gap-3 text-xs shadow-sm animate-in fade-in select-none">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-commito-coral animate-pulse shrink-0" />
                <span className="text-[11.5px] font-semibold text-text-primary truncate">
                  Run all {pendingCommands.length} commands
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const allCmds = pendingCommands
                      .map((t) => t.command?.trim())
                      .filter(Boolean)
                      .join('\n');
                    navigator.clipboard.writeText(allCmds);
                    setCopiedChained(true);
                    setTimeout(() => setCopiedChained(false), 2000);
                  }}
                  className="px-2 py-1.5 rounded-sm bg-base-1 hover:bg-base-2 border border-border text-text-muted hover:text-text-primary text-[11px] font-mono flex items-center gap-1 cursor-pointer transition"
                  title="Copy all commands"
                >
                  {copiedChained ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Copy All</span>
                </button>
                <button
                  type="button"
                  onClick={() => executeAllToolCallsChained(message.id)}
                  className="px-3 py-1.5 rounded-sm bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 text-white font-bold text-[11.5px] flex items-center gap-1.5 shadow-xs whitespace-nowrap active:scale-95 transition cursor-pointer"
                  title="Execute all commands sequentially in Terminal and feed results back to AI"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Run All ({pendingCommands.length})</span>
                </button>
              </div>
            </div>
          )}

          {message.toolCalls.map((tool) => (
            <ToolCallCard key={tool.id} toolCall={tool} />
          ))}
        </div>
      )}

      {/* Footer Action Bar */}
      {!isTyping && (
        <div className="flex items-center gap-1 pt-1 text-text-muted select-none opacity-80 hover:opacity-100 transition-opacity">
          {/* Copy */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-xs hover:bg-base-2 hover:text-text-primary transition cursor-pointer"
            title="Copy response"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Read aloud */}
          <button
            type="button"
            onClick={handleToggleSpeech}
            className={`p-1 rounded-xs hover:bg-base-2 transition cursor-pointer flex items-center gap-1 ${
              isSpeaking
                ? 'text-commito-coral bg-commito-coral/15 ring-1 ring-commito-coral/30'
                : 'hover:text-text-primary'
            }`}
            title={isSpeaking ? 'Stop reading' : 'Read aloud'}
          >
            {isSpeaking ? (
              <div className="flex items-center gap-0.5 h-3 px-0.5">
                <span className="w-0.5 bg-commito-coral rounded-full animate-audio-wave-1" />
                <span className="w-0.5 bg-commito-coral rounded-full animate-audio-wave-2" />
                <span className="w-0.5 bg-commito-coral rounded-full animate-audio-wave-3" />
              </div>
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Regenerate */}
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isThinking}
            className="p-1 rounded-xs hover:bg-base-2 hover:text-commito-coral transition cursor-pointer disabled:opacity-30"
            title="Regenerate response"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isThinking ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}
    </div>
  );
};

