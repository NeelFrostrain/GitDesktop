use serde::{Deserialize, Serialize};
use std::process::Command;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReflogEntry {
    pub index: usize,
    pub sha: String,
    pub action: String,
    pub message: String,
    pub date: String,
}

pub fn list_reflog(repo_path: &str, limit: Option<usize>) -> Result<Vec<ReflogEntry>, AppError> {
    let lim = limit.unwrap_or(50);
    let output = Command::new("git")
        .arg("reflog")
        .arg("show")
        .arg(format!("-n{}", lim))
        .arg("--format=%gd|%h|%gs|%cr")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to list reflog: {}", stderr.trim())));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut entries = Vec::new();

    for (i, line) in stdout.lines().enumerate() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 4 {
            let action = parts[2].split(':').next().unwrap_or("HEAD").to_string();
            entries.push(ReflogEntry {
                index: i,
                sha: parts[1].to_string(),
                action,
                message: parts[2].to_string(),
                date: parts[3].to_string(),
            });
        }
    }

    Ok(entries)
}

pub fn restore_reflog_target(repo_path: &str, sha: &str, force: bool) -> Result<(), AppError> {
    let mut cmd = Command::new("git");
    cmd.arg("reset");

    if force {
        cmd.arg("--hard");
    } else {
        cmd.arg("--mixed");
    }

    cmd.arg(sha);
    cmd.current_dir(repo_path);

    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to restore reflog target: {}", stderr.trim())));
    }

    Ok(())
}

pub fn revert_commit(repo_path: &str, sha: &str) -> Result<(), AppError> {
    let output = Command::new("git")
        .arg("revert")
        .arg("--no-edit")
        .arg(sha)
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to revert commit: {}", stderr.trim())));
    }

    Ok(())
}
