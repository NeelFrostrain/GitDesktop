use serde::{Deserialize, Serialize};
use git2::{Repository, StatusOptions, Status};
use std::path::Path;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub enum FileStatusKind {
    Modified,
    Staged,
    Untracked,
    Deleted,
    Renamed,
    Conflicted,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileStatus {
    pub path: String,
    pub status: FileStatusKind,
    pub staged: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoStatus {
    pub current_branch: String,
    pub ahead: usize,
    pub behind: usize,
    pub files: Vec<FileStatus>,
    pub is_clean: bool,
    pub has_conflicts: bool,
}

pub fn get_repo_status(repo_path: &str) -> Result<RepoStatus, AppError> {
    let path = Path::new(repo_path);
    if !path.exists() {
        return Err(AppError::NotFound(format!("Path does not exist: {}", repo_path)));
    }

    let repo = Repository::open(path)
        .map_err(|e| AppError::Git(format!("Failed to open repository at '{}': {}", repo_path, e)))?;

    // Determine current branch
    let current_branch = match repo.head() {
        Ok(head) => head.shorthand().unwrap_or("HEAD").to_string(),
        Err(_) => "main".to_string(),
    };

    // Calculate ahead/behind counts if tracking branch exists
    let (ahead, behind) = get_ahead_behind(&repo, &current_branch).unwrap_or((0, 0));

    // Get status list
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut files = Vec::new();
    let mut has_conflicts = false;

    for entry in statuses.iter() {
        let path_str = entry.path().unwrap_or("").to_string();
        if path_str.is_empty() {
            continue;
        }

        let s = entry.status();

        if s.contains(Status::CONFLICTED) {
            has_conflicts = true;
            files.push(FileStatus {
                path: path_str,
                status: FileStatusKind::Conflicted,
                staged: false,
            });
            continue;
        }

        // Staged changes (Index)
        if s.contains(Status::INDEX_NEW)
            || s.contains(Status::INDEX_MODIFIED)
            || s.contains(Status::INDEX_DELETED)
            || s.contains(Status::INDEX_RENAMED)
        {
            let kind = if s.contains(Status::INDEX_NEW) {
                FileStatusKind::Staged
            } else if s.contains(Status::INDEX_DELETED) {
                FileStatusKind::Deleted
            } else if s.contains(Status::INDEX_RENAMED) {
                FileStatusKind::Renamed
            } else {
                FileStatusKind::Modified
            };

            files.push(FileStatus {
                path: path_str.clone(),
                status: kind,
                staged: true,
            });
        }

        // Unstaged changes (Worktree)
        if s.contains(Status::WT_NEW)
            || s.contains(Status::WT_MODIFIED)
            || s.contains(Status::WT_DELETED)
            || s.contains(Status::WT_RENAMED)
        {
            let kind = if s.contains(Status::WT_NEW) {
                FileStatusKind::Untracked
            } else if s.contains(Status::WT_DELETED) {
                FileStatusKind::Deleted
            } else if s.contains(Status::WT_RENAMED) {
                FileStatusKind::Renamed
            } else {
                FileStatusKind::Modified
            };

            files.push(FileStatus {
                path: path_str,
                status: kind,
                staged: false,
            });
        }
    }

    let is_clean = files.is_empty();

    Ok(RepoStatus {
        current_branch,
        ahead,
        behind,
        files,
        is_clean,
        has_conflicts,
    })
}

fn get_ahead_behind(repo: &Repository, branch_name: &str) -> Result<(usize, usize), AppError> {
    let local_branch = repo.find_branch(branch_name, git2::BranchType::Local)?;
    let upstream = match local_branch.upstream() {
        Ok(u) => u,
        Err(_) => return Ok((0, 0)),
    };

    let local_oid = local_branch
        .get()
        .target()
        .ok_or_else(|| AppError::Git("Local branch target missing".to_string()))?;
    let upstream_oid = upstream
        .get()
        .target()
        .ok_or_else(|| AppError::Git("Upstream branch target missing".to_string()))?;

    let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid)?;
    Ok((ahead, behind))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_status_kind_serialization() {
        let status = FileStatusKind::Modified;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"Modified\"");
    }

    #[test]
    fn test_repo_status_struct() {
        let repo_status = RepoStatus {
            current_branch: "main".to_string(),
            ahead: 2,
            behind: 1,
            files: vec![FileStatus {
                path: "src/App.tsx".to_string(),
                status: FileStatusKind::Modified,
                staged: true,
            }],
            is_clean: false,
            has_conflicts: false,
        };

        assert_eq!(repo_status.current_branch, "main");
        assert_eq!(repo_status.ahead, 2);
        assert!(!repo_status.is_clean);
        assert_eq!(repo_status.files.len(), 1);
    }
}
