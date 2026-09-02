use crate::error::AppError;
use crate::git::command::silent_git_command;
use git2::{Repository, Status, StatusOptions};
use serde::{Deserialize, Serialize};
use std::path::Path;

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
    pub has_remote: bool,
    pub remote_url: Option<String>,
}

pub fn get_repo_status(repo_path: &str) -> Result<RepoStatus, AppError> {
    let path = Path::new(repo_path);
    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "Path does not exist: {}",
            repo_path
        )));
    }

    let repo = match Repository::open(path) {
        Ok(r) => r,
        Err(_) => {
            // Fallback to Git CLI if libgit2 cannot open the repository
            return get_repo_status_cli(path, "HEAD".to_string(), 0, 0, false, None);
        }
    };

    // Determine current branch
    let current_branch = match repo.head() {
        Ok(head) => head.shorthand().unwrap_or("HEAD").to_string(),
        Err(_) => "main".to_string(),
    };

    // Calculate ahead/behind counts if tracking branch exists
    let (ahead, behind) = get_ahead_behind(&repo, &current_branch).unwrap_or((0, 0));

    // Check if origin remote is configured via libgit2 (zero process-spawning overhead)
    let (has_remote, remote_url) = match repo.find_remote("origin") {
        Ok(remote) => {
            let url = remote.url().map(|u| u.to_string());
            (true, url)
        }
        Err(_) => (false, None),
    };

    // Get status list with recurse_untracked_dirs enabled so individual files inside new directories are listed
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = match repo.statuses(Some(&mut opts)) {
        Ok(s) => s,
        Err(_) => {
            // Fallback to Git CLI if libgit2 statuses fails
            return get_repo_status_cli(
                path,
                current_branch,
                ahead,
                behind,
                has_remote,
                remote_url,
            );
        }
    };

    let mut files = Vec::with_capacity(statuses.len().min(5000));
    let mut has_conflicts = false;

    for entry in statuses.iter() {
        if files.len() >= 10000 {
            // Cap at 10,000 files to prevent serialization crashes on extreme monolith changesets
            break;
        }
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

        if s.contains(Status::IGNORED) {
            continue;
        }

        let is_staged = s.contains(Status::INDEX_NEW)
            || s.contains(Status::INDEX_MODIFIED)
            || s.contains(Status::INDEX_DELETED)
            || s.contains(Status::INDEX_RENAMED)
            || s.contains(Status::INDEX_TYPECHANGE);

        let kind = if s.contains(Status::WT_NEW) {
            FileStatusKind::Untracked
        } else if s.contains(Status::WT_DELETED) || s.contains(Status::INDEX_DELETED) {
            FileStatusKind::Deleted
        } else if s.contains(Status::WT_RENAMED) || s.contains(Status::INDEX_RENAMED) {
            FileStatusKind::Renamed
        } else if is_staged && !s.contains(Status::WT_MODIFIED) {
            FileStatusKind::Staged
        } else {
            FileStatusKind::Modified
        };

        files.push(FileStatus {
            path: path_str,
            status: kind,
            staged: is_staged,
        });
    }

    let is_clean = files.is_empty();

    Ok(RepoStatus {
        current_branch,
        ahead,
        behind,
        files,
        is_clean,
        has_conflicts,
        has_remote,
        remote_url,
    })
}

fn get_repo_status_cli(
    repo_path: &Path,
    current_branch: String,
    ahead: usize,
    behind: usize,
    has_remote: bool,
    remote_url: Option<String>,
) -> Result<RepoStatus, AppError> {
    let output = silent_git_command()
        .args(["status", "--porcelain=v1", "-z", "-uall"])
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("git status failed: {}", err_msg)));
    }

    let mut files = Vec::new();
    let mut has_conflicts = false;
    let stdout = output.stdout;
    let mut i = 0;

    while i < stdout.len() && files.len() < 10000 {
        if i + 3 > stdout.len() {
            break;
        }
        let x = stdout[i] as char;
        let y = stdout[i + 1] as char;
        i += 3; // Skip XY and space

        let mut path_end = i;
        while path_end < stdout.len() && stdout[path_end] != 0 {
            path_end += 1;
        }
        let path_str = String::from_utf8_lossy(&stdout[i..path_end]).to_string();
        i = path_end + 1;

        if path_str.is_empty() {
            continue;
        }

        // If rename, git status -z outputs: XY path\0old_path\0
        if x == 'R' || x == 'C' || y == 'R' || y == 'C' {
            let mut old_path_end = i;
            while old_path_end < stdout.len() && stdout[old_path_end] != 0 {
                old_path_end += 1;
            }
            i = old_path_end + 1;
        }

        let is_conflict = x == 'U' || y == 'U' || (x == 'A' && y == 'A') || (x == 'D' && y == 'D');
        if is_conflict {
            has_conflicts = true;
            files.push(FileStatus {
                path: path_str,
                status: FileStatusKind::Conflicted,
                staged: false,
            });
            continue;
        }

        let is_untracked = x == '?' && y == '?';
        let is_staged = x != ' ' && x != '?';
        let kind = if is_untracked {
            FileStatusKind::Untracked
        } else if x == 'D' || y == 'D' {
            FileStatusKind::Deleted
        } else if x == 'R' || y == 'R' {
            FileStatusKind::Renamed
        } else if is_staged && y == ' ' {
            FileStatusKind::Staged
        } else {
            FileStatusKind::Modified
        };

        files.push(FileStatus {
            path: path_str,
            status: kind,
            staged: is_staged,
        });
    }

    let is_clean = files.is_empty();

    Ok(RepoStatus {
        current_branch,
        ahead,
        behind,
        files,
        is_clean,
        has_conflicts,
        has_remote,
        remote_url,
    })
}

fn get_ahead_behind(repo: &Repository, branch_name: &str) -> Result<(usize, usize), AppError> {
    let repo_path = repo
        .workdir()
        .or_else(|| repo.path().parent())
        .ok_or_else(|| AppError::Git("Cannot determine repo workdir".to_string()))?;

    // First check if a remote named "origin" is configured at all.
    // For local-only repos with no remote, reporting commits as "ahead" is misleading.
    let has_remote = silent_git_command()
        .args(["remote", "get-url", "origin"])
        .current_dir(repo_path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !has_remote {
        // No remote configured — ahead/behind is meaningless, return 0/0
        return Ok((0, 0));
    }

    // Use system git rev-list --count which reads actual on-disk refs (never stale).
    // This is more reliable than libgit2's in-memory ref cache after a push/fetch.
    let remote_ref = format!("origin/{}", branch_name);

    // Check if the remote tracking ref exists (i.e. branch has been pushed at least once)
    let ref_exists = silent_git_command()
        .args([
            "show-ref",
            "--quiet",
            "--verify",
            &format!("refs/remotes/{}", remote_ref),
        ])
        .current_dir(repo_path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !ref_exists {
        // Remote is configured but this branch has never been pushed — count all local commits as "ahead"
        let output = silent_git_command()
            .args(["rev-list", "--count", "HEAD"])
            .current_dir(repo_path)
            .output()
            .unwrap_or_else(|_| std::process::Output {
                status: std::process::ExitStatus::default(),
                stdout: b"0\n".to_vec(),
                stderr: vec![],
            });
        let count: usize = String::from_utf8_lossy(&output.stdout)
            .trim()
            .parse()
            .unwrap_or(0);
        return Ok((count, 0));
    }

    // Count commits in local branch not in remote
    let ahead_out = silent_git_command()
        .args(["rev-list", "--count", &format!("{}..HEAD", remote_ref)])
        .current_dir(repo_path)
        .output()?;
    let ahead: usize = String::from_utf8_lossy(&ahead_out.stdout)
        .trim()
        .parse()
        .unwrap_or(0);

    // Count commits in remote not in local branch
    let behind_out = silent_git_command()
        .args(["rev-list", "--count", &format!("HEAD..{}", remote_ref)])
        .current_dir(repo_path)
        .output()?;
    let behind: usize = String::from_utf8_lossy(&behind_out.stdout)
        .trim()
        .parse()
        .unwrap_or(0);

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
            has_remote: false,
            remote_url: None,
        };

        assert_eq!(repo_status.current_branch, "main");
        assert_eq!(repo_status.ahead, 2);
        assert!(!repo_status.is_clean);
        assert_eq!(repo_status.files.len(), 1);
    }
}
