use crate::error::AppError;
use crate::git::command::silent_git_command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubmoduleInfo {
    pub name: String,
    pub path: String,
    pub url: String,
    pub head_sha: String,
    pub is_dirty: bool,
    pub is_initialized: bool,
}

pub fn list_submodules(repo_path: &str) -> Result<Vec<SubmoduleInfo>, AppError> {
    let output = silent_git_command()
        .arg("submodule")
        .arg("status")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut submodules = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let status_char = parts[0].chars().next().unwrap_or(' ');
            let sha = parts[0].trim_start_matches(['-', '+', 'U']).to_string();
            let path = parts[1].to_string();
            let name = path.split('/').last().unwrap_or(&path).to_string();

            let is_dirty = status_char == '+';
            let is_initialized = status_char != '-';

            submodules.push(SubmoduleInfo {
                name,
                path,
                url: "".to_string(),
                head_sha: sha,
                is_dirty,
                is_initialized,
            });
        }
    }

    Ok(submodules)
}

pub fn init_submodules(repo_path: &str) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("submodule")
        .arg("init")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to init submodules: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn update_submodules(repo_path: &str) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("submodule")
        .arg("update")
        .arg("--init")
        .arg("--recursive")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to update submodules: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn sync_submodules(repo_path: &str) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("submodule")
        .arg("sync")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to sync submodules: {}",
            stderr.trim()
        )));
    }
    Ok(())
}
