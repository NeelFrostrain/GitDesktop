use serde::{Deserialize, Serialize};
use std::process::Command;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StashEntry {
    pub index: usize,
    pub sha: String,
    pub message: String,
    pub branch: String,
    pub date: String,
}

pub fn list_stashes(repo_path: &str) -> Result<Vec<StashEntry>, AppError> {
    let output = Command::new("git")
        .arg("stash")
        .arg("list")
        .arg("--format=%gd|%h|%s|%cr")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to list stashes: {}", stderr.trim())));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut stashes = Vec::new();

    for (i, line) in stdout.lines().enumerate() {
        let parts: Vec<&str> = line.splitn(4, '|').collect();
        if parts.len() >= 4 {
            let _stash_ref = parts[0];

            let sha = parts[1].to_string();
            let msg = parts[2].to_string();
            let date = parts[3].to_string();

            let branch = if let Some(idx) = msg.find("WIP on ") {
                msg[idx + 7..].split(':').next().unwrap_or("active").to_string()
            } else if let Some(idx) = msg.find("On ") {
                msg[idx + 3..].split(':').next().unwrap_or("active").to_string()
            } else {
                "active".to_string()
            };

            stashes.push(StashEntry {
                index: i,
                sha,
                message: msg,
                branch,
                date,
            });
        }
    }

    Ok(stashes)
}

pub fn create_stash(
    repo_path: &str,
    message: Option<&str>,
    include_untracked: bool,
) -> Result<(), AppError> {
    let mut cmd = Command::new("git");
    cmd.arg("stash").arg("push");

    if include_untracked {
        cmd.arg("-u");
    }

    if let Some(m) = message {
        if !m.trim().is_empty() {
            cmd.arg("-m").arg(m.trim());
        }
    }

    cmd.current_dir(repo_path);
    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to create stash: {}", stderr.trim())));
    }

    Ok(())
}

pub fn apply_stash(repo_path: &str, index: usize) -> Result<(), AppError> {
    let output = Command::new("git")
        .arg("stash")
        .arg("apply")
        .arg(format!("stash@{{{}}}", index))
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to apply stash: {}", stderr.trim())));
    }
    Ok(())
}

pub fn pop_stash(repo_path: &str, index: usize) -> Result<(), AppError> {
    let output = Command::new("git")
        .arg("stash")
        .arg("pop")
        .arg(format!("stash@{{{}}}", index))
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to pop stash: {}", stderr.trim())));
    }
    Ok(())
}

pub fn drop_stash(repo_path: &str, index: usize) -> Result<(), AppError> {
    let output = Command::new("git")
        .arg("stash")
        .arg("drop")
        .arg(format!("stash@{{{}}}", index))
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to drop stash: {}", stderr.trim())));
    }
    Ok(())
}

pub fn get_stash_diff(repo_path: &str, index: usize) -> Result<String, AppError> {
    let output = Command::new("git")
        .arg("stash")
        .arg("show")
        .arg("-p")
        .arg(format!("stash@{{{}}}", index))
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to show stash diff: {}", stderr.trim())));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
