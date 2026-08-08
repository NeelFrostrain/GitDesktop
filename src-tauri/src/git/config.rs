use serde::{Deserialize, Serialize};
use std::process::Command;
use std::path::Path;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitConfigItem {
    pub key: String,
    pub value: String,
    pub scope: String,
}

pub fn get_repo_git_config(repo_path: &str) -> Result<Vec<GitConfigItem>, AppError> {
    let output = Command::new("git")
        .arg("config")
        .arg("--local")
        .arg("-l")
        .current_dir(repo_path)
        .output()?;

    let mut items = Vec::new();

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.splitn(2, '=').collect();
            if parts.len() == 2 {
                items.push(GitConfigItem {
                    key: parts[0].to_string(),
                    value: parts[1].to_string(),
                    scope: "local".to_string(),
                });
            }
        }
    }

    Ok(items)
}

pub fn set_repo_git_config(repo_path: &str, key: &str, value: &str) -> Result<(), AppError> {
    let output = Command::new("git")
        .arg("config")
        .arg("--local")
        .arg(key)
        .arg(value)
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to set git config: {}", stderr.trim())));
    }
    Ok(())
}

pub fn read_gitignore(repo_path: &str) -> Result<String, AppError> {
    let p = Path::new(repo_path).join(".gitignore");
    if !p.exists() {
        return Ok("".to_string());
    }
    std::fs::read_to_string(p)
        .map_err(|e| AppError::Unknown(format!("Failed to read .gitignore: {}", e)))
}

pub fn write_gitignore(repo_path: &str, content: &str) -> Result<(), AppError> {
    let p = Path::new(repo_path).join(".gitignore");
    std::fs::write(p, content)
        .map_err(|e| AppError::Unknown(format!("Failed to write .gitignore: {}", e)))
}
