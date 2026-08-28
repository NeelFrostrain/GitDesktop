import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Plus,
  Trash2,
  Paperclip,
  RotateCcw,
  Loader2,
  FileCode2,
  Settings,
  ChevronDown,
  Cpu,
  Check,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useAiAgentStore } from '../store/useAiAgentStore';
import { ChatMessageItem } from './ChatMessageItem';
import { QuickPromptChips } from './QuickPromptChips';
import { useSettingsStore } from '../../settings';
import { AgentSecurityMode } from '../types';

const SECURITY_OPTIONS: Array<{
  id: AgentSecurityMode;
  name: string;
  badge: string;
  desc: string;
  icon: React.FC<{ className?: string }>;
  color: string;
}> = [
  {
    id: 'strict',
    name: 'Strict',
    badge: 'Ask Everything',
    desc: 'Terminal commands and file edits/deletes always require manual review.',
    icon: ShieldAlert,
    color: 'text-emerald-400',
  },
  {
    id: 'sandboxed',
    name: 'Sandboxed',
    badge: 'Safe Auto',
    desc: 'Auto-saves workspace files; commands and deletes require confirmation.',
    icon: Shield,
    color: 'text-sky-400',
  },
  {
    id: 'full_access',
    name: 'Full Access',
    badge: 'Unrestricted',
    desc: 'Agents have full access to execute commands and file operations automatically.',
    icon: ShieldCheck,
    color: 'text-amber-400',
  },
];

const MODEL_OPTIONS = [
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    badge: 'Ultra Fast',
    desc: 'Lightning fast execution, free tier quotas.',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    badge: 'Next-Gen',
    desc: 'Next-generation lightweight reasoning model.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'High-Speed',
    desc: 'Balanced reasoning and rapid latency for diffs.',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    badge: 'Low Latency',
    desc: 'Sub-second generation times with concise formatting.',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    badge: 'Flash',
    desc: 'Deep semantic understanding across codebases.',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    badge: '1.5 Flash',
    desc: 'Proven fast reasoning with large context window.',
  },
];

const getStoredWidth = (): number => {
  try {
    const saved = localStorage.getItem('ai_agent_panel_width');
    return saved ? Math.max(340, Math.min(window.innerWidth - 80, parseInt(saved, 10))) : 480;
  } catch {
    return 480;
  }
};

export const AiAgentPanel: React.FC = () => {
  const {
    isOpen,
    setIsOpen,
    sessions,
    activeSessionId,
    status,
    securityMode,
    setSecurityMode,
    pendingAttachments,
    createSession,
    selectSession,
    deleteSession,
    clearActiveSession,
    removeAttachment,
    attachWorkingDiff,
    sendMessage,
  } = useAiAgentStore();

  const openSettings = useSettingsStore((s) => s.openSettings);
  const getEffectiveValue = useSettingsStore((s) => s.getEffectiveValue);
  const setSettingValue = useSettingsStore((s) => s.setSettingValue);

  const selectedModel = String(getEffectiveValue('ai.model') || 'gemini-2.5-flash-lite');
  const activeModelObj = MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[0];
  const activeSecurityObj = SECURITY_OPTIONS.find((s) => s.id === securityMode) || SECURITY_OPTIONS[0];
  const ActiveSecurityIcon = activeSecurityObj.icon;

  const [panelWidth, setPanelWidth] = useState<number>(getStoredWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isSecurityMenuOpen, setIsSecurityMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const securityMenuRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const isThinking = status === 'thinking';

  // Auto-scroll to bottom on message updates
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages, isThinking, isOpen]);

  // Focus textarea when opening panel
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Close menus on click outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(e.target as Node)) {
        setIsSessionMenuOpen(false);
      }
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
      if (securityMenuRef.current && !securityMenuRef.current.contains(e.target as Node)) {
        setIsSecurityMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!isOpen) return null;

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX; // Moving left increases width of right sidebar
      const maxW = Math.min(1100, window.innerWidth - 80);
      const newWidth = Math.max(340, Math.min(maxW, startWidth + deltaX));
      setPanelWidth(newWidth);
      try {
        localStorage.setItem('ai_agent_panel_width', newWidth.toString());
      } catch {}
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleSend = async () => {
    if (!inputVal.trim() || isThinking) return;
    const text = inputVal;
    setInputVal('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputVal(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(120, e.target.scrollHeight)}px`;
  };

  const handleOpenAiSettings = () => {
    openSettings('ai');
  };

  if (!isOpen) return null;

  return (
    <aside
      style={{ width: `${panelWidth}px` }}
      className={`relative h-full bg-base-0 border-l border-border flex flex-col justify-between select-none shrink-0 z-30 overflow-hidden ${
        isDragging ? '' : 'transition-[width] duration-75'
      }`}
    >
      {/* Left Resizing Drag Handle */}
      <div
        onMouseDown={handleMouseDownResize}
        className="absolute left-0 inset-y-0 w-2 -translate-x-1/2 cursor-col-resize hover:bg-commito-coral/40 active:bg-commito-coral transition-colors z-50 flex items-center justify-center group select-none"
        title="Drag to resize AI Agent sidebar"
      >
        <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-commito-coral transition-colors" />
      </div>

      {/* Top Header */}
      <div className="h-11 px-2 bg-base-1/90 border-b border-border/80 flex items-center justify-between gap-1.5 shrink-0">
        {/* Left: Icon, Session Switcher, Model Switcher */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Logo/Icon */}
          {/* <div className="w-6 h-6 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div> */}

          {/* Session Switcher Dropdown */}
          <div className="relative min-w-0 flex-1 max-w-[140px] sm:max-w-[160px]" ref={sessionMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsSessionMenuOpen((v) => !v);
                setIsModelMenuOpen(false);
              }}
              className="w-full flex items-center justify-between gap-1 px-2 py-1 rounded-sm bg-base-0 hover:bg-base-2 border border-border text-xs font-semibold text-text-primary transition cursor-pointer"
              title="Switch Chat Session"
            >
              <span className="truncate text-[11.5px]">{activeSession?.title || 'New Chat'}</span>
              <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
            </button>

            {/* Session Dropdown Menu */}
            {isSessionMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-60 bg-base-1 border border-border rounded-sm shadow-2xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border/50 flex items-center justify-between">
                  <span>Chat Sessions ({sessions.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      createSession();
                      setIsSessionMenuOpen(false);
                    }}
                    className="p-0.5 hover:text-commito-coral transition cursor-pointer"
                    title="New Chat"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto py-1 space-y-0.5 scrollbar-thin">
                  {sessions.map((sess) => {
                    const isCurrent = sess.id === activeSessionId;
                    return (
                      <div
                        key={sess.id}
                        onClick={() => {
                          selectSession(sess.id);
                          setIsSessionMenuOpen(false);
                        }}
                        className={`group px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer transition ${
                          isCurrent
                            ? 'bg-base-2 text-commito-coral font-semibold'
                            : 'hover:bg-base-2/70 text-text-primary'
                        }`}
                      >
                        <span className="truncate flex-1">{sess.title}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(sess.id);
                          }}
                          className="p-1 rounded-xs opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger hover:bg-base-3 transition cursor-pointer"
                          title="Delete Session"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Model Switcher Dropdown */}
          <div className="relative shrink-0" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsModelMenuOpen((v) => !v);
                setIsSessionMenuOpen(false);
              }}
              className="flex items-center gap-1 px-1.5 py-1 rounded-sm bg-base-0 hover:bg-base-2 border border-border text-[11px] font-mono text-text-secondary hover:text-text-primary transition cursor-pointer"
              title="Change AI Model"
            >
              <Cpu className="w-3 h-3 text-commito-coral shrink-0" />
              <span className="truncate font-medium">
                {activeModelObj.name.replace('Gemini ', '')}
              </span>
              <ChevronDown className="w-2.5 h-2.5 text-text-muted shrink-0" />
            </button>

            {/* Model Dropdown Menu */}
            {isModelMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-68 bg-base-1 border border-border rounded-sm shadow-2xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border/50 flex items-center justify-between">
                  <span>Gemini Model</span>
                  <span className="text-[9px] font-mono text-commito-coral">Google AI</span>
                </div>

                <div className="py-1 space-y-0.5 max-h-60 overflow-y-auto scrollbar-thin">
                  {MODEL_OPTIONS.map((opt) => {
                    const isSelected = opt.id === selectedModel;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={async () => {
                          await setSettingValue('ai.model', opt.id);
                          setIsModelMenuOpen(false);
                        }}
                        className={`w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left cursor-pointer transition ${
                          isSelected
                            ? 'bg-base-2 text-commito-coral font-semibold'
                            : 'hover:bg-base-2/70 text-text-primary'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] truncate font-medium">{opt.name}</div>
                          <div className="text-[10px] text-text-muted/70 truncate">{opt.desc}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded-xs bg-base-0 border border-border text-text-muted">
                            {opt.badge}
                          </span>
                          {isSelected && <Check className="w-3 h-3 text-commito-coral" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Agent Security Mode Switcher Dropdown */}
          <div className="relative shrink-0" ref={securityMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsSecurityMenuOpen((v) => !v);
                setIsModelMenuOpen(false);
                setIsSessionMenuOpen(false);
              }}
              className="flex items-center gap-1 px-1.5 py-1 rounded-sm bg-base-0 hover:bg-base-2 border border-border text-[11px] font-mono text-text-secondary hover:text-text-primary transition cursor-pointer"
              title="Agent Security & Permissions Mode"
            >
              <ActiveSecurityIcon className={`w-3 h-3 ${activeSecurityObj.color} shrink-0`} />
              <span className="truncate font-medium">
                {activeSecurityObj.name}
              </span>
              <ChevronDown className="w-2.5 h-2.5 text-text-muted shrink-0" />
            </button>

            {/* Security Dropdown Menu */}
            {isSecurityMenuOpen && (
              <div className="absolute top-full right-0 mt-1 w-68 bg-base-1 border border-border rounded-sm shadow-2xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border/50 flex items-center justify-between">
                  <span>Agent Security Mode</span>
                  <span className="text-[9px] font-mono text-commito-coral">Permissions</span>
                </div>

                <div className="py-1 space-y-0.5 max-h-60 overflow-y-auto scrollbar-thin">
                  {SECURITY_OPTIONS.map((opt) => {
                    const isSelected = opt.id === securityMode;
                    const IconComp = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSecurityMode(opt.id);
                          setIsSecurityMenuOpen(false);
                        }}
                        className={`w-full px-2.5 py-2 flex items-start justify-between gap-2 text-left cursor-pointer transition ${
                          isSelected
                            ? 'bg-base-2 text-text-primary font-semibold'
                            : 'hover:bg-base-2/70 text-text-primary'
                        }`}
                      >
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <IconComp className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${opt.color}`} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11.5px] truncate font-medium flex items-center gap-1.5">
                              <span>{opt.name}</span>
                              <span className="text-[9px] font-mono px-1 py-0.1 rounded-xs bg-base-0 border border-border text-text-muted shrink-0">
                                {opt.badge}
                              </span>
                            </div>
                            <div className="text-[10.5px] text-text-muted/80 leading-snug mt-0.5 whitespace-normal break-words">
                              {opt.desc}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-commito-coral shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Header Buttons: New Chat, Clear, Settings, Close */}
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          <button
            type="button"
            onClick={() => createSession()}
            className="p-1.5 rounded-sm hover:bg-base-2 text-text-muted hover:text-text-primary transition cursor-pointer"
            title="New Chat Session"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={clearActiveSession}
            className="p-1.5 rounded-sm hover:bg-base-2 text-text-muted hover:text-text-primary transition cursor-pointer"
            title="Clear Current Messages"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleOpenAiSettings}
            className="p-1.5 rounded-sm hover:bg-base-2 text-text-muted hover:text-commito-coral transition cursor-pointer"
            title="Configure AI Models & Keys"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-sm hover:bg-base-2 text-text-muted hover:text-text-primary transition cursor-pointer"
            title="Close AI Agent (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-base-3 min-h-0">
        {activeSession?.messages.map((msg, idx) => (
          <ChatMessageItem
            key={msg.id}
            message={msg}
            isLatest={idx === activeSession.messages.length - 1}
          />
        ))}

        {/* Thinking Indicator */}
        {isThinking && (
          <div className="flex items-center gap-2 p-3 bg-base-1/50 border border-border/70 rounded-sm animate-pulse">
            <Loader2 className="w-4 h-4 text-commito-coral animate-spin shrink-0" />
            <span className="text-xs text-text-muted font-medium">
              AI Agent is analyzing repository context and thinking...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Footer Area: Quick Prompts + Pending Attachments + Input Composer */}
      <div className="p-2.5 bg-base-1/90 border-t border-border/80 space-y-2 shrink-0">
        {/* Quick Prompt Chips */}
        <QuickPromptChips />

        {/* Pending Context Attachments */}
        {pendingAttachments.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {pendingAttachments.map((att) => (
              <span
                key={att.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-base-2 border border-commito-coral/40 text-commito-coral text-[10px] font-mono shadow-2xs"
              >
                <Paperclip className="w-2.5 h-2.5" />
                <span>{att.title}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="hover:text-danger ml-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input Composer */}
        <div className="relative flex items-end gap-1.5 bg-base-0 border border-border/80 focus-within:border-commito-coral/50 focus-within:ring-1 focus-within:ring-commito-coral/20 rounded-sm p-1.5 transition">
          {/* Attach Git Diff button */}
          <button
            type="button"
            onClick={attachWorkingDiff}
            className="p-1 rounded-xs hover:bg-base-2 text-text-muted hover:text-commito-coral transition cursor-pointer shrink-0 mb-0.5"
            title="Attach Current Git Diff"
          >
            <FileCode2 className="w-4 h-4" />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={inputVal}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI Agent about your code, diffs, branches, or Git actions..."
            className="flex-1 bg-transparent resize-none border-none outline-none text-xs text-text-primary placeholder:text-text-faint max-h-28 py-1 leading-relaxed"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!inputVal.trim() || isThinking}
            className="p-1.5 rounded-xs bg-commito-coral hover:bg-commito-coral/90 disabled:opacity-30 disabled:hover:bg-commito-coral text-white transition cursor-pointer shrink-0 mb-0.5 active:scale-95 shadow-xs"
            title="Send Message (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Footer Hint */}
        <div className="flex items-center justify-between text-[10px] text-text-faint px-1 select-none">
          <span>Shift+Enter for newline</span>
          <span className="font-mono">{activeModelObj.name}</span>
        </div>
      </div>
    </aside>
  );
};
