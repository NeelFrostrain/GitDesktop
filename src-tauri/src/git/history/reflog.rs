use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::process::Command;

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
        return Err(AppError::Git(format!(
            "Failed to list reflog: {}",
            stderr.trim()
        )));
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
        return Err(AppError::Git(format!(
            "Failed to restore reflog target: {}",
            stderr.trim()
        )));
    }

    Ok(())
}

pub fn revert_commit(repo_path: &str, sha: &str) -> Result<(), AppError> {
    // Check for uncommitted changes first
    let status_output = Command::new("git")
        .arg("status")
        .arg("--porcelain")
        .current_dir(repo_path)
        .output()?;

    if status_output.status.success() {
        let status_str = String::from_utf8_lossy(&status_output.stdout);
        if !status_str.trim().is_empty() {
            return Err(AppError::Git(
                "Cannot revert commit with uncommitted changes in your working directory. Please commit or stash your changes first.".to_string()
            ));
        }
    }

    // Attempt standard revert
    let mut output = Command::new("git")
        .arg("revert")
        .arg("--no-edit")
        .arg(sha)
        .current_dir(repo_path)
        .output()?;

    // If commit is a merge commit, retry with -m 1
    if !output.status.success() {
        let err_text = format!(
            "{} {}",
            String::from_utf8_lossy(&output.stderr),
            String::from_utf8_lossy(&output.stdout)
        );
        if err_text.contains("is a merge but no -m option was given") {
            let _ = Command::new("git")
                .arg("revert")
                .arg("--abort")
                .current_dir(repo_path)
                .output();

            output = Command::new("git")
                .arg("revert")
                .arg("-m")
                .arg("1")
                .arg("--no-edit")
                .arg(sha)
                .current_dir(repo_path)
                .output()?;
        }
    }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let combined = format!("{}\n{}", stderr.trim(), stdout.trim());

        let err_detail =
            if combined.contains("nothing to commit") || combined.contains("working tree clean") {
                "The changes in this commit have already been reverted or are empty.".to_string()
            } else if !stderr.trim().is_empty() {
                stderr.trim().to_string()
            } else if !stdout.trim().is_empty() {
                stdout.trim().to_string()
            } else {
                "Revert failed (check for merge conflicts)".to_string()
            };

        // Abort failed revert to keep working directory clean
        let _ = Command::new("git")
            .arg("revert")
            .arg("--abort")
            .current_dir(repo_path)
            .output();

        return Err(AppError::Git(format!(
            "Failed to revert commit: {}",
            err_detail
        )));
    }

    Ok(())
}

pub fn undo_commit(repo_path: &str) -> Result<String, AppError> {
    let msg_out = Command::new("git")
        .args(["log", "-1", "--format=%B"])
        .current_dir(repo_path)
        .output()?;
    let msg = String::from_utf8_lossy(&msg_out.stdout).trim().to_string();

    let output = Command::new("git")
        .args(["reset", "--soft", "HEAD~1"])
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to undo commit: {}",
            stderr.trim()
        )));
    }

    Ok(msg)
}
