use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorktreeInfo {
    pub path: String,
    pub head_sha: String,
    pub branch: String,
    pub is_bare: bool,
    pub is_detached: bool,
    pub is_locked: bool,
    pub lock_reason: Option<String>,
}

pub fn list_worktrees(repo_path: &str) -> Result<Vec<WorktreeInfo>, AppError> {
    let output = Command::new("git")
        .arg("worktree")
        .arg("list")
        .arg("--porcelain")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to list worktrees: {}",
            stderr.trim()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut worktrees = Vec::new();

    let mut current_path = String::new();
    let mut current_head = String::new();
    let mut current_branch = String::new();
    let mut is_bare = false;
    let mut is_detached = false;
    let mut is_locked = false;
    let mut lock_reason: Option<String> = None;

    for line in stdout.lines() {
        if line.is_empty() {
            if !current_path.is_empty() {
                worktrees.push(WorktreeInfo {
                    path: current_path.clone(),
                    head_sha: current_head.clone(),
                    branch: current_branch.clone(),
                    is_bare,
                    is_detached,
                    is_locked,
                    lock_reason: lock_reason.clone(),
                });
                current_path.clear();
                current_head.clear();
                current_branch.clear();
                is_bare = false;
                is_detached = false;
                is_locked = false;
                lock_reason = None;
            }
            continue;
        }

        if let Some(val) = line.strip_prefix("worktree ") {
            current_path = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("HEAD ") {
            current_head = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("branch ") {
            let full_ref = val.trim();
            current_branch = full_ref
                .strip_prefix("refs/heads/")
                .unwrap_or(full_ref)
                .to_string();
        } else if line == "bare" {
            is_bare = true;
        } else if line == "detached" {
            is_detached = true;
        } else if line.starts_with("locked") {
            is_locked = true;
            if let Some(reason) = line.strip_prefix("locked ") {
                lock_reason = Some(reason.trim().to_string());
            }
        }
    }

    if !current_path.is_empty() {
        worktrees.push(WorktreeInfo {
            path: current_path,
            head_sha: current_head,
            branch: current_branch,
            is_bare,
            is_detached,
            is_locked,
            lock_reason,
        });
    }

    Ok(worktrees)
}

pub fn add_worktree(
    repo_path: &str,
    worktree_path: &str,
    branch_name: Option<&str>,
) -> Result<(), AppError> {
    let mut cmd = Command::new("git");
    cmd.arg("worktree").arg("add").arg(worktree_path);
    if let Some(b) = branch_name {
        if !b.trim().is_empty() {
            cmd.arg(b.trim());
        }
    }
    let output = cmd.current_dir(repo_path).output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to add worktree: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn remove_worktree(repo_path: &str, worktree_path: &str, force: bool) -> Result<(), AppError> {
    let mut cmd = Command::new("git");
    cmd.arg("worktree").arg("remove").arg(worktree_path);
    if force {
        cmd.arg("--force");
    }
    let output = cmd.current_dir(repo_path).output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to remove worktree: {}",
            stderr.trim()
        )));
    }
    Ok(())
}
