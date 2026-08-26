import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  Upload,
  RefreshCw,
  Search,
  Copy,
  Check,
  Globe,
  Loader2,
  Sparkles,
  Edit3,
  Calendar,
  User,
  GitCommit,
  Paperclip,
  Package,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useLogStore } from '../../store/useLogStore';
import { useToastStore } from '../../store/useToastStore';
import { useRemoteStore } from '../../store/remoteStore';
import { GitService } from '../../services/git/gitService';
import { ReleaseService } from '../../services/git/releaseService';
import { toAppError, getErrorMessage } from '../../shared/utils/errorUtils';
import { CreateTagModal } from '../modals/CreateTagModal';
import { Dropdown } from '../common/Dropdown';
import { ReleaseInfo } from '../../types/git';

/**
 * Modern Dark Obsidian View for managing, creating, editing, and publishing Releases & Git Tags.
 */
export const TagsView: React.FC = () => {
  const {
    activeRepoPath,
    tags,
    setTags,
    releases,
    setReleases,
    setBranches,
    setError,
    setIsCreateReleaseModalOpen,
    setEditingRelease,
  } = useGitStore();
  const { remotes, activeRemote, loadRemotes } = useRemoteStore();

  const [activeTab, setActiveTab] = useState<'releases' | 'tags'>('releases');
  const [filter, setFilter] = useState('');
  const [isCreateTagModalOpen, setIsCreateTagModalOpen] = useState(false);
  const [selectedRemote, setSelectedRemote] = useState('origin');
  const [isLoading, setIsLoading] = useState(false);
  const [isPushingAll, setIsPushingAll] = useState(false);
  const [pushingItemMap, setPushingItemMap] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    if (!activeRepoPath) return;
    setIsLoading(true);
    try {
      const [tagsRes, releasesRes, branchesRes] = await Promise.all([
        GitService.listTags(activeRepoPath).catch(() => []),
        ReleaseService.listReleases(activeRepoPath).catch(() => []),
        GitService.listBranches(activeRepoPath).catch(() => []),
      ]);
      setTags(tagsRes || []);
      setReleases(releasesRes || []);
      setBranches(branchesRes || []);
    } catch {
      setTags([]);
      setReleases([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeRepoPath) {
      loadData();
      loadRemotes(activeRepoPath);
    }
  }, [activeRepoPath]);

  useEffect(() => {
    if (activeRemote) {
      setSelectedRemote(activeRemote);
    } else if (remotes.length > 0) {
      setSelectedRemote(remotes[0].name);
    }
  }, [activeRemote, remotes]);

  // Copy helper with feedback
  const handleCopy = (text: string, id: string, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    useToastStore.getState().showToast({
      type: 'info',
      title: label,
      message: text,
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Delete tag
  const handleDeleteTag = async (name: string) => {
    if (!activeRepoPath) return;
    if (!confirm(`Delete tag '${name}'? This will remove the local tag marker.`)) return;

    try {
      await GitService.deleteTag(activeRepoPath, name);
      useLogStore.getState().addLog('info', 'Git', `Deleted tag '${name}'`);
      useToastStore.getState().showToast({
        type: 'info',
        title: 'Tag Deleted',
        message: `Removed tag '${name}' locally`,
      });
      loadData();
    } catch (error: unknown) {
      setError(toAppError(error, 'TAG_ERROR'));
    }
  };

  // Delete release
  const handleDeleteRelease = async (release: ReleaseInfo) => {
    if (!activeRepoPath) return;
    if (!confirm(`Delete release '${release.name || release.tag_name}' and remove its release tag?`)) return;

    try {
      await ReleaseService.deleteRelease(activeRepoPath, release.tag_name, true, selectedRemote || null);
      useLogStore.getState().addLog('info', 'Git', `Deleted release '${release.name}' (${release.tag_name})`);
      useToastStore.getState().showToast({
        type: 'info',
        title: 'Release Deleted',
        message: `Removed release '${release.name}'`,
      });
      loadData();
    } catch (error: unknown) {
      setError(toAppError(error, 'RELEASE_ERROR'));
    }
  };

  // Push single release/tag to remote
  const handlePushItem = async (tagName: string) => {
    if (!activeRepoPath || pushingItemMap[tagName]) return;
    setPushingItemMap((prev) => ({ ...prev, [tagName]: true }));

    try {
      await GitService.pushSpecificTag(activeRepoPath, tagName, selectedRemote || null);
      useLogStore
        .getState()
        .addLog('success', 'Git', `Pushed release tag '${tagName}' to '${selectedRemote || 'origin'}'`);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Published to Remote',
        message: `Tag '${tagName}' pushed to '${selectedRemote || 'origin'}'`,
      });
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Push Failed',
        message: msg,
      });
    } finally {
      setPushingItemMap((prev) => ({ ...prev, [tagName]: false }));
    }
  };

  // Push all tags
  const handlePushAllTags = async () => {
    if (!activeRepoPath || isPushingAll) return;
    setIsPushingAll(true);

    try {
      await GitService.pushTags(activeRepoPath, selectedRemote || null);
      useLogStore
        .getState()
        .addLog('success', 'Git', `Pushed all tags to remote '${selectedRemote || 'origin'}'`);
      useToastStore.getState().showToast({
        type: 'success',
        title: 'Tags Published',
        message: `All tags pushed to '${selectedRemote || 'origin'}'`,
      });
      loadData();
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      useToastStore.getState().showToast({
        type: 'error',
        title: 'Push All Failed',
        message: msg,
      });
    } finally {
      setIsPushingAll(false);
    }
  };

  // Filtered releases and tags
  const filteredReleases = useMemo(() => {
    if (!filter.trim()) return releases;
    const q = filter.toLowerCase();
    return releases.filter(
      (r) =>
        r.tag_name.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.author_name && r.author_name.toLowerCase().includes(q))
    );
  }, [releases, filter]);

  const filteredTags = useMemo(() => {
    if (!filter.trim()) return tags;
    const q = filter.toLowerCase();
    return tags.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.sha && t.sha.toLowerCase().includes(q)) ||
        (t.message && t.message.toLowerCase().includes(q)) ||
        (t.tagger_name && t.tagger_name.toLowerCase().includes(q))
    );
  }, [tags, filter]);

  // Format date helper
  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="flex-1 h-full bg-base-0 overflow-y-auto p-5 select-none space-y-4 font-sans">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-border/80">
        <div>
          <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-commito-coral" />
            <span>Releases & Tags</span>
            <span className="px-1.5 py-0.2 bg-base-1 border border-border rounded-xs text-[10px] font-mono text-text-muted">
              {releases.length} releases • {tags.length} tags
            </span>
          </h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            Manage repository release notes, changelogs, annotated markers, and remote publishing
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Top Tabs Switcher */}
          <div className="flex items-center bg-base-1 p-0.5 border border-border rounded-sm">
            <button
              onClick={() => setActiveTab('releases')}
              className={`h-7 px-3 rounded-xs text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'releases'
                  ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/30 shadow-2xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Releases ({releases.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('tags')}
              className={`h-7 px-3 rounded-xs text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'tags'
                  ? 'bg-commito-coral/15 text-commito-coral border border-commito-coral/30 shadow-2xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Tags ({tags.length})</span>
            </button>
          </div>

          {/* New Release / New Tag Buttons */}
          {activeTab === 'releases' ? (
            <button
              onClick={() => {
                setEditingRelease(null);
                setIsCreateReleaseModalOpen(true);
              }}
              className="h-8 px-3.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Draft Release</span>
            </button>
          ) : (
            <button
              onClick={() => setIsCreateTagModalOpen(true)}
              className="h-8 px-3.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Tag</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-1 min-w-[200px] max-w-md">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder={activeTab === 'releases' ? 'Search releases & notes...' : 'Search tags & SHAs...'}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full h-8 pl-8 pr-2.5 bg-base-1 border border-border hover:border-border-strong focus:border-commito-coral rounded-sm text-xs text-text-primary focus:outline-none transition shadow-2xs placeholder:text-text-faint"
            />
          </div>

          {/* Remote Selector (when remotes available) */}
          {remotes.length > 1 && (
            <div className="w-36">
              <Dropdown
                options={remotes.map((r) => ({
                  value: r.name,
                  label: r.name,
                  icon: <Globe className="w-3.5 h-3.5 text-text-muted" />,
                }))}
                value={selectedRemote}
                onChange={(val) => setSelectedRemote(val)}
                placeholder="Remote..."
                size="md"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Push All Tags Button (when on Tags tab) */}
          {activeTab === 'tags' && tags.length > 0 && (
            <button
              onClick={handlePushAllTags}
              disabled={isPushingAll}
              className="h-8 px-3 bg-base-1 hover:bg-base-2 border border-border rounded-sm text-xs font-medium text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Push all local tags to remote"
            >
              {isPushingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5 text-text-muted" />
              )}
              <span>Push All Tags</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={loadData}
            disabled={isLoading}
            className="h-8 w-8 flex items-center justify-center bg-base-1 hover:bg-base-2 border border-border rounded-sm text-text-muted hover:text-text-primary transition cursor-pointer disabled:opacity-50 shadow-2xs"
            title="Refresh Releases & Tags"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading && releases.length === 0 && tags.length === 0 ? (
        <div className="p-12 text-center text-text-muted text-xs flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-commito-coral" />
          <span>Loading repository releases and tags...</span>
        </div>
      ) : activeTab === 'releases' ? (
        /* RELEASES TAB CONTENT */
        filteredReleases.length === 0 ? (
          <div className="p-12 text-center bg-base-1 border border-border/70 rounded-sm space-y-3">
            <div className="w-10 h-10 mx-auto rounded-sm bg-base-2 border border-border flex items-center justify-center text-text-muted">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-primary">No Releases Found</h4>
              <p className="text-[11px] text-text-muted mt-1 max-w-sm mx-auto">
                {filter
                  ? 'No releases match your search query.'
                  : 'Draft a new release to publish versioned changelogs, release notes, and tags to your repository.'}
              </p>
            </div>
            {!filter && (
              <button
                onClick={() => {
                  setEditingRelease(null);
                  setIsCreateReleaseModalOpen(true);
                }}
                className="h-7.5 px-3.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Draft First Release</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReleases.map((release) => {
              const isPushing = pushingItemMap[release.tag_name];
              const isCopied = copiedId === `release-${release.tag_name}`;
              const isLatest = Boolean(release.is_latest);

              const formatAssetSize = (bytes?: number) => {
                if (!bytes && bytes !== 0) return '';
                if (bytes < 1024) return `${bytes} B`;
                if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
              };

              return (
                <div
                  key={release.tag_name}
                  className="bg-base-1 border border-border hover:border-border-strong rounded-sm p-4 space-y-3 transition shadow-2xs"
                >
                  {/* Release Card Header */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-text-primary hover:text-commito-coral transition-colors">
                          {release.name || release.tag_name}
                        </h3>

                        {/* Tag Badge */}
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-amber-500/15 border border-amber-500/35 text-amber-400 font-mono text-[9.5px] font-bold rounded-xs">
                          <Tag className="w-2.5 h-2.5" />
                          <span>{release.tag_name}</span>
                        </span>

                        {/* Status Badges */}
                        {isLatest && (
                          <span className="px-1.5 py-0.2 bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-[9.5px] font-bold rounded-xs">
                            Latest
                          </span>
                        )}

                        {release.is_prerelease && (
                          <span className="px-1.5 py-0.2 bg-purple-500/15 border border-purple-500/35 text-purple-300 text-[9.5px] font-bold rounded-xs">
                            Pre-release
                          </span>
                        )}
                      </div>

                      {/* Meta Information (Author, Date, Commit SHA) */}
                      <div className="flex items-center gap-3 text-[11px] text-text-muted flex-wrap">
                        {release.author_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-text-faint" />
                            <span>{release.author_name}</span>
                          </span>
                        )}

                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-text-faint" />
                          <span>{formatDate(release.released_at || release.created_at)}</span>
                        </span>

                        {release.commit_sha && (
                          <span className="flex items-center gap-1 font-mono text-[10px] text-text-faint">
                            <GitCommit className="w-2.5 h-2.5 text-commito-coral" />
                            <span>{release.commit_sha.slice(0, 7)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Action Button Group */}
                    <div className="flex items-center gap-1">
                      {/* Edit Release Button */}
                      <button
                        onClick={() => {
                          setEditingRelease(release);
                          setIsCreateReleaseModalOpen(true);
                        }}
                        className="h-7 px-2.5 bg-base-0 hover:bg-base-2 border border-border text-text-secondary hover:text-text-primary rounded-xs text-[11px] font-medium flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        title="Edit release title, assets, and notes"
                      >
                        <Edit3 className="w-3 h-3 text-commito-coral" />
                        <span>Edit</span>
                      </button>

                      {/* Copy Notes */}
                      <button
                        onClick={() => handleCopy(release.description, `release-${release.tag_name}`, 'Copied Release Notes')}
                        className="h-7 w-7 flex items-center justify-center bg-base-0 hover:bg-base-2 border border-border text-text-muted hover:text-text-primary rounded-xs transition cursor-pointer shadow-2xs"
                        title="Copy markdown release notes"
                      >
                        {isCopied ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>

                      {/* Push / Publish Tag */}
                      <button
                        onClick={() => handlePushItem(release.tag_name)}
                        disabled={isPushing}
                        className="h-7 w-7 flex items-center justify-center bg-base-0 hover:bg-base-2 border border-border text-text-muted hover:text-commito-coral rounded-xs transition cursor-pointer disabled:opacity-50 shadow-2xs"
                        title={`Push tag '${release.tag_name}' to '${selectedRemote}'`}
                      >
                        {isPushing ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                      </button>

                      {/* Delete Release */}
                      <button
                        onClick={() => handleDeleteRelease(release)}
                        className="h-7 w-7 flex items-center justify-center bg-base-0 hover:bg-git-removed-bg border border-border hover:border-git-removed/40 text-text-muted hover:text-git-removed rounded-xs transition cursor-pointer shadow-2xs"
                        title="Delete this release"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Release Notes / Description Body */}
                  <div className="p-3 bg-base-0 border border-border/80 rounded-sm text-xs text-text-secondary leading-relaxed font-sans select-text whitespace-pre-wrap">
                    {release.description || (
                      <span className="italic text-text-faint">No description provided for this release.</span>
                    )}
                  </div>

                  {/* Attached Release Assets */}
                  {release.assets && release.assets.length > 0 && (
                    <div className="pt-2 border-t border-border/40 space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
                        <Paperclip className="w-3 h-3 text-commito-coral" />
                        <span>Assets ({release.assets.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {release.assets.map((asset, aIdx) => (
                          <div
                            key={asset.name + aIdx}
                            className="flex items-center justify-between p-2 bg-base-0 border border-border/80 rounded-xs text-xs group hover:border-border-strong transition shadow-2xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Package className="w-3.5 h-3.5 text-gitlab-teal shrink-0" />
                              <span className="font-mono text-[11px] text-text-primary truncate" title={asset.name}>
                                {asset.name}
                              </span>
                              {asset.size && (
                                <span className="text-[10px] text-text-muted font-mono shrink-0">
                                  ({formatAssetSize(asset.size)})
                                </span>
                              )}
                            </div>
                            {asset.url && (
                              <button
                                onClick={() => handleCopy(asset.direct_asset_url || asset.url, `asset-${asset.name}-${aIdx}`, 'Copied asset link')}
                                className="p-1 text-text-muted hover:text-text-primary rounded-xs transition cursor-pointer"
                                title="Copy Asset Link / Path"
                              >
                                {copiedId === `asset-${asset.name}-${aIdx}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* TAGS TAB CONTENT */
        filteredTags.length === 0 ? (
          <div className="p-12 text-center bg-base-1 border border-border/70 rounded-sm space-y-3">
            <div className="w-10 h-10 mx-auto rounded-sm bg-base-2 border border-border flex items-center justify-center text-text-muted">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-primary">No Git Tags Found</h4>
              <p className="text-[11px] text-text-muted mt-1 max-w-sm mx-auto">
                {filter
                  ? 'No git tags match your search filter.'
                  : 'Create tags on branches or specific commits to mark milestones and release versions.'}
              </p>
            </div>
            {!filter && (
              <button
                onClick={() => setIsCreateTagModalOpen(true)}
                className="h-7.5 px-3.5 bg-commito-coral hover:bg-commito-coralLight text-white rounded-sm text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Tag</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {filteredTags.map((tag) => {
              const isPushing = pushingItemMap[tag.name];
              const isCopied = copiedId === tag.name;

              return (
                <div
                  key={tag.name}
                  className="bg-base-1 border border-border hover:border-border-strong rounded-sm p-3 space-y-2 transition-colors flex flex-col justify-between shadow-2xs"
                >
                  <div className="space-y-1.5">
                    {/* Tag Name & Annotations */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="font-mono text-xs font-bold text-text-primary truncate">
                          {tag.name}
                        </span>
                        {tag.is_annotated && (
                          <span className="px-1.5 py-0.2 bg-commito-coral/15 border border-commito-coral/30 text-commito-coral text-[9px] font-bold rounded-xs">
                            Annotated
                          </span>
                        )}
                      </div>

                      {/* Commit SHA Badge */}
                      {tag.sha && (
                        <div className="flex items-center gap-0.5 px-1.5 py-0.2 bg-base-0 border border-border rounded-xs text-[9.5px] font-mono text-text-muted shrink-0">
                          <GitCommit className="w-2.5 h-2.5 text-commito-coral" />
                          <span>{tag.sha.slice(0, 7)}</span>
                        </div>
                      )}
                    </div>

                    {/* Tag Message (if annotated) */}
                    {tag.message && (
                      <p className="text-[11px] text-text-secondary line-clamp-2 bg-base-0/60 p-1.5 rounded-xs border border-border/50 font-sans">
                        {tag.message}
                      </p>
                    )}

                    {/* Tagger Name */}
                    {tag.tagger_name && (
                      <div className="text-[10px] text-text-muted flex items-center gap-1">
                        <User className="w-2.5 h-2.5 text-text-faint" />
                        <span>Tagged by {tag.tagger_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Tag Action Controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                    {/* Convert to Release Button */}
                    <button
                      onClick={() => {
                        setEditingRelease({
                          tag_name: tag.name,
                          name: `Release ${tag.name}`,
                          description: tag.message || `Release notes for version ${tag.name}`,
                          created_at: new Date().toISOString(),
                        });
                        setIsCreateReleaseModalOpen(true);
                      }}
                      className="px-2 py-1 bg-base-0 hover:bg-base-2 border border-border rounded-xs text-[10.5px] font-medium text-text-secondary hover:text-text-primary flex items-center gap-1 transition cursor-pointer shadow-2xs"
                      title="Draft and publish release notes for this tag"
                    >
                      <Sparkles className="w-3 h-3 text-commito-coral" />
                      <span>Convert to Release</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {/* Copy Tag Name */}
                      <button
                        onClick={() => handleCopy(tag.name, tag.name, 'Copied Tag Name')}
                        className="h-6.5 w-6.5 flex items-center justify-center bg-base-0 hover:bg-base-2 border border-border rounded-xs text-text-muted hover:text-text-primary transition cursor-pointer shadow-2xs"
                        title="Copy tag name"
                      >
                        {isCopied ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>

                      {/* Push Tag */}
                      <button
                        onClick={() => handlePushItem(tag.name)}
                        disabled={isPushing}
                        className="h-6.5 w-6.5 flex items-center justify-center bg-base-0 hover:bg-base-2 border border-border rounded-xs text-text-muted hover:text-commito-coral transition cursor-pointer disabled:opacity-50 shadow-2xs"
                        title={`Push tag to '${selectedRemote}'`}
                      >
                        {isPushing ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                      </button>

                      {/* Delete Tag */}
                      <button
                        onClick={() => handleDeleteTag(tag.name)}
                        className="h-6.5 w-6.5 flex items-center justify-center bg-base-0 hover:bg-git-removed-bg border border-border hover:border-git-removed/40 text-text-muted hover:text-git-removed rounded-xs transition cursor-pointer shadow-2xs"
                        title="Delete tag"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Embedded Create Tag Modal */}
      <CreateTagModal
        isOpen={isCreateTagModalOpen}
        onClose={() => setIsCreateTagModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};
