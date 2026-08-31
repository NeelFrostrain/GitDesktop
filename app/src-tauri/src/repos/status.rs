use crate::error::AppError;
use git2::{Repository, StatusOptions};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoDashboardStatus {
    pub current_branch: String,
    pub ahead: u32,
    pub behind: u32,
    pub dirty_files: u32,
    pub last_commit_summary: String,
    pub last_commit_at: i64,
    pub last_commit_sha: String,
    pub remote_name: Option<String>,
    pub remote_provider: Option<String>, // "gitlab" | "github" | "other"
    #[serde(default = "default_true")]
    pub is_valid: bool,
    #[serde(default)]
    pub error_type: Option<String>, // "folder_missing" | "not_a_git_repo" | "corrupt_git_repo"
    #[serde(default)]
    pub error_message: Option<String>,
}

fn default_true() -> bool {
    true
}

pub fn get_repo_dashboard_status(path: &str) -> Result<RepoDashboardStatus, AppError> {
    let repo_path = Path::new(path);

    // 0. Check directory existence on disk
    if !repo_path.exists() {
        return Ok(RepoDashboardStatus {
            current_branch: "Unavailable".to_string(),
            ahead: 0,
            behind: 0,
            dirty_files: 0,
            last_commit_summary: "Folder not found".to_string(),
            last_commit_at: 0,
            last_commit_sha: String::new(),
            remote_name: None,
            remote_provider: None,
            is_valid: false,
            error_type: Some("folder_missing".to_string()),
            error_message: Some(format!("Directory '{}' does not exist on disk", path)),
        });
    }

    // Check git repository integrity
    let repo = match Repository::open(repo_path) {
        Ok(r) => r,
        Err(e) => {
            let git_dir = repo_path.join(".git");
            let (err_type, summary, msg) = if !git_dir.exists() {
                (
                    "not_a_git_repo",
                    "Missing .git folder",
                    format!("Directory '{}' is not a Git repository (.git directory missing)", path),
                )
            } else {
                (
                    "corrupt_git_repo",
                    "Corrupted .git",
                    format!("Corrupted or unreadable Git repository at '{}': {}", path, e),
                )
            };

            return Ok(RepoDashboardStatus {
                current_branch: "Invalid".to_string(),
                ahead: 0,
                behind: 0,
                dirty_files: 0,
                last_commit_summary: summary.to_string(),
                last_commit_at: 0,
                last_commit_sha: String::new(),
                remote_name: None,
                remote_provider: None,
                is_valid: false,
                error_type: Some(err_type.to_string()),
                error_message: Some(msg),
            });
        }
    };

    // 1. Current branch
    let current_branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .unwrap_or_else(|| "HEAD (detached)".to_string());

    // 2. Dirty files count (non-blocking, ignore submodules)
    let mut status_opts = StatusOptions::new();
    status_opts.include_untracked(true);
    status_opts.include_ignored(false);

    let dirty_files = repo
        .statuses(Some(&mut status_opts))
        .map(|s| s.iter().count() as u32)
        .unwrap_or(0);

    // 3. Last commit info
    let (last_commit_summary, last_commit_at, last_commit_sha) = if let Ok(head) = repo.head() {
        if let Ok(commit) = head.peel_to_commit() {
            let summary = commit.summary().unwrap_or("No commit message").to_string();
            let time = commit.time().seconds();
            let sha = commit.id().to_string();
            (summary, time, sha)
        } else {
            ("No commits yet".to_string(), 0, String::new())
        }
    } else {
        ("Initial repository".to_string(), 0, String::new())
    };

    // 4. Remote & provider detection
    let mut remote_name = None;
    let mut remote_provider = None;

    if let Ok(remotes) = repo.remotes() {
        for r_name in remotes.iter().flatten() {
            if remote_name.is_none() {
                remote_name = Some(r_name.to_string());
            }
            if let Ok(remote) = repo.find_remote(r_name) {
                if let Some(url) = remote.url() {
                    let url_lower = url.to_lowercase();
                    if url_lower.contains("gitlab") {
                        remote_provider = Some("gitlab".to_string());
                    } else if url_lower.contains("github.com") {
                        remote_provider = Some("github".to_string());
                    } else {
                        remote_provider = Some("other".to_string());
                    }
                    remote_name = Some(r_name.to_string());
                    break;
                }
            }
        }
    }

    // 5. Ahead / Behind calculation (offline graph walk against upstream)
    let mut ahead = 0;
    let mut behind = 0;

    if let Ok(head_branch) = repo.find_branch(&current_branch, git2::BranchType::Local) {
        if let Ok(upstream) = head_branch.upstream() {
            if let (Some(local_oid), Some(upstream_oid)) =
                (head_branch.get().target(), upstream.get().target())
            {
                if let Ok((a, b)) = repo.graph_ahead_behind(local_oid, upstream_oid) {
                    ahead = a as u32;
                    behind = b as u32;
                }
            }
        }
    }

    Ok(RepoDashboardStatus {
        current_branch,
        ahead,
        behind,
        dirty_files,
        last_commit_summary,
        last_commit_at,
        last_commit_sha,
        remote_name,
        remote_provider,
        is_valid: true,
        error_type: None,
        error_message: None,
    })
}
