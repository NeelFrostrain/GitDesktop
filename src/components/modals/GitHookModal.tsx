import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Play,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  Clock,
  Terminal,
  FileCode,
  ShieldCheck,
  Sparkles,
  Loader2,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useToastStore } from '../../store/useToastStore';
import { useLogStore } from '../../store/useLogStore';
import { GitHookInfo, HookTestResult } from '../../types/git';
import { GitService } from '../../services/git/gitService';
import { getErrorMessage } from '../../shared/utils/errorUtils';

const STARTER_TEMPLATES: Record<string, { label: string; script: string; description: string }> = {
  eslint_prettier: {
    label: 'ESLint & Prettier Guard (Pre-Commit)',
    description: 'Runs linters and typecheck on staged code before allowing commit',
    script: `#!/bin/sh
# GitDesktop Pre-Commit Hook: Lint & Typecheck
echo "🔍 Running pre-commit linters..."

if command -v bun > /dev/null 2>&1; then
  bun run typecheck || exit 1
  bun run lint || exit 1
elif command -v npm > /dev/null 2>&1; then
  npm run typecheck || exit 1
  npm run lint || exit 1
fi

echo "✅ Pre-commit linters passed!"
exit 0
`,
  },
  conventional_commits: {
    label: 'Conventional Commits Validator (Commit-Msg)',
    description: 'Enforces conventional commit format (feat, fix, refactor, docs, chore, etc.)',
    script: `#!/bin/sh
# GitDesktop Commit-Msg Hook: Conventional Commits
COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Allow merge commits
if echo "$COMMIT_MSG" | grep -qE "^Merge branch"; then
  exit 0
fi

PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-zA-Z0-9_-]+\))?: .+"

if ! echo "$COMMIT_MSG" | grep -qE "$PATTERN"; then
  echo "❌ Error: Commit message does not follow Conventional Commits format!"
  echo "   Format: <type>(<optional scope>): <subject>"
  echo "   Examples:"
  echo "     feat(auth): add OAuth2 PKCE login"
  echo "     fix(diff): resolve side-by-side alignment"
  exit 1
fi

exit 0
`,
  },
  secrets_scanner: {
    label: 'Secrets & Private Keys Scanner (Pre-Commit)',
    description: 'Scans staged diffs for private keys, AWS tokens, and merge conflict markers',
    script: `#!/bin/sh
# GitDesktop Pre-Commit Hook: Secret & Conflict Marker Scanner
echo "🛡️ Scanning staged files for secrets & conflict markers..."

# Check for conflict markers
if git diff --cached --name-only | xargs grep -E "^(<<<<<<<|=======|>>>>>>>) " > /dev/null 2>&1; then
  echo "❌ Error: Merge conflict markers detected in staged files!"
  exit 1
fi

# Check for private keys / secrets
if git diff --cached | grep -E "BEGIN (RSA|OPENSSH|EC|DSA|PRIVATE) KEY" > /dev/null 2>&1; then
  echo "🚨 CRITICAL: Attempting to commit a private key! Commit rejected."
  exit 1
fi

echo "✅ Secret scan clean!"
exit 0
`,
  },
  protected_branch: {
    label: 'Protected Branch Push Guard (Pre-Push)',
    description: 'Blocks direct pushes to main/master branches to enforce PR/MR workflows',
    script: `#!/bin/sh
# GitDesktop Pre-Push Hook: Protect Main Branches
REMOTE="$1"
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)

if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  echo "❌ Error: Direct push to '$CURRENT_BRANCH' is prohibited!"
  echo "   Please create a feature branch and submit a Pull/Merge Request."
  exit 1
fi

echo "✅ Branch check passed."
exit 0
`,
  },
  branch_name_enforcer: {
    label: 'Branch Name Format Enforcer (Pre-Commit)',
    description: 'Enforces branch naming standards (e.g. feature/*, fix/*, hotfix/*, chore/*)',
    script: `#!/bin/sh
# GitDesktop Pre-Commit Hook: Branch Name Standard
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)

if [ -n "$BRANCH" ] && [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
  VALID_PATTERN="^(feature|fix|hotfix|chore|docs|refactor)\/[a-zA-Z0-9._-]+$"
  if ! echo "$BRANCH" | grep -qE "$VALID_PATTERN"; then
    echo "⚠️ Warning: Current branch '$BRANCH' does not follow convention '<type>/<name>'."
    echo "   Recommended: feature/xyz, fix/xyz, chore/xyz"
  fi
fi

exit 0
`,
  },
  submodule_sync: {
    label: 'Submodule & Dependency Sync (Post-Checkout)',
    description: 'Auto-syncs submodules and alerts if dependencies changed after branch switch',
    script: `#!/bin/sh
# GitDesktop Post-Checkout Hook: Sync Submodules
PREV_HEAD=$1
NEW_HEAD=$2
IS_BRANCH_CHECKOUT=$3

if [ "$IS_BRANCH_CHECKOUT" = "1" ]; then
  echo "🔄 Switched branch. Syncing submodules..."
  git submodule update --init --recursive 2>/dev/null
fi

exit 0
`,
  },
};

export const GitHookModal: React.FC = () => {
  const activeRepoPath = useGitStore((s) => s.activeRepoPath);
  const isHooksModalOpen = useGitStore((s) => s.isHooksModalOpen);
  const setIsHooksModalOpen = useGitStore((s) => s.setIsHooksModalOpen);

  const [hooks, setHooks] = useState<GitHookInfo[]>([]);
  const [selectedHookName, setSelectedHookName] = useState<string>('pre-commit');
  const [currentScript, setCurrentScript] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'editor' | 'test'>('editor');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Test Runner state
  const [testArgs, setTestArgs] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<HookTestResult | null>(null);

  const selectedHook = useMemo(
    () => hooks.find((h) => h.name === selectedHookName) || hooks[0],
    [hooks, selectedHookName]
  );

  const loadHooks = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);
    try {
      const data = await GitService.listHooks(activeRepoPath);
      setHooks(data);
      const current = data.find((h) => h.name === selectedHookName);
      if (current) {
        setCurrentScript(current.script_content);
      } else if (data.length > 0) {
        setSelectedHookName(data[0].name);
        setCurrentScript(data[0].script_content);
      }
    } catch (err) {
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Hooks Load Failed',
        message: getErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isHooksModalOpen && activeRepoPath) {
      loadHooks();
      setTestResult(null);
    }
  }, [isHooksModalOpen, activeRepoPath]);

  const handleSelectHook = (hook: GitHookInfo) => {
    setSelectedHookName(hook.name);
    setCurrentScript(hook.script_content);
    setTestResult(null);
  };

  const handleToggleHook = async (hook: GitHookInfo) => {
    if (!activeRepoPath) return;
    const newEnabled = !hook.enabled;
    try {
      await GitService.toggleHook(activeRepoPath, hook.name, newEnabled);
      useToastStore.getState().showToast({
        type: 'success',
        title: `Hook ${newEnabled ? 'Enabled' : 'Disabled'}`,
        message: `${hook.name} is now ${newEnabled ? 'active' : 'disabled'}.`,
      });
      loadHooks();
    } catch (err) {
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Hook Toggle Failed',
        message: getErrorMessage(err),
      });
    }
  };

  const handleSaveScript = async () => {
    if (!activeRepoPath || !selectedHook) return;
    setIsSaving(true);
    try {
      await GitService.saveHook(
        activeRepoPath,
        selectedHook.name,
        currentScript,
        selectedHook.enabled || true
      );
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Hook Saved',
        message: `Saved script for ${selectedHook.name}.`,
      });
      useLogStore
        .getState()
        .addLog('success', 'Git', `Updated Git hook script for '${selectedHook.name}'`);
      loadHooks();
    } catch (err) {
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Save Failed',
        message: getErrorMessage(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHook = async () => {
    if (!activeRepoPath || !selectedHook) return;
    if (!window.confirm(`Are you sure you want to delete the hook '${selectedHook.name}'?`)) return;
    try {
      await GitService.deleteHook(activeRepoPath, selectedHook.name);
      useToastStore.getState().showToast({
        type: 'info',
        title: 'Hook Deleted',
        message: `Deleted ${selectedHook.name}.`,
      });
      loadHooks();
    } catch (err) {
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Delete Failed',
        message: getErrorMessage(err),
      });
    }
  };

  const handleApplyTemplate = (templateKey: string) => {
    const tpl = STARTER_TEMPLATES[templateKey];
    if (tpl) {
      setCurrentScript(tpl.script);
      useToastStore.getState().showToast({
        type: 'info',
        title: 'Template Applied',
        message: `Applied ${tpl.label}. Click Save to persist.`,
      });
    }
  };

  const handleResetToDefault = () => {
    if (selectedHook?.default_template) {
      setCurrentScript(selectedHook.default_template);
    }
  };

  const handleRunTest = async () => {
    if (!activeRepoPath || !selectedHook) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const argsArray = testArgs
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await GitService.runHookTest(activeRepoPath, selectedHook.name, argsArray);
      setTestResult(res);
      useLogStore
        .getState()
        .addLog(
          res.success ? 'info' : 'warning',
          'Git',
          `Ran test for hook '${selectedHook.name}' (Exit: ${res.exit_code}, ${res.duration_ms}ms)`
        );
    } catch (err) {
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Test Execution Error',
        message: getErrorMessage(err),
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isHooksModalOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div
        className="flex flex-col w-full max-w-5xl h-[86vh] bg-surface-elevated border border-border rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-subtle/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-commito-coral/10 border border-commito-coral/30 flex items-center justify-center text-commito-coral shadow-2xs">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text">Git Hook Visualizer & Manager</h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-xs bg-surface-hover text-text-muted border border-border-subtle">
                  .git/hooks
                </span>
              </div>
              <p className="text-xs text-text-muted">
                Inspect, configure, and test automated lifecycle scripts for this repository.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsHooksModalOpen(false)}
            className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted hover:text-text transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left Hook Selector Sidebar + Right Main Workspace */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Column: Hook List & Category Groups */}
          <div className="w-72 border-r border-border bg-surface-subtle/40 flex flex-col shrink-0 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider">
                Lifecycle Hooks
              </span>
              <span className="text-[10px] font-mono text-text-muted">
                {hooks.filter((h) => h.enabled).length} active
              </span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-text-muted gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-commito-coral" />
                <span>Reading repository hooks...</span>
              </div>
            ) : (
              hooks.map((hook) => {
                const isSelected = hook.name === selectedHookName;
                return (
                  <div
                    key={hook.name}
                    onClick={() => handleSelectHook(hook)}
                    className={`flex items-start justify-between p-2.5 rounded-md border text-left cursor-pointer transition ${
                      isSelected
                        ? 'bg-surface-active border-commito-coral/50 shadow-xs'
                        : 'bg-surface-elevated/60 hover:bg-surface-hover border-border-subtle'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <span className="text-xs font-mono font-medium text-text truncate">
                          {hook.name}
                        </span>
                      </div>
                      <span className="text-[10.5px] text-text-muted line-clamp-1 mt-0.5">
                        {hook.category} • {hook.description}
                      </span>
                    </div>

                    {/* Enable / Disable Toggle Pill */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleHook(hook);
                      }}
                      title={hook.enabled ? 'Click to disable hook' : 'Click to enable hook'}
                      className={`shrink-0 px-2 py-0.5 text-[10px] font-mono font-medium rounded-full border transition cursor-pointer ${
                        hook.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-surface-subtle text-text-muted border-border hover:text-text'
                      }`}
                    >
                      {hook.enabled ? 'Active' : 'Off'}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Editor Workspace + Starter Templates + Live Test Runner */}
          {selectedHook ? (
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-surface">
              {/* Workspace Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-subtle/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-text">
                        {selectedHook.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-xs border ${
                          selectedHook.enabled
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-surface-subtle text-text-muted border-border'
                        }`}
                      >
                        {selectedHook.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {selectedHook.description}
                    </p>
                  </div>
                </div>

                {/* Tab Switcher: Script Editor vs Test Runner */}
                <div className="flex items-center gap-1.5 bg-surface-elevated p-0.5 rounded-md border border-border">
                  <button
                    type="button"
                    onClick={() => setActiveTab('editor')}
                    className={`px-2.5 py-1 rounded-sm text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'editor'
                        ? 'bg-surface-active text-text font-semibold shadow-2xs'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Script Editor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('test')}
                    className={`px-2.5 py-1 rounded-sm text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'test'
                        ? 'bg-surface-active text-text font-semibold shadow-2xs'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 text-commito-coral" />
                    <span>Test Run Hook</span>
                  </button>
                </div>
              </div>

              {/* Workspace Content */}
              {activeTab === 'editor' ? (
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  {/* Template & Action Toolbar */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-subtle/20 gap-2 shrink-0 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-commito-coral shrink-0" />
                      <span className="text-xs font-medium text-text-subtle">Starter Templates:</span>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleApplyTemplate(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                        className="text-xs bg-surface-elevated border border-border rounded-md px-2 py-1 text-text focus:outline-none focus:border-commito-coral cursor-pointer"
                      >
                        <option value="" disabled>
                          Select a starter recipe...
                        </option>
                        {Object.entries(STARTER_TEMPLATES).map(([key, tpl]) => (
                          <option key={key} value={key}>
                            {tpl.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleResetToDefault}
                        className="px-2 py-1 rounded-md text-[11px] font-medium text-text-muted hover:text-text bg-surface-elevated border border-border hover:bg-surface-hover transition cursor-pointer flex items-center gap-1"
                        title="Reset to default hook template"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Default</span>
                      </button>

                      {selectedHook.exists && (
                        <button
                          type="button"
                          onClick={handleDeleteHook}
                          className="px-2 py-1 rounded-md text-[11px] font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition cursor-pointer flex items-center gap-1"
                          title="Delete hook file"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleSaveScript}
                        disabled={isSaving}
                        className="px-3 py-1 rounded-md text-xs font-medium text-white bg-commito-coral hover:bg-commito-coral-hover transition cursor-pointer flex items-center gap-1 shadow-sm disabled:opacity-50"
                      >
                        {isSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>Save Hook</span>
                      </button>
                    </div>
                  </div>

                  {/* Script Code Area */}
                  <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
                    <textarea
                      value={currentScript}
                      onChange={(e) => setCurrentScript(e.target.value)}
                      spellCheck={false}
                      className="flex-1 w-full p-3 font-mono text-xs text-text bg-surface-subtle border border-border rounded-md focus:outline-none focus:border-commito-coral resize-none leading-relaxed scrollbar-thin select-text"
                      placeholder="#!/bin/sh\n# Enter shell script here..."
                    />
                  </div>
                </div>
              ) : (
                /* Test Runner Tab */
                <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto min-h-0 scrollbar-thin">
                  <div className="p-3 bg-surface-subtle/70 border border-border rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Terminal className="w-4 h-4 text-commito-coral" />
                        <span className="text-xs font-semibold text-text">Test Execution Settings</span>
                      </div>
                      <span className="text-[11px] text-text-muted">Runs in repo working directory</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={testArgs}
                        onChange={(e) => setTestArgs(e.target.value)}
                        placeholder="Sample CLI arguments (e.g. .git/COMMIT_EDITMSG or main)"
                        className="flex-1 px-3 py-1.5 text-xs font-mono bg-surface-elevated border border-border rounded-md text-text focus:outline-none focus:border-commito-coral"
                      />
                      <button
                        type="button"
                        onClick={handleRunTest}
                        disabled={isTesting}
                        className="px-4 py-1.5 text-xs font-medium text-white bg-commito-coral hover:bg-commito-coral-hover rounded-md transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {isTesting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>Run Test</span>
                      </button>
                    </div>
                  </div>

                  {/* Test Results Output */}
                  {testResult && (
                    <div className="flex-1 flex flex-col bg-surface-subtle border border-border rounded-md overflow-hidden min-h-[220px]">
                      {/* Result Bar */}
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-elevated/80">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border ${
                              testResult.success
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {testResult.success ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            <span>
                              {testResult.success
                                ? 'PASS (Exit 0)'
                                : `FAILED (Exit ${testResult.exit_code})`}
                            </span>
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] font-mono text-text-muted">
                          <Clock className="w-3 h-3" />
                          <span>{testResult.duration_ms}ms</span>
                        </div>
                      </div>

                      {/* Console Output */}
                      <div className="flex-1 p-3 font-mono text-xs space-y-2 overflow-y-auto select-text scrollbar-thin">
                        {testResult.stdout && (
                          <div>
                            <div className="text-[10px] text-text-muted uppercase font-semibold pb-1">
                              Stdout:
                            </div>
                            <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed bg-surface/80 p-2.5 rounded border border-border-subtle">
                              {testResult.stdout}
                            </pre>
                          </div>
                        )}

                        {testResult.stderr && (
                          <div>
                            <div className="text-[10px] text-rose-400 uppercase font-semibold pb-1">
                              Stderr:
                            </div>
                            <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed bg-rose-950/20 p-2.5 rounded border border-rose-500/30">
                              {testResult.stderr}
                            </pre>
                          </div>
                        )}

                        {!testResult.stdout && !testResult.stderr && (
                          <div className="text-text-muted italic py-4 text-center">
                            Hook executed silently with no console output.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
              Select a Git lifecycle hook from the sidebar to inspect or edit.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-border bg-surface-subtle/80 shrink-0 text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-text-muted" />
            <span>
              Hooks are saved to{' '}
              <code className="font-mono text-[11px] text-text">.git/hooks/</code> and run
              automatically during native Git commands.
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsHooksModalOpen(false)}
            className="px-3.5 py-1 text-xs font-medium text-text bg-surface-elevated hover:bg-surface-hover border border-border rounded-md transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
