use crate::error::AppError;
use crate::git::command::silent_git_command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LfsFile {
    pub path: String,
    pub oid: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LfsLock {
    pub id: String,
    pub path: String,
    pub owner: String,
    pub locked_at: String,
}

pub fn check_lfs_installed() -> bool {
    silent_git_command()
        .arg("lfs")
        .arg("version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

pub fn list_lfs_files(repo_path: &str) -> Result<Vec<LfsFile>, AppError> {
    let output = silent_git_command()
        .arg("lfs")
        .arg("ls-files")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to list LFS files: {}",
            stderr.trim()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut files = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            let oid = parts[0].to_string();
            let mode_or_marker = parts[1];
            let path = parts[2..].join(" ");
            let size = if mode_or_marker.starts_with('-') || mode_or_marker.starts_with('*') {
                0
            } else {
                0
            };
            files.push(LfsFile { path, oid, size });
        } else if parts.len() >= 2 {
            files.push(LfsFile {
                oid: parts[0].to_string(),
                path: parts[1..].join(" "),
                size: 0,
            });
        }
    }

    Ok(files)
}

pub fn track_lfs_pattern(repo_path: &str, pattern: &str) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("lfs")
        .arg("track")
        .arg(pattern)
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to track pattern: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn untrack_lfs_pattern(repo_path: &str, pattern: &str) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("lfs")
        .arg("untrack")
        .arg(pattern)
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to untrack pattern: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn list_lfs_locks(repo_path: &str) -> Result<Vec<LfsLock>, AppError> {
    let output = silent_git_command()
        .arg("lfs")
        .arg("locks")
        .arg("--json")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        // Fallback to text parsing if --json is unsupported
        let text_output = silent_git_command()
            .arg("lfs")
            .arg("locks")
            .current_dir(repo_path)
            .output()?;

        let stdout = String::from_utf8_lossy(&text_output.stdout);
        let mut locks = Vec::new();
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let id = format!("lock-{}", locks.len() + 1);
                locks.push(LfsLock {
                    id,
                    path: parts[0].to_string(),
                    owner: parts[1..].join(" "),
                    locked_at: "active".to_string(),
                });
            }
        }
        return Ok(locks);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    #[derive(Deserialize)]
    struct RawLock {
        id: String,
        path: String,
        owner: Option<RawOwner>,
        locked_at: Option<String>,
    }
    #[derive(Deserialize)]
    struct RawOwner {
        name: Option<String>,
    }

    let raw_locks: Vec<RawLock> = serde_json::from_str(&stdout).unwrap_or_default();
    let locks = raw_locks
        .into_iter()
        .map(|l| LfsLock {
            id: l.id,
            path: l.path,
            owner: l
                .owner
                .and_then(|o| o.name)
                .unwrap_or_else(|| "Unknown".to_string()),
            locked_at: l.locked_at.unwrap_or_else(|| "Active".to_string()),
        })
        .collect();

    Ok(locks)
}

pub fn lock_lfs_file(repo_path: &str, path: &str) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("lfs")
        .arg("lock")
        .arg(path)
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to lock file: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn unlock_lfs_file(repo_path: &str, path: &str, force: bool) -> Result<(), AppError> {
    let mut cmd = silent_git_command();
    cmd.arg("lfs").arg("unlock").arg(path);
    if force {
        cmd.arg("--force");
    }
    let output = cmd.current_dir(repo_path).output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to unlock file: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn install_lfs(repo_path: &str) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("lfs")
        .arg("install")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to install Git LFS hooks: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn lfs_pull(repo_path: &str) -> Result<String, AppError> {
    let output = silent_git_command()
        .arg("lfs")
        .arg("pull")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to pull LFS objects: {}",
            stderr.trim()
        )));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn lfs_fetch(repo_path: &str, remote: Option<&str>) -> Result<String, AppError> {
    let mut cmd = silent_git_command();
    cmd.arg("lfs").arg("fetch");
    if let Some(r) = remote {
        cmd.arg(r);
    }
    cmd.arg("--all");
    let output = cmd.current_dir(repo_path).output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to fetch LFS objects: {}",
            stderr.trim()
        )));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn lfs_push(repo_path: &str, remote: Option<&str>) -> Result<String, AppError> {
    let mut cmd = silent_git_command();
    cmd.arg("lfs").arg("push");
    let r = remote.unwrap_or("origin");
    cmd.arg(r).arg("--all");
    let output = cmd.current_dir(repo_path).output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to push LFS objects: {}",
            stderr.trim()
        )));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn list_tracked_patterns(repo_path: &str) -> Result<Vec<String>, AppError> {
    let output = silent_git_command()
        .arg("lfs")
        .arg("track")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut patterns = Vec::new();
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Listing tracked patterns") || trimmed.is_empty() {
            continue;
        }
        let pattern_part = trimmed.split('(').next().unwrap_or(trimmed).trim();
        if !pattern_part.is_empty() {
            patterns.push(pattern_part.to_string());
        }
    }
    Ok(patterns)
}
