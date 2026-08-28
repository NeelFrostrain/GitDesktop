import React, { useState, useEffect } from "react";
import { ChevronsUpDown, FolderGit2 } from "lucide-react";
import { useGitStore } from "../../store/useGitStore";
import { RepoDrawer } from "../layout/RepoDrawer";
import { Tabs } from "../common/Tabs";

export const RepositoryHeader: React.FC = () => {
  const { activeRepoPath, status, branches, activeTab, setActiveTab } =
    useGitStore();
  const [isRepoDrawerOpen, setIsRepoDrawerOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"side-by-side" | "stacked">(
    () => {
      const saved = localStorage.getItem("sidebar-header-layout");
      return saved === "stacked" ? "stacked" : "side-by-side";
    },
  );

  useEffect(() => {
    localStorage.setItem("sidebar-header-layout", layoutMode);
  }, [layoutMode]);

  const activeRepoName = activeRepoPath
    ? activeRepoPath.split(/[/\\]/).pop() || "Repository"
    : "No Repository";

  const branchCount = branches.length || 1;
  const currentBranch = status?.current_branch || "main";
  const fileCount = status?.files?.length || 0;

  const handleOpenRepoSwitcher = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRepoDrawerOpen(true);
  };

  const handleToggleLayout = (e: React.MouseEvent) => {
    // Double click or right click on empty area toggles layout
    if (e.target === e.currentTarget) {
      setLayoutMode((prev) =>
        prev === "side-by-side" ? "stacked" : "side-by-side",
      );
    }
  };

  return (
    <>
      <div
        onDoubleClick={handleToggleLayout}
        className="border-b border-border bg-base-0 select-none"
        title="Double-click header background to toggle Side-by-Side / Stacked layout"
      >
        {layoutMode === "side-by-side" ? (
          /* Mode 1: Side-by-Side (Single Row with Matching h-8 Height) */
          <div className="py-1 px-1.5 flex items-center gap-1.5 w-full">
            {/* Left: Repo Switcher */}
            {activeRepoPath ? (
              <button
                type="button"
                onClick={handleOpenRepoSwitcher}
                className="flex-1 min-w-[70px] max-w-[120px] h-8 px-2 rounded-sm border border-border bg-base-1/50 hover:bg-base-2 hover:border-border-strong flex items-center justify-between gap-1.5 cursor-pointer transition shadow-2xs group outline-none text-left"
                title={`${activeRepoName}\nBranch: ${currentBranch}\nTotal Branches: ${branchCount}\nClick to switch repository (Double-click background to switch to 2-row mode)`}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div className="w-5 h-5 rounded-xs bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FolderGit2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-text-primary truncate block group-hover:text-commito-coral transition-colors">
                    {activeRepoName}
                  </span>
                </div>
                <ChevronsUpDown className="w-3 h-3 text-text-muted group-hover:text-text-primary transition-colors shrink-0 ml-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenRepoSwitcher}
                className="flex-1 min-w-[100px] h-8 px-2 bg-base-1/50 border border-dashed border-border hover:border-commito-coral/50 hover:bg-base-2/60 rounded-sm flex items-center justify-between gap-1.5 cursor-pointer transition group outline-none text-left"
              >
                <div className="flex items-center gap-1.5 text-xs text-text-muted min-w-0">
                  <FolderGit2 className="w-3.5 h-3.5 text-text-faint group-hover:text-commito-coral transition-colors shrink-0" />
                  <span className="font-medium truncate group-hover:text-text-primary transition-colors">
                    Select...
                  </span>
                </div>
                <ChevronsUpDown className="w-3 h-3 text-text-faint group-hover:text-muted transition-colors shrink-0 ml-0.5" />
              </button>
            )}

            {/* Right: Changes / History Tabs (h-8 matching height) */}
            <div className="flex-1 min-w-[130px] h-8">
              <Tabs<"changes" | "history">
                tabs={[
                  {
                    id: "changes",
                    label: "Changes",
                    badge: fileCount,
                    badgeVariant: "coral",
                  },
                  {
                    id: "history",
                    label: "History",
                  },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
                fullWidth
                size="sm"
                className="h-full"
                ariaLabel="Repository change views"
              />
            </div>
          </div>
        ) : (
          /* Mode 2: Stacked (2 Rows with Full Width for Both) */
          <div className="flex flex-col p-1.5 gap-1.5">
            {/* Top Row: Full-width Repo Switcher */}
            {activeRepoPath ? (
              <button
                type="button"
                onClick={handleOpenRepoSwitcher}
                className="w-full h-8 px-2.5 rounded-sm border border-border bg-base-1 hover:bg-base-2 hover:border-border-strong flex items-center justify-between gap-2 cursor-pointer transition shadow-2xs group outline-none text-left"
                title={`${activeRepoName}\nBranch: ${currentBranch}\nTotal Branches: ${branchCount}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-5 h-5 rounded-xs bg-commito-coral/15 text-commito-coral flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FolderGit2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-text-primary truncate block group-hover:text-commito-coral transition-colors">
                    {activeRepoName}
                  </span>
                </div>
                <ChevronsUpDown className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition-colors shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenRepoSwitcher}
                className="w-full h-8 px-2.5 bg-base-1/50 border border-dashed border-border hover:border-commito-coral/50 hover:bg-base-2/60 rounded-sm flex items-center justify-between gap-2 cursor-pointer transition group outline-none text-left"
              >
                <div className="flex items-center gap-2 text-xs text-text-muted min-w-0">
                  <FolderGit2 className="w-3.5 h-3.5 text-text-faint group-hover:text-commito-coral transition-colors shrink-0" />
                  <span className="font-medium truncate group-hover:text-text-primary transition-colors">
                    Select Repo...
                  </span>
                </div>
                <ChevronsUpDown className="w-3.5 h-3.5 text-text-faint group-hover:text-muted transition-colors shrink-0" />
              </button>
            )}

            {/* Bottom Row: Full-width Changes / History Tabs (h-8) */}
            <div className="h-8">
              <Tabs<"changes" | "history">
                tabs={[
                  {
                    id: "changes",
                    label: "Changes",
                    badge: fileCount,
                    badgeVariant: "coral",
                  },
                  {
                    id: "history",
                    label: "History",
                  },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
                fullWidth
                size="md"
                className="h-full"
                ariaLabel="Repository change views"
              />
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Drawer from the right */}
      <RepoDrawer
        isOpen={isRepoDrawerOpen}
        onClose={() => setIsRepoDrawerOpen(false)}
      />
    </>
  );
};
