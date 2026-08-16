import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, FolderGit2, FolderOpen, Plus } from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { Checkbox } from '../common/Checkbox';
import { Dropdown } from '../common/Dropdown';
import { SystemService } from '../../services/system/systemService';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';

const GITIGNORE_TEMPLATES = [
  { value: 'None', label: 'None' },
  { value: 'Node', label: 'Node (JavaScript / TypeScript)' },
  { value: 'Rust', label: 'Rust (Cargo)' },
  { value: 'Python', label: 'Python' },
  { value: 'C++', label: 'C++ / Visual Studio' },
  { value: 'Go', label: 'Go (Golang)' },
  { value: 'Java', label: 'Java (Maven / Gradle)' },
  { value: 'Unity', label: 'Unity 3D Engine' },
  { value: 'UnrealEngine', label: 'Unreal Engine' },
];

const LICENSE_TEMPLATES = [
  { value: 'None', label: 'None' },
  { value: 'MIT', label: 'MIT License' },
  { value: 'Apache-2.0', label: 'Apache License 2.0' },
  { value: 'GPL-3.0', label: 'GNU General Public License v3.0' },
];

/**
 * Modal dialogue for initializing a brand new local Git repository with optional README,
 * .gitignore preset, and Open Source license template.
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
  const [parentPath, setParentPath] = useState('E:\\Projects');
  const [description, setDescription] = useState('');
  const [initReadme, setInitReadme] = useState(true);
  const [gitignoreTemplate, setGitignoreTemplate] = useState('None');
  const [licenseTemplate, setLicenseTemplate] = useState('None');
  const [isCreating, setIsCreating] = useState(false);

  if (!isCreateRepoModalOpen) return null;

  const handleSelectParentFolder = async () => {
    try {
      const folder = await SystemService.selectFolder();
      if (folder) {
        setParentPath(folder);
      }
    } catch {
      // Silently ignore folder selection cancel
    }
  };

  const handleCreateRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const createdPath = await invoke<string>('create_repository_cmd', {
        opts: {
          name: name.trim(),
          parent_path: parentPath,
          description: description.trim() ? description.trim() : null,
          init_readme: initReadme,
          gitignore_template: gitignoreTemplate,
          license_template: licenseTemplate,
        },
      });

      useLogStore.getState().addLog('success', 'Git', `Created new local Git repository at '${createdPath}'`);

      setActiveRepoPath(createdPath);
      const statusRes = await GitService.getRepoStatus(createdPath);
      setStatus(statusRes);

      setIsCreateRepoModalOpen(false);
      setName('');
    } catch (error: unknown) {
      setError(toAppError(error, 'CREATE_REPO_ERROR'));
    } finally {
      setIsCreating(false);
    }
  };

  const fullDestinationPath = parentPath
    ? `${parentPath.replace(/[/\\]+$/, '')}\\${name.trim() || 'repository-name'}`
    : name.trim() || 'repository-name';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none">
      <div className="bg-base-0 border border-border rounded-md shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="h-12 bg-base-2 border-b border-border px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-commito-coral/15 border border-commito-coral/30 rounded-md text-commito-coral">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-text-primary">
              Create a New Repository
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateRepoModalOpen(false)}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-base-3 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleCreateRepository} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-5 space-y-4 text-xs font-sans text-text-primary bg-base-1 flex-1">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-text-primary mb-1">
                Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="repository name"
                className="w-full px-3 py-2 bg-base-0 border border-border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral font-medium"
                autoFocus
              />
            </div>

            {/* Local path */}
            <div>
              <label className="block text-xs font-bold text-text-primary mb-1">
                Local path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={parentPath}
                  onChange={(e) => setParentPath(e.target.value)}
                  className="flex-1 px-3 py-2 bg-base-0 border border-border rounded-md text-xs text-text-primary font-mono focus:outline-none focus:border-commito-coral"
                />
                <button
                  type="button"
                  onClick={handleSelectParentFolder}
                  className="px-3.5 py-2 bg-base-2 hover:bg-base-3 border border-border rounded-md text-xs font-semibold text-text-primary transition flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Choose...</span>
                </button>
              </div>
              <p className="text-[10px] text-text-muted font-mono mt-1 truncate">
                Will be created at: <span className="text-text-primary font-bold">{fullDestinationPath}</span>
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-text-primary mb-1">
                Description <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of your project"
                className="w-full px-3 py-2 bg-base-0 border border-border rounded-md text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-commito-coral"
              />
            </div>

            {/* Checkbox: Initialize README */}
            <div className="pt-1">
              <Checkbox
                checked={initReadme}
                onChange={setInitReadme}
                label="Initialize this repository with a README"
              />
            </div>

            {/* Git ignore dropdown */}
            <div>
              <label className="block text-xs font-bold text-text-primary mb-1">
                Git ignore
              </label>
              <Dropdown
                options={GITIGNORE_TEMPLATES}
                value={gitignoreTemplate}
                onChange={setGitignoreTemplate}
                className="w-full"
              />
            </div>

            {/* License dropdown */}
            <div>
              <label className="block text-xs font-bold text-text-primary mb-1">
                License
              </label>
              <Dropdown
                options={LICENSE_TEMPLATES}
                value={licenseTemplate}
                onChange={setLicenseTemplate}
                className="w-full"
              />
            </div>
          </div>

          {/* Buttons Footer Bar */}
          <div className="p-3.5 bg-base-2 border-t border-border flex items-center justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsCreateRepoModalOpen(false)}
              className="px-4 py-2 bg-base-3 hover:bg-base-2 border border-border rounded-md text-xs font-semibold text-text-muted hover:text-text-primary transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="px-4 py-2 bg-commito-coral hover:bg-commito-coralLight disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isCreating ? 'Creating Repository...' : 'Create Repository'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
