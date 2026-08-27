import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  FolderGit2,
  FolderOpen,
  Plus,
  Loader2,
  AlertCircle,
  FileCode,
  Scale,
  FileText,
  Folder,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { Dropdown } from '../common/Dropdown';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SystemService } from '../../services/system/systemService';
import { GitService } from '../../services/git/gitService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';

const GITIGNORE_TEMPLATES = [
  { value: 'None', label: 'None (No .gitignore)' },
  { value: 'Node', label: 'Node (JavaScript / TypeScript / React)' },
  { value: 'Rust', label: 'Rust (Cargo / target)' },
  { value: 'Python', label: 'Python (__pycache__ / venv)' },
  { value: 'Go', label: 'Go (Golang binaries)' },
  { value: 'C++', label: 'C++ / Visual Studio / CMake' },
  { value: 'Java', label: 'Java (Maven / Gradle / .class)' },
  { value: 'Unity', label: 'Unity 3D Engine' },
  { value: 'UnrealEngine', label: 'Unreal Engine' },
];

const GITIGNORE_QUICK_CHIPS = ['None', 'Node', 'Rust', 'Python', 'Go', 'C++', 'Unity'];

const LICENSE_TEMPLATES = [
  { value: 'None', label: 'None (All Rights Reserved)' },
  { value: 'MIT', label: 'MIT License (Permissive & Common)' },
  { value: 'Apache-2.0', label: 'Apache License 2.0 (Patents & Trademarks)' },
  { value: 'GPL-3.0', label: 'GNU General Public License v3.0 (Copyleft)' },
  { value: 'GPL-2.0', label: 'GNU General Public License v2.0 (Legacy Copyleft)' },
  { value: 'AGPL-3.0', label: 'GNU Affero General Public License v3.0 (Network Copyleft)' },
  { value: 'LGPL-3.0', label: 'GNU Lesser General Public License v3.0 (Weak Copyleft)' },
  { value: 'BSD-2-Clause', label: 'BSD 2-Clause "Simplified" License' },
  { value: 'BSD-3-Clause', label: 'BSD 3-Clause "New" / "Revised" License' },
  { value: '0BSD', label: 'BSD Zero Clause License (Public Domain Equivalent)' },
  { value: 'ISC', label: 'ISC License (Permissive & Minimal)' },
  { value: 'MPL-2.0', label: 'Mozilla Public License 2.0 (File-based Copyleft)' },
  { value: 'Unlicense', label: 'The Unlicense (Public Domain Dedication)' },
  { value: 'CC0-1.0', label: 'Creative Commons Zero v1.0 Universal (Public Domain)' },
  { value: 'BSL-1.0', label: 'Boost Software License 1.0' },
  { value: 'EPL-2.0', label: 'Eclipse Public License 2.0' },
  { value: 'WTFPL', label: 'WTFPL (Do What The F*ck You Want To)' },
];

const LICENSE_QUICK_CHIPS = ['None', 'MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC', 'Unlicense'];

/**
 * Modern modal dialog for initializing a new local Git repository with customizable
 * README, .gitignore presets, and open-source licenses.
 */
export const CreateRepoModal: React.FC = () => {
  const {
    isCreateRepoModalOpen,
    setIsCreateRepoModalOpen,
    setActiveRepoPath,
    setStatus,
    setError,
  } = useGitStore();

  const [name, setName] = useState('');
  const [parentPath, setParentPath] = useState(() => {
    try {
      return localStorage.getItem('last_repo_parent_path') || 'E:\\Projects';
    } catch {
      return 'E:\\Projects';
    }
  });
  const [description, setDescription] = useState('');
  const [initReadme, setInitReadme] = useState(true);
  const [gitignoreTemplate, setGitignoreTemplate] = useState('None');
  const [licenseTemplate, setLicenseTemplate] = useState('None');
  const [isCreating, setIsCreating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const isDirty = name.trim() !== '' || description.trim() !== '';

  const { showConfirm, requestClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard({
    isDirty,
    onClose: () => setIsCreateRepoModalOpen(false),
  });

  useEffect(() => {
    if (isCreateRepoModalOpen) {
      setName('');
      setDescription('');
      setLocalError(null);
      setIsCreating(false);
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 60);
    }
  }, [isCreateRepoModalOpen]);

  if (!isCreateRepoModalOpen) return null;

  // Validation
  const hasInvalidChars = /[/\\:*?"<>|]/.test(name);
  const cleanName = name.trim();

  const handleSelectParentFolder = async () => {
    try {
      const folder = await SystemService.selectFolder();
      if (folder) {
        setParentPath(folder);
        try {
          localStorage.setItem('last_repo_parent_path', folder);
        } catch {}
      }
    } catch {
      // Silently ignore cancel
    }
  };

  const handleCreateRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanName || isCreating || hasInvalidChars) return;

    setIsCreating(true);
    setLocalError(null);

    try {
      const createdPath = await invoke<string>('create_repository_cmd', {
        opts: {
          name: cleanName,
          parent_path: parentPath,
          description: description.trim() ? description.trim() : null,
          init_readme: initReadme,
          gitignore_template: gitignoreTemplate !== 'None' ? gitignoreTemplate : null,
          license_template: licenseTemplate !== 'None' ? licenseTemplate : null,
        },
      });

      useLogStore
        .getState()
        .addLog('success', 'Git', `Created new local repository at '${createdPath}'`);

      setActiveRepoPath(createdPath);
      const statusRes = await GitService.getRepoStatus(createdPath);
      setStatus(statusRes);

      setIsCreateRepoModalOpen(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setLocalError(msg);
      setError(toAppError(err, 'CREATE_REPO_ERROR'));
    } finally {
      setIsCreating(false);
    }
  };

  const sanitizedPreviewName = cleanName || 'repository-name';
  const fullDestinationPath = parentPath
    ? `${parentPath.replace(/[/\\]+$/, '')}\\${sanitizedPreviewName}`
    : sanitizedPreviewName;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-repo-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCreating) {
          requestClose();
        }
      }}
      className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-100"
    >
      <div
        className="w-full max-w-xl bg-base-0 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-border bg-base-1 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0">
              <FolderGit2 className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h2
                id="create-repo-modal-title"
                className="text-xs font-bold text-text-primary leading-none"
              >
                Create a New Repository
              </h2>
              <span className="text-border">•</span>
              <span className="text-[10.5px] text-text-muted">Local Git workspace</span>
            </div>
          </div>

          <button
            type="button"
            onClick={requestClose}
            className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-base-2 transition cursor-pointer shrink-0"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreateRepository} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 text-xs font-sans text-text-primary bg-base-0">
            {/* Error Message */}
            {localError && (
              <div className="flex items-start gap-2 p-2.5 rounded-sm bg-git-removed-bg border border-git-removed/40 text-git-removed text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Creation Failed</p>
                  <p className="text-[11px] opacity-90">{localError}</p>
                </div>
              </div>
            )}

            {/* 1. Repository Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary flex items-center gap-1">
                  <span>Repository Name</span>
                  <span className="text-commito-coral">*</span>
                </label>
                {hasInvalidChars && (
                  <span className="text-[11px] text-git-removed font-normal">
                    Cannot contain / \ : * ? &quot; &lt; &gt; |
                  </span>
                )}
              </div>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (localError) setLocalError(null);
                }}
                placeholder="e.g. my-awesome-app"
                className={`w-full h-8 px-2.5 bg-base-1 border rounded-sm text-xs text-text-primary/90 placeholder:text-text-muted/60 font-sans focus:outline-none transition shadow-2xs ${
                  hasInvalidChars
                    ? 'border-git-removed focus:border-git-removed'
                    : 'border-border hover:border-border-strong focus:border-commito-coral focus:ring-1 focus:ring-commito-coral/20'
                }`}
              />
            </div>

            {/* 2. Local Path Selector & Destination Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary flex items-center gap-1">
                  <span>Local Destination Path</span>
                  <span className="text-commito-coral">*</span>
                </label>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  required
                  value={parentPath}
                  onChange={(e) => setParentPath(e.target.value)}
                  className="flex-1 h-8 px-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs font-mono text-text-primary/90 placeholder:text-text-muted/60 focus:outline-none transition shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleSelectParentFolder}
                  className="h-8 px-3 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-xs font-medium text-text-secondary hover:text-text-primary transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Browse local directory"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Choose...</span>
                </button>
              </div>

              {/* Destination Path Preview Card */}
              <div className="px-2.5 py-1.5 bg-base-1/60 border border-border/60 rounded-sm flex items-center gap-2 text-[11px] text-text-muted font-mono truncate">
                <Folder className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span className="text-text-muted shrink-0">Will be created at:</span>
                <span className="text-text-secondary font-medium truncate" title={fullDestinationPath}>
                  {fullDestinationPath}
                </span>
              </div>
            </div>

            {/* 3. Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-secondary flex items-center gap-1">
                  <span>Description</span>
                  <span className="text-text-muted font-normal text-[11px]">(optional)</span>
                </label>
              </div>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of your repository or project"
                className="w-full h-8 px-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary/90 placeholder:text-text-muted/60 focus:outline-none transition shadow-2xs font-sans"
              />
            </div>

            {/* 4. Initialization Options */}
            <div className="pt-2 border-t border-border/60 space-y-3">
              <div className="text-xs font-semibold text-text-secondary">
                Initialization Options
              </div>

              {/* Option Card: Initialize with README */}
              <div
                onClick={() => setInitReadme(!initReadme)}
                className={`p-2.5 rounded-sm border transition cursor-pointer flex items-center justify-between gap-3 select-none ${
                  initReadme
                    ? 'bg-sky-500/5 border-sky-500/35 shadow-2xs'
                    : 'bg-base-1/50 border-border hover:bg-base-1'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xs flex items-center justify-center shrink-0 transition ${
                      initReadme
                        ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                        : 'bg-base-0 text-text-muted border border-border'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-text-primary/90 flex items-center gap-1.5 leading-none">
                      <span>Initialize with README.md</span>
                      {initReadme && (
                        <span className="px-1.5 py-0.2 bg-sky-500/15 text-sky-400 text-[9px] font-bold rounded-xs border border-sky-500/30">
                          README
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted mt-1 leading-none">
                      Creates an initial README file with your repository title and description
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <div
                  className={`relative inline-flex items-center w-7.5 h-4 rounded-xs px-0.5 border transition-colors shrink-0 ${
                    initReadme ? 'bg-sky-500 border-sky-500' : 'bg-base-2 border-border'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-xs bg-white transition-transform duration-150 shadow-2xs ${
                      initReadme ? 'translate-x-3' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              {/* Gitignore Template */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-violet-400" />
                    <span>Git ignore template</span>
                  </label>
                </div>
                <Dropdown
                  options={GITIGNORE_TEMPLATES}
                  value={gitignoreTemplate}
                  onChange={setGitignoreTemplate}
                  className="w-full"
                />
                {/* Quick Chips */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] font-mono text-text-faint mr-0.5">Quick:</span>
                  {GITIGNORE_QUICK_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setGitignoreTemplate(chip)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                        gitignoreTemplate === chip
                          ? 'bg-commito-coral/20 text-commito-coral border border-commito-coral/40 font-semibold'
                          : 'bg-base-1 text-text-muted hover:text-text-primary border border-border/60 hover:bg-base-2'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* License Template */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-emerald-400" />
                    <span>License</span>
                  </label>
                </div>
                <Dropdown
                  options={LICENSE_TEMPLATES}
                  value={licenseTemplate}
                  onChange={setLicenseTemplate}
                  className="w-full"
                />
                {/* Quick Chips */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] font-mono text-text-faint mr-0.5">Quick:</span>
                  {LICENSE_QUICK_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setLicenseTemplate(chip)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                        licenseTemplate === chip
                          ? 'bg-commito-coral/20 text-commito-coral border border-commito-coral/40 font-semibold'
                          : 'bg-base-1 text-text-muted hover:text-text-primary border border-border/60 hover:bg-base-2'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-3 bg-base-1 border-t border-border flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={requestClose}
              disabled={isCreating}
              className="px-3.5 py-1.5 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-xs font-medium text-text-subtle hover:text-text-primary transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !cleanName || hasInvalidChars}
              className="px-4 py-1.5 bg-commito-coral hover:bg-commito-coralLight disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-98"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Repository...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Repository</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      <ConfirmDialog
        isOpen={showConfirm}
        title="Discard Repository Configuration?"
        description="You have unsaved repository configuration. If you leave now, your entries will be discarded."
        cancelText="Keep Editing"
        discardText="Discard & Close"
        onDiscard={confirmDiscard}
        onCancel={cancelDiscard}
        variant="danger"
      />
    </div>,
    document.body
  );
};

