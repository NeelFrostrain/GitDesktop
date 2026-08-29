import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  FolderPlus,
  FolderOpen,
  Plus,
  Loader2,
  AlertCircle,
  FileCode,
  Scale,
  FileText,
  Folder,
} from "lucide-react";
import { useGitStore } from "../../store/useGitStore";
import { useLogStore } from "../../store/useLogStore";
import { Dropdown } from "../common/Dropdown";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { SystemService } from "../../services/system/systemService";
import { GitService } from "../../services/git/gitService";
import { toAppError, getErrorMessage } from "../../shared/utils/errorUtils";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard";

const GITIGNORE_TEMPLATES = [
  { value: "None", label: "None (No .gitignore)" },
  { value: "Node", label: "Node (JavaScript / TypeScript / React)" },
  { value: "Rust", label: "Rust (Cargo / target)" },
  { value: "Python", label: "Python (__pycache__ / venv)" },
  { value: "Go", label: "Go (Golang binaries)" },
  { value: "C++", label: "C++ / Visual Studio / CMake" },
  { value: "Java", label: "Java (Maven / Gradle / .class)" },
  { value: "Unity", label: "Unity 3D Engine" },
  { value: "UnrealEngine", label: "Unreal Engine" },
];

const LICENSE_TEMPLATES = [
  { value: "None", label: "None (All Rights Reserved)" },
  { value: "MIT", label: "MIT License (Permissive & Common)" },
  { value: "Apache-2.0", label: "Apache License 2.0 (Patents & Trademarks)" },
  { value: "GPL-3.0", label: "GNU General Public License v3.0 (Copyleft)" },
  { value: "GPL-2.0", label: "GNU General Public License v2.0 (Legacy)" },
  { value: "AGPL-3.0", label: "GNU Affero GPL v3.0 (Network Copyleft)" },
  { value: "BSD-3-Clause", label: "BSD 3-Clause License" },
  { value: "BSD-2-Clause", label: "BSD 2-Clause License" },
  { value: "ISC", label: "ISC License (Minimal)" },
  { value: "MPL-2.0", label: "Mozilla Public License 2.0" },
  { value: "Unlicense", label: "The Unlicense (Public Domain)" },
  { value: "CC0-1.0", label: "Creative Commons Zero v1.0 (Public Domain)" },
];

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

  const [name, setName] = useState("");
  const [parentPath, setParentPath] = useState(() => {
    try {
      return localStorage.getItem("last_repo_parent_path") || "E:\\Projects";
    } catch {
      return "E:\\Projects";
    }
  });
  const [description, setDescription] = useState("");
  const [initReadme, setInitReadme] = useState(true);
  const [gitignoreTemplate, setGitignoreTemplate] = useState("None");
  const [licenseTemplate, setLicenseTemplate] = useState("None");
  const [isCreating, setIsCreating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const isDirty = name.trim() !== "" || description.trim() !== "";

  const { showConfirm, requestClose, confirmDiscard, cancelDiscard } =
    useUnsavedChangesGuard({
      isDirty,
      onClose: () => setIsCreateRepoModalOpen(false),
    });

  useEffect(() => {
    if (isCreateRepoModalOpen) {
      setName("");
      setDescription("");
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
          localStorage.setItem("last_repo_parent_path", folder);
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
      const createdPath = await invoke<string>("create_repository_cmd", {
        opts: {
          name: cleanName,
          parent_path: parentPath,
          description: description.trim() ? description.trim() : null,
          init_readme: initReadme,
          gitignore_template:
            gitignoreTemplate !== "None" ? gitignoreTemplate : null,
          license_template: licenseTemplate !== "None" ? licenseTemplate : null,
        },
      });

      useLogStore
        .getState()
        .addLog(
          "success",
          "Git",
          `Created new local repository at '${createdPath}'`,
        );

      setActiveRepoPath(createdPath);
      const statusRes = await GitService.getRepoStatus(createdPath);
      setStatus(statusRes);

      setIsCreateRepoModalOpen(false);
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setLocalError(msg);
      setError(toAppError(err, "CREATE_REPO_ERROR"));
    } finally {
      setIsCreating(false);
    }
  };

  const sanitizedPreviewName = cleanName || "repository-name";
  const fullDestinationPath = parentPath
    ? `${parentPath.replace(/[/\\]+$/, "")}\\${sanitizedPreviewName}`
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
      className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none animate-in fade-in duration-100"
    >
      <div
        className="w-full max-w-lg bg-base-0 border border-border rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-border bg-base-1/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6.5 h-6.5 rounded-sm bg-commito-coral/15 border border-commito-coral/30 flex items-center justify-center text-commito-coral shrink-0">
              <FolderPlus className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2
                id="create-repo-modal-title"
                className="text-xs font-bold text-text-primary leading-tight"
              >
                Create a New Repository
              </h2>
              <p className="text-[10.5px] text-text-muted mt-0.2">
                Initialize a Git repository in your local filesystem
              </p>
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
        <form
          onSubmit={handleCreateRepository}
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-xs font-sans text-text-primary bg-base-0 scrollbar-thin">
            {/* Error Banner */}
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
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11.5px] font-medium text-text-secondary">
                  Repository Name <span className="text-commito-coral">*</span>
                </label>
                {hasInvalidChars && (
                  <span className="text-[10.5px] text-git-removed">
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
                className={`w-full h-8 px-2.5 bg-base-1 border rounded-sm text-xs text-text-primary placeholder:text-text-muted/60 font-sans focus:outline-none transition shadow-2xs ${
                  hasInvalidChars
                    ? "border-git-removed focus:border-git-removed"
                    : "border-border hover:border-border-strong focus:border-commito-coral"
                }`}
              />
            </div>

            {/* 2. Destination Path */}
            <div className="space-y-1">
              <label className="text-[11.5px] font-medium text-text-secondary block">
                Local Destination Path{" "}
                <span className="text-commito-coral">*</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  required
                  value={parentPath}
                  onChange={(e) => setParentPath(e.target.value)}
                  className="flex-1 h-8 px-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs font-mono text-text-primary placeholder:text-text-muted/60 focus:outline-none transition shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleSelectParentFolder}
                  className="h-8 px-3 bg-base-1 hover:bg-base-2 border border-border hover:border-border-strong rounded-sm text-xs font-medium text-text-secondary hover:text-text-primary transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                  title="Browse local directory"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Choose...</span>
                </button>
              </div>

              {/* Destination Path Preview */}
              <div className="pt-0.5 flex items-center gap-1.5 text-[10.5px] text-text-muted font-mono truncate">
                <Folder className="w-3 h-3 text-text-muted shrink-0" />
                <span className="shrink-0 text-text-faint">Path:</span>
                <span
                  className="text-text-secondary truncate"
                  title={fullDestinationPath}
                >
                  {fullDestinationPath}
                </span>
              </div>
            </div>

            {/* 3. Description */}
            <div className="space-y-1">
              <label className="text-[11.5px] font-medium text-text-secondary flex items-center justify-between">
                <span>Description</span>
                <span className="text-text-muted/70 font-normal text-[10.5px]">
                  optional
                </span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of your repository or project"
                className="w-full h-8 px-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none transition shadow-2xs font-sans"
              />
            </div>

            {/* 4. Initialization Options Card */}
            <div className="p-3 bg-base-1/50 border border-border/70 rounded-sm space-y-3 shadow-2xs">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Initialization Options
              </div>

              {/* Initialize with README toggle */}
              <div
                onClick={() => setInitReadme(!initReadme)}
                className="flex items-center justify-between gap-3 py-1 cursor-pointer select-none group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-commito-coral shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-text-primary group-hover:text-commito-coral transition-colors">
                      Initialize with README.md
                    </div>
                    <div className="text-[10.5px] text-text-muted">
                      Creates an initial README file to document the repository
                    </div>
                  </div>
                </div>

                {/* Clean Theme-Matching Switch */}
                <div
                  className={`relative inline-flex items-center w-7 h-3.5 rounded-full px-0.5 transition-colors shrink-0 ${
                    initReadme
                      ? "bg-commito-coral"
                      : "bg-base-3 border border-border"
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full bg-white transition-transform duration-100 shadow-2xs ${
                      initReadme ? "translate-x-3" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                {/* Gitignore Template */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-text-secondary flex items-center gap-1.5">
                    <FileCode className="w-3 h-3 text-gitlab-blue" />
                    <span>.gitignore template</span>
                  </label>
                  <Dropdown
                    options={GITIGNORE_TEMPLATES}
                    value={gitignoreTemplate}
                    onChange={setGitignoreTemplate}
                    className="w-full"
                  />
                </div>

                {/* License Template */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-text-secondary flex items-center gap-1.5">
                    <Scale className="w-3 h-3 text-amber-400" />
                    <span>License</span>
                  </label>
                  <Dropdown
                    options={LICENSE_TEMPLATES}
                    value={licenseTemplate}
                    onChange={setLicenseTemplate}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-4 py-2.5 bg-base-1/80 border-t border-border flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={requestClose}
              disabled={isCreating}
              className="px-3.5 py-1.5 bg-base-1 hover:bg-base-2 border border-border rounded-sm text-xs font-medium text-text-secondary hover:text-text-primary transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !cleanName || hasInvalidChars}
              className="px-4 py-1.5 bg-commito-coral hover:bg-commito-coralHover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-98"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
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
    document.body,
  );
};
