import React, { useState, useEffect, useRef } from "react";
import {
  GitPullRequest,
  Tag,
  Sparkles,
  Terminal,
  AlertCircle,
  X,
  Globe,
  MoreHorizontal,
  PackagePlus,
  ExternalLink,
} from "lucide-react";
import { useGitStore } from "../../store/useGitStore";
import { useRemoteStore } from "../../store/remoteStore";
import { useTerminalStore } from "../../features/terminal/store/terminalStore";
import { useAiAgentStore } from "../../features/ai-agent";
import { SmartGitActionButton } from "./SmartGitActionButton";
import { BranchDropdown } from "./BranchDropdown";
import { SystemService } from "../../services/system/systemService";
import { getWebUrlFromRemoteUrl } from "../../shared/utils/urlUtils";

/**
 * Top application header bar displaying quick creation tools (Terminal, AI Agent, 3-dot actions),
 * active sync/fetch button, remote selector, and branch switcher.
 */
export const Header: React.FC = () => {
  const {
    activeRepoPath,
    error,
    setError,
    currentNavView,
    setIsMergeRequestModalOpen,
    setIsCreateTagModalOpen,
    setIsCreateReleaseModalOpen,
    setEditingRelease,
  } = useGitStore();

  const { remotes, activeRemote, setActiveRemote, loadRemotes } =
    useRemoteStore();

  const { isOpen: isTerminalOpen, toggleIsOpen: toggleTerminal } =
    useTerminalStore();

  const { isOpen: isAiAgentOpen, toggleIsOpen: toggleAiAgent } =
    useAiAgentStore();

  const headerRef = useRef<HTMLElement>(null);
  const [headerWidth, setHeaderWidth] = useState<number>(1000);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isRemoteMenuOpen, setIsRemoteMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const remoteMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRepoPath) {
      loadRemotes(activeRepoPath);
    }
  }, [activeRepoPath, loadRemotes]);

  // Dynamically detect header width to adjust button density smoothly
  useEffect(() => {
    if (!headerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderWidth(entry.contentRect.width);
      }
    });
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  const isWide = headerWidth >= 780;
  const isSlim = headerWidth < 560;

  // Close 3-dot and remote menus on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setIsMoreMenuOpen(false);
      }
      if (
        remoteMenuRef.current &&
        !remoteMenuRef.current.contains(e.target as Node)
      ) {
        setIsRemoteMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const isHome = currentNavView === "home";

  return (
    <header
      ref={headerRef}
      className="h-10 bg-base-0 border-b border-border px-2 flex items-center justify-between gap-3 flex-shrink-0 select-none relative z-40"
    >
      {/* Left: Quick Create Tools */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {!isHome && (
          <>
            {/* When full space is available: show individual quick-action buttons */}
            {isWide ? (
              <>
                {/* Draft Release */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingRelease(null);
                    setIsCreateReleaseModalOpen(true);
                  }}
                  className="h-7 w-7 flex items-center justify-center rounded-sm border border-border hover:border-border-strong bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-muted hover:text-commito-coral transition cursor-pointer active:scale-95 group shadow-2xs"
                  title="Draft Release..."
                >
                  <PackagePlus className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
                </button>

                {/* Create Tag */}
                <button
                  type="button"
                  onClick={() => setIsCreateTagModalOpen(true)}
                  className="h-7 w-7 flex items-center justify-center rounded-sm border border-border hover:border-border-strong bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-muted hover:text-amber-400 transition cursor-pointer active:scale-95 group shadow-2xs"
                  title="Create Git Tag..."
                >
                  <Tag className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
                </button>

                {/* Create Merge / Pull Request */}
                <button
                  type="button"
                  onClick={() => setIsMergeRequestModalOpen(true)}
                  className="h-7 w-7 flex items-center justify-center rounded-sm border border-border hover:border-border-strong bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-muted hover:text-commito-coral transition cursor-pointer active:scale-95 group shadow-2xs"
                  title="Create Merge / Pull Request"
                >
                  <GitPullRequest className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
                </button>
              </>
            ) : null}

            {/* Toggle Integrated Terminal */}
            <button
              type="button"
              onClick={toggleTerminal}
              className={`h-7 w-7 flex items-center justify-center rounded-sm border transition cursor-pointer active:scale-95 group shadow-2xs shrink-0 ${
                isTerminalOpen
                  ? "border-border-strong bg-base-2 text-commito-coral"
                  : "border-border hover:border-border-strong bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-muted hover:text-commito-coral"
              }`}
              title="Open in Integrated Terminal (`)"
            >
              <Terminal className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
            </button>

            {/* Toggle AI Git Agent (adapts to icon-only on slim widths) */}
            <button
              type="button"
              onClick={toggleAiAgent}
              className={`h-7 flex items-center justify-center gap-1.5 rounded-sm border whitespace-nowrap transition cursor-pointer active:scale-95 group shadow-2xs shrink-0 ${
                isSlim ? "w-7 px-0" : "px-2.5"
              } ${
                isAiAgentOpen
                  ? "border-border-strong bg-base-2 text-commito-coral font-semibold"
                  : "border-border hover:border-border-strong bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-secondary hover:text-commito-coral font-medium"
              }`}
              title="AI Git Agent (Ctrl+I)"
            >
              {isSlim && (
                <Sparkles className="w-3.5 h-3.5 text-commito-coral shrink-0" />
              )}
              {!isSlim && (
                <span className="text-[11.5px] leading-none">AI Agent</span>
              )}
            </button>

            {/* 3-Dot More Actions Dropdown (shown when not full wide mode) */}
            {!isWide && (
              <div className="relative shrink-0" ref={moreMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen((v) => !v)}
                  className={`h-7 w-7 flex items-center justify-center rounded-sm border transition cursor-pointer active:scale-95 group shadow-2xs ${
                    isMoreMenuOpen
                      ? "border-border-strong bg-base-2 text-text-primary"
                      : "border-border hover:border-border-strong bg-base-1 hover:bg-base-2 active:bg-base-3 text-text-muted hover:text-text-primary"
                  }`}
                  title="More repository actions..."
                >
                  <MoreHorizontal className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
                </button>

                {isMoreMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 w-52 bg-base-1 border border-border rounded-sm shadow-2xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border/50">
                      Repository Actions
                    </div>

                    <div className="py-1 space-y-0.5">
                      {/* Draft Release */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRelease(null);
                          setIsCreateReleaseModalOpen(true);
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left text-text-secondary hover:text-commito-coral hover:bg-base-2 cursor-pointer transition"
                      >
                        <PackagePlus className="w-3.5 h-3.5 text-commito-coral shrink-0" />
                        <span className="text-[11.5px] font-medium">
                          Draft Release...
                        </span>
                      </button>

                      {/* Create Tag */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreateTagModalOpen(true);
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left text-text-secondary hover:text-amber-400 hover:bg-base-2 cursor-pointer transition"
                      >
                        <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-[11.5px] font-medium">
                          Create Git Tag...
                        </span>
                      </button>

                      {/* Create Merge / Pull Request */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsMergeRequestModalOpen(true);
                          setIsMoreMenuOpen(false);
                        }}
                        className="w-full px-2.5 py-1.5 flex items-center gap-2 text-left text-text-secondary hover:text-commito-coral hover:bg-base-2 cursor-pointer transition"
                      >
                        <GitPullRequest className="w-3.5 h-3.5 text-commito-coral shrink-0" />
                        <span className="text-[11.5px] font-medium">
                          Create Pull / Merge Request
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Right: Sync, Push, Branch & PR Action Group */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {error &&
          !error.message?.includes("No remote configured") &&
          !error.message?.includes("Not authenticated") && (
            <div
              className="flex items-center gap-1 text-[11px] text-git-removed bg-git-removed-bg border border-git-removed/40 px-2 py-0.5 rounded-sm max-w-xs truncate"
              title={error.message}
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{error.message}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-1 hover:text-text-primary p-0.5"
                aria-label="Dismiss error"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

        {!isHome && (
          <>
            {/* Sync / Push Smart Button */}
            <SmartGitActionButton />

            {/* Remote Web Browser Redirect Button */}
            {remotes.length > 0 && (
              <div className="relative shrink-0" ref={remoteMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (remotes.length === 1) {
                      const webUrl = getWebUrlFromRemoteUrl(remotes[0].url);
                      if (webUrl) SystemService.openInBrowser(webUrl);
                    } else {
                      setIsRemoteMenuOpen((v) => !v);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setIsRemoteMenuOpen(true);
                  }}
                  className="h-7 w-7 flex items-center justify-center rounded-sm bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong text-text-muted hover:text-commito-coral transition cursor-pointer active:scale-95 shadow-2xs group"
                  title={
                    remotes.length === 1
                      ? `Open ${remotes[0].name} in browser (${remotes[0].url})`
                      : `Open Remote in Browser (${remotes.length} remotes available)`
                  }
                >
                  <Globe className="w-3.5 h-3.5 group-hover:scale-105 transition-transform" />
                </button>

                {/* Remote Options Menu (when multiple remotes exist or opened) */}
                {isRemoteMenuOpen && (
                  <div className="absolute top-full right-0 mt-1 w-64 bg-base-1 border border-border rounded-sm shadow-2xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border/50 flex items-center justify-between">
                      <span>Open Remote in Browser</span>
                      <span className="text-[9px] font-mono text-commito-coral">Web</span>
                    </div>

                    <div className="py-1">
                      {remotes.map((r) => {
                        const webUrl = getWebUrlFromRemoteUrl(r.url);
                        const isCurrent =
                          r.name === (activeRemote || remotes[0]?.name);
                        return (
                          <button
                            key={r.name}
                            type="button"
                            onClick={() => {
                              setActiveRemote(r.name);
                              setIsRemoteMenuOpen(false);
                              if (webUrl) SystemService.openInBrowser(webUrl);
                            }}
                            className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 hover:bg-base-2 text-left cursor-pointer transition group/item"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-mono text-xs font-semibold text-text-primary flex items-center gap-1.5">
                                <span>{r.name}</span>
                                {isCurrent && (
                                  <span className="text-[9px] px-1 py-0.2 rounded-xs bg-base-0 border border-border text-commito-coral font-sans">
                                    active
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-text-muted truncate font-mono mt-0.5">
                                {r.url}
                              </div>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-text-muted group-hover/item:text-commito-coral shrink-0 transition" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active Branch Switcher */}
            <BranchDropdown />
          </>
        )}
      </div>
    </header>
  );
};
