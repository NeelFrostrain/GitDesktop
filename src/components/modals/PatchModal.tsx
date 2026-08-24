import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  FileCode,
  Download,
  Upload,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { GitService } from '../../services/git/gitService';
import { toAppError } from '../../shared/utils/errorUtils';

/**
 * Modal dialog supporting exporting commit ranges as .patch files or applying external patch files.
 */
export const PatchModal: React.FC = () => {
  const {
    activeRepoPath,
    isPatchModalOpen,
    setIsPatchModalOpen,
    setStatus,
    setError,
  } = useGitStore();

  const [activeTab, setActiveTab] = useState<'export' | 'apply'>('export');
  const [exportPath, setExportPath] = useState('');
  const [commitRange, setCommitRange] = useState('HEAD~1..HEAD');
  const [patchFilePath, setPatchFilePath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleExportPatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !exportPath.trim()) return;

    setIsSubmitting(true);
    try {
      await invoke('export_patch_cmd', {
        repoPath: activeRepoPath,
        targetPath: exportPath.trim(),
        range: commitRange.trim() || null,
      });

      useLogStore.getState().addLog('success', 'Git', `Exported patch to '${exportPath.trim()}'`);
      setIsPatchModalOpen(false);
    } catch (error: unknown) {
      setError(toAppError(error, 'PATCH_ERROR'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyPatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRepoPath || !patchFilePath.trim()) return;

    setIsSubmitting(true);
    try {
      await invoke('apply_patch_cmd', {
        repoPath: activeRepoPath,
        patchFilePath: patchFilePath.trim(),
      });

      useLogStore.getState().addLog('success', 'Git', `Applied patch file '${patchFilePath.trim()}'`);
      const newStatus = await GitService.getRepoStatus(activeRepoPath);
      setStatus(newStatus);
      setIsPatchModalOpen(false);
    } catch (error: unknown) {
      setError(toAppError(error, 'PATCH_ERROR'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isPatchModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-base-1 border border-border rounded-sm shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-base-0 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-commito-coral/20 border border-commito-coral/40 text-commito-coral flex items-center justify-center">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary leading-tight">
                Patch & Diff Studio
              </h2>
              <p className="text-[11px] text-text-muted">
                Export commit ranges as .patch files or apply patch files to working copy
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsPatchModalOpen(false)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-sm hover:bg-base-2 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Header */}
        <div className="px-5 pt-3 pb-2 border-b border-border flex items-center gap-2 bg-base-0/50">
          <button
            onClick={() => setActiveTab('export')}
            className={`px-3.5 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'export'
                ? 'bg-commito-coral hover:bg-commito-coralLight text-white shadow-xs'
                : 'bg-base-2 text-text-secondary hover:text-text-primary'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Patch File</span>
          </button>

          <button
            onClick={() => setActiveTab('apply')}
            className={`px-3.5 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'apply'
                ? 'bg-commito-coral hover:bg-commito-coralLight text-white shadow-xs'
                : 'bg-base-2 text-text-secondary hover:text-text-primary'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Apply External Patch</span>
          </button>
        </div>

        {/* Body Form */}
        <div className="p-5">
          {activeTab === 'export' ? (
            <form onSubmit={handleExportPatch} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-text-secondary mb-1 block">
                  Export Destination File Path (Required)
                </label>
                <input
                  type="text"
                  placeholder="e.g. C:/patches/my-feature.patch"
                  value={exportPath}
                  onChange={(e) => setExportPath(e.target.value)}
                  className="w-full px-3 py-2 bg-base-2 border border-border rounded-sm text-xs text-text-primary focus:outline-none focus:border-commito-coral font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-secondary mb-1 block">
                  Commit Range (Optional, default HEAD~1..HEAD or uncommitted changes)
                </label>
                <input
                  type="text"
                  placeholder="e.g. main..feature-branch or HEAD~3..HEAD"
                  value={commitRange}
                  onChange={(e) => setCommitRange(e.target.value)}
                  className="w-full px-3 py-2 bg-base-2 border border-border rounded-sm text-xs text-text-primary focus:outline-none focus:border-commito-coral font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPatchModalOpen(false)}
                  className="px-4 py-2 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-xs font-semibold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!exportPath.trim() || isSubmitting}
                  className="px-5 py-2 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Export Patch File
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleApplyPatch} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-text-secondary mb-1 block">
                  Select External Patch File Path (.patch / .diff)
                </label>
                <input
                  type="text"
                  placeholder="e.g. C:/patches/incoming-fix.patch"
                  value={patchFilePath}
                  onChange={(e) => setPatchFilePath(e.target.value)}
                  className="w-full px-3 py-2 bg-base-2 border border-border rounded-sm text-xs text-text-primary focus:outline-none focus:border-commito-coral font-mono"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPatchModalOpen(false)}
                  className="px-4 py-2 bg-base-2 hover:bg-base-3 border border-border rounded-sm text-xs font-semibold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!patchFilePath.trim() || isSubmitting}
                  className="px-5 py-2 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Apply Patch File
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
