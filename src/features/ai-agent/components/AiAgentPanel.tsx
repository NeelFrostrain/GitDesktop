import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Paperclip,
  RotateCcw,
  Loader2,
  Settings,
  ChevronDown,
  Cpu,
  Check,
  ArrowUp,
  Terminal,
  FileCode,
  Zap,
} from "lucide-react";
import { useAiAgentStore } from "../store/useAiAgentStore";
import { ChatMessageItem } from "./ChatMessageItem";
import { QuickPromptChips } from "./QuickPromptChips";
import { useSettingsStore } from "../../settings";

const MODEL_OPTIONS = [
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    badge: "Ultra Fast",
    desc: "Lightning fast execution, free tier quotas.",
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    badge: "Next-Gen",
    desc: "Next-generation lightweight reasoning model.",
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    badge: "High-Speed",
    desc: "Balanced reasoning and rapid latency for diffs.",
  },
  {
    id: "gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash Lite",
    badge: "Low Latency",
    desc: "Sub-second generation times with concise formatting.",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    badge: "Flash",
    desc: "Deep semantic understanding across codebases.",
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    badge: "1.5 Flash",
    desc: "Proven fast reasoning with large context window.",
  },
];

const getStoredWidth = (): number => {
  try {
    const saved = localStorage.getItem("ai_agent_panel_width");
    return saved
      ? Math.max(340, Math.min(window.innerWidth - 80, parseInt(saved, 10)))
      : 480;
  } catch {
    return 480;
  }
};

export const AiAgentPanel: React.FC<{ width?: number }> = ({ width: widthProp }) => {
  const {
    isOpen,
    setIsOpen,
    sessions,
    activeSessionId,
    status,
    pendingAttachments,
    createSession,
    selectSession,
    deleteSession,
    clearActiveSession,
    removeAttachment,
    attachWorkingDiff,
    attachTerminalHistory,
    sendMessage,
  } = useAiAgentStore();

  const openSettings = useSettingsStore((s) => s.openSettings);
  const getEffectiveValue = useSettingsStore((s) => s.getEffectiveValue);
  const setSettingValue = useSettingsStore((s) => s.setSettingValue);

  const selectedModel = String(
    getEffectiveValue("ai.model") || "gemini-2.5-flash-lite",
  );
  const activeModelObj =
    MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[0];

  const [panelWidth, setPanelWidth] = useState<number>(getStoredWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const { cancelRequest } = useAiAgentStore();
  const isThinking = status === "thinking";

  // Auto-scroll to bottom on message updates
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      if (
        sessionMenuRef.current &&
        !sessionMenuRef.current.contains(e.target as Node)
      ) {
        setIsSessionMenuOpen(false);
      }
      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(e.target as Node)
      ) {
        setIsModelMenuOpen(false);
      }
      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(e.target as Node)
      ) {
        setIsAttachMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  if (!isOpen) return null;

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX;
    const startWidth = panelWidth;
    let latestWidth = startWidth;
    let rafId: number | null = null;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const deltaX = startX - moveEvent.clientX; // Moving left increases width of right sidebar
        const maxW = Math.min(1100, window.innerWidth - 80);
        const newWidth = Math.max(340, Math.min(maxW, startWidth + deltaX));
        latestWidth = newWidth;
        setPanelWidth(newWidth);
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsDragging(false);
      try {
        localStorage.setItem("ai_agent_panel_width", latestWidth.toString());
      } catch {}
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  const handleSend = async () => {
    if (!inputVal.trim() || isThinking) return;
    const text = inputVal;
    setInputVal("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputVal(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(120, e.target.scrollHeight)}px`;
  };

  const handleOpenAiSettings = () => {
    openSettings("ai");
  };

  if (!isOpen) return null;

  // Use externally controlled width if provided; fall back to internal drag width
  const effectiveWidth = widthProp ?? panelWidth;

  return (
    <aside
      style={{ width: `${effectiveWidth}px` }}
      className="relative h-full bg-base-0 border border-border/80 rounded-sm flex flex-col justify-between select-none shrink-0 z-30 shadow-2xs overflow-hidden"
    >
      {/* Top Header */}
      <div className="h-11 px-2 bg-base-1/90 border-b border-border/80 flex items-center justify-between gap-1.5 shrink-0">
        {/* Left: Icon, Session Switcher, Model Switcher */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Logo/Icon */}
          {/* <div className="w-6 h-6 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div> */}

          {/* Session Switcher Dropdown */}
          <div
            className="relative min-w-0 flex-1 max-w-[140px] sm:max-w-[160px]"
            ref={sessionMenuRef}
          >
            <button
              type="button"
              onClick={() => {
                setIsSessionMenuOpen((v) => !v);
                setIsModelMenuOpen(false);
              }}
              className="w-full flex items-center justify-between gap-1 px-2 py-1 rounded-sm bg-base-0 hover:bg-base-2 border border-border text-xs font-semibold text-text-primary transition cursor-pointer"
              title="Switch Chat Session"
            >
              <span className="truncate text-[11.5px]">
                {activeSession?.title || "New Chat"}
              </span>
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
                            ? "bg-base-2 text-commito-coral font-semibold"
                            : "hover:bg-base-2/70 text-text-primary"
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
                {activeModelObj.name.replace("Gemini ", "")}
              </span>
              <ChevronDown className="w-2.5 h-2.5 text-text-muted shrink-0" />
            </button>

            {/* Model Dropdown Menu */}
            {isModelMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 max-w-[calc(100vw-32px)] bg-base-1 border border-border rounded-sm shadow-2xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border/50 flex items-center justify-between">
                  <span>Gemini Model</span>
                  <span className="text-[9px] font-mono text-commito-coral">
                    Google AI
                  </span>
                </div>

                <div className="py-1 space-y-0.5 max-h-60 overflow-y-auto scrollbar-thin">
                  {MODEL_OPTIONS.map((opt) => {
                    const isSelected = opt.id === selectedModel;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={async () => {
                          await setSettingValue("ai.model", opt.id);
                          setIsModelMenuOpen(false);
                        }}
                        className={`w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left cursor-pointer transition ${
                          isSelected
                            ? "bg-base-2 text-commito-coral font-semibold"
                            : "hover:bg-base-2/70 text-text-primary"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] truncate font-medium">
                            {opt.name}
                          </div>
                          <div className="text-[10px] text-text-muted/70 truncate">
                            {opt.desc}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded-xs bg-base-0 border border-border text-text-muted whitespace-nowrap">
                            {opt.badge}
                          </span>
                          {isSelected && (
                            <Check className="w-3 h-3 text-commito-coral shrink-0" />
                          )}
                        </div>
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
          <div className="flex items-center gap-2 p-2.5 bg-base-1/50 border border-border/70 rounded-sm">
            <Loader2 className="w-3.5 h-3.5 text-commito-coral animate-spin shrink-0" />
            <span className="text-xs text-text-muted font-medium flex-1">
              Thinking...
            </span>
            <button
              type="button"
              onClick={() => cancelRequest()}
              title="Cancel request"
              className="flex items-center gap-1 px-2 py-0.5 rounded-xs bg-base-2 border border-border/60 hover:border-commito-coral/50 hover:bg-commito-coral/10 text-text-muted hover:text-commito-coral transition text-[10px] font-medium cursor-pointer select-none"
            >
              <X className="w-3 h-3" />
              Stop
            </button>
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

        {/* Claude-style Rounded Input Composer */}
        <div className="relative flex flex-col bg-transparent border border-border hover:border-border-strong focus-within:border-border-strong rounded-sm p-2.5 transition">
          {/* Top: Multiline Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputVal}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI Agent about your code, diffs, branches"
            className="w-full bg-transparent resize-none border-none outline-none text-xs text-text-primary placeholder:text-text-muted/60 min-h-[32px] max-h-36 py-0.5 leading-relaxed font-sans scrollbar-thin"
          />

          {/* Bottom Toolbar */}
          <div className="flex items-center justify-between pt-1">
            {/* Left: Attach Menu (+) */}
            <div className="relative" ref={attachMenuRef}>
              <button
                type="button"
                onClick={() => setIsAttachMenuOpen((v) => !v)}
                className="w-6 h-6 flex items-center justify-center rounded-sm text-text-muted hover:text-commito-coral hover:bg-base-2/60 transition cursor-pointer"
                title="Attach Context (Git Diff / Terminal Output in TOON)"
              >
                <Plus className="w-4 h-4 stroke-[2]" />
              </button>

              {/* Attachment Dropdown Menu */}
              {isAttachMenuOpen && (
                <div className="absolute bottom-full left-0 mb-1.5 w-60 bg-base-1 border border-border rounded-sm shadow-2xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border/50 flex items-center justify-between">
                    <span>Attach Context (TOON)</span>
                    <span className="text-[9px] font-mono text-commito-coral">
                      Low Token
                    </span>
                  </div>

                  <div className="py-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsAttachMenuOpen(false);
                        await attachWorkingDiff();
                      }}
                      className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-base-2/70 text-left cursor-pointer transition text-text-primary group"
                    >
                      <FileCode className="w-3.5 h-3.5 text-commito-coral shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11.5px] font-medium">
                          Attach Git Diff
                        </div>
                        <div className="text-[10px] text-text-muted">
                          Working tree changes (TOON)
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        setIsAttachMenuOpen(false);
                        await attachTerminalHistory();
                      }}
                      className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-base-2/70 text-left cursor-pointer transition text-text-primary group"
                    >
                      <Terminal className="w-3.5 h-3.5 text-gitlab-blue shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11.5px] font-medium">
                          Attach Terminal History
                        </div>
                        <div className="text-[10px] text-text-muted">
                          Recent commands & outputs (TOON)
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Claude-style Send Button (ArrowUp) */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputVal.trim() || isThinking}
              className="w-7 h-7 rounded-xl bg-commito-coral hover:bg-commito-coralLight active:bg-commito-coral/90 disabled:opacity-25 disabled:hover:bg-commito-coral text-white flex items-center justify-center transition cursor-pointer active:scale-95 shadow-xs shrink-0"
              title="Send Message (Enter)"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Footer Hint with TOON Optimization Indicator */}
        <div className="flex items-center justify-between text-[10px] text-text-faint px-1 select-none">
          <span className="inline-flex items-center gap-1 text-emerald-400/90 font-mono">
            <Zap className="w-2.5 h-2.5" />
            <span>TOON Token Optimizer Active</span>
          </span>
          <span className="font-mono">{activeModelObj.name}</span>
        </div>
      </div>
    </aside>
  );
};
