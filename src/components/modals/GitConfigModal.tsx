import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  Settings,
  FileCode,
  Save,
  Wrench,
  Plus,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitConfigItem } from '../../types/git';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';

const GITIGNORE_TEMPLATES: Record<string, string> = {
  'Node.js / React': `# Node / JS / React
node_modules/
dist/
build/
.env
.env.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
`,
  'Rust / Cargo': `# Rust
target/
**/*.rs.bk
Cargo.lock
`,
  'Python': `# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
.env
`,
  'Unreal Engine / Unity': `# Unreal & Unity
Binaries/
DerivedDataCache/
Intermediate/
Saved/
Build/
Library/
Temp/
Obj/
Logs/
`,
};

/**
 * Modal dialogue for editing repository .gitignore rules and inspecting/setting local Git configuration keys.
 */
export const GitConfigModal: React.FC = () => {
  const {
    activeRepoPath,
    isConfigModalOpen,
    setIsConfigModalOpen,
    setError,
  } = useGitStore();

  const [activeTab, setActiveTab] = useState<'gitignore' | 'config'>('gitignore');
  const [gitignoreContent, setGitignoreContent] = useState('');
  const [configItems, setConfigItems] = useState<GitConfigItem[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isConfigModalOpen || !activeRepoPath) return;

    // Load .gitignore
    invoke<string>('read_gitignore_cmd', { repoPath: activeRepoPath })
      .then((content) => setGitignoreContent(content || ''))
      .catch(() => setGitignoreContent(''));

    // Load repo git config
    GitService.getRepoConfig(activeRepoPath)
      .then((items) => setConfigItems(items || []))
      .catch(() => setConfigItems([]));
  }, [isConfigModalOpen, activeRepoPath]);

  const handleSaveGitignore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath) return;

    setIsSubmitting(true);
    try {
      await invoke('write_gitignore_cmd', {
        repoPath: activeRepoPath,
        content: gitignoreContent,
      });

      useLogStore.getState().addLog('success', 'Git', 'Updated repository .gitignore file');
      setIsConfigModalOpen(false);
    } catch (error: unknown) {
      setError(toAppError(error, 'CONFIG_ERROR'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTemplate = (templateName: string) => {
    const templateText = GITIGNORE_TEMPLATES[templateName] || '';
    setGitignoreContent((prev) => `${prev}\n\n${templateText}`.trim());
  };

  const handleSaveConfigItem = async (key: string, val: string) => {
    if (!activeRepoPath || !key.trim()) return;

    try {
      await GitService.setRepoConfig(activeRepoPath, key.trim(), val.trim());
      useLogStore.getState().addLog('info', 'Git', `Set repo config ${key} = ${val}`);

      const items = await GitService.getRepoConfig(activeRepoPath);
      setConfigItems(items || []);
      setNewKey('');
      setNewValue('');
    } catch (error: unknown) {
      setError(toAppError(error, 'CONFIG_ERROR'));
    }
  };

  if (!isConfigModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-md shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-base-0 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-commito-coral/20 border border-commito-coral/40 text-commito-coral flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary leading-tight">
                Repository Settings & Git Config
              </h2>
              <p className="text-[11px] text-text-muted">
                Manage .gitignore patterns and repo-scoped git configuration options
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsConfigModalOpen(false)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Header */}
        <div className="px-5 pt-3 pb-2 border-b border-border flex items-center gap-2 bg-base-0/50">
          <button
            onClick={() => setActiveTab('gitignore')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'gitignore'
                ? 'bg-commito-coral hover:bg-commito-coralLight text-white shadow-xs'
                : 'bg-base-2 text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>.gitignore Editor</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'config'
                ? 'bg-commito-coral hover:bg-commito-coralLight text-white shadow-xs'
                : 'bg-base-2 text-text-secondary hover:text-text-primary'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Repo Git Config</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'gitignore' ? (
            <form onSubmit={handleSaveGitignore} className="space-y-4 flex flex-col h-full">
              {/* Template Preset Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-text-muted">Append Template:</span>
                {Object.keys(GITIGNORE_TEMPLATES).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleAddTemplate(name)}
                    className="px-2.5 py-1 bg-base-2 hover:bg-base-3 border border-border rounded text-[11px] font-semibold text-text-secondary transition cursor-pointer"
                  >
                    + {name}
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <div className="flex-1 min-h-[300px]">
                <textarea
                  value={gitignoreContent}
                  onChange={(e) => setGitignoreContent(e.target.value)}
                  className="w-full h-full p-4 bg-base-2 border border-border rounded-md font-mono text-xs text-text-primary focus:outline-none focus:border-commito-coral resize-none"
                  placeholder="# Add patterns to ignore..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-4 py-2 bg-base-2 hover:bg-base-3 border border-border rounded-md text-xs font-semibold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-commito-coral hover:bg-commito-coralLight text-white rounded-md text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save .gitignore</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Add New Config Property */}
              <div className="p-3.5 bg-base-2 border border-border rounded-md space-y-2">
                <h4 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-commito-coral" />
                  <span>Set Repo Config Property</span>
                </h4>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Key (e.g. user.email)"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-base-1 border border-border rounded-md text-xs font-mono text-text-primary focus:outline-none focus:border-commito-coral"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. dev@company.com)"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-base-1 border border-border rounded-md text-xs font-mono text-text-primary focus:outline-none focus:border-commito-coral"
                  />
                  <button
                    onClick={() => handleSaveConfigItem(newKey, newValue)}
                    disabled={!newKey.trim()}
                    className="px-3.5 py-1.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-md text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Config Table */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-text-muted px-1">
                  Local Repository Config Entries ({configItems.length})
                </div>

                {configItems.length === 0 ? (
                  <div className="p-6 text-center bg-base-2 border border-border rounded-md text-xs text-text-muted italic">
                    No custom local git config entries found
                  </div>
                ) : (
                  configItems.map((item) => (
                    <div
                      key={item.key}
                      className="p-3 bg-base-2/60 border border-border rounded-md flex items-center justify-between font-mono text-xs"
                    >
                      <span className="font-bold text-commito-coral">{item.key}</span>
                      <span className="text-text-primary">{item.value}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
