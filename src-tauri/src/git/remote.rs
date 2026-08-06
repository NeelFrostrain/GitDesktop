use serde::{Deserialize, Serialize};
use git2::Repository;
use std::process::Command;
use std::path::Path;
use crate::error::AppError;
use crate::auth::keyring;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PullResult {
    pub success: bool,
    pub conflicts: Vec<String>,
    pub commits_pulled: usize,
}

use base64::{engine::general_purpose::STANDARD, Engine};

struct GitAuthInfo {
    token: Option<String>,
}

fn get_git_auth_info(repo_path: &str) -> GitAuthInfo {
    let token = keyring::get_token().unwrap_or(None).filter(|t| !t.trim().is_empty());

    let repo = match Repository::open(repo_path) {
        Ok(r) => r,
        Err(_) => return GitAuthInfo { token },
    };

    let remote_name = if repo.find_remote("origin").is_ok() {
        "origin"
    } else if repo.find_remote("upstream").is_ok() {
        "upstream"
    } else {
        "origin"
    };

    let current_url = repo.find_remote(remote_name).ok().and_then(|r| r.url().map(String::from));

    let authenticated_url = if let (Some(url), Some(ref t)) = (&current_url, &token) {
        if url.starts_with("https://") {
            let url_without_scheme = &url["https://".len()..];
            let clean_host_and_path = if let Some(idx) = url_without_scheme.find('@') {
                &url_without_scheme[idx + 1..]
            } else {
                url_without_scheme
            };
            Some(format!("https://oauth2:{}@{}", t, clean_host_and_path))
        } else {
            None
        }
    } else {
        None
    };

    if let (Some(ref auth_url), Some(ref orig_url)) = (&authenticated_url, &current_url) {
        if auth_url != orig_url {
            let _ = Command::new("git")
                .arg("remote")
                .arg("set-url")
                .arg(remote_name)
                .arg(auth_url)
                .current_dir(repo_path)
                .output();
        }
    }

    GitAuthInfo { token }
}

pub fn fetch_remote(repo_path: &str) -> Result<(), AppError> {
    let auth_info = get_git_auth_info(repo_path);

    let mut cmd = Command::new("git");
    cmd.current_dir(repo_path);

    if let Some(ref t) = auth_info.token {
        let auth_str = format!("oauth2:{}", t);
        let encoded = STANDARD.encode(auth_str.as_bytes());
        cmd.arg("-c")
           .arg(format!("http.extraHeader=Authorization: Basic {}", encoded))
           .arg("-c")
           .arg("credential.helper=");
    }

    cmd.arg("fetch").arg("--all").arg("--prune");

    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if stderr.contains("HTTP Basic: Access denied") || stderr.contains("Authentication failed") {
            if auth_info.token.is_none() {
                return Err(AppError::Auth(
                    "Authentication Required: Please sign in to your GitLab account in Account & Auth to fetch remote.".to_string()
                ));
            }
        }
        return Err(AppError::Git(format!("Fetch failed: {}", stderr.trim())));
    }

    Ok(())
}

pub fn push_to_remote(repo_path: &str, branch_name: &str) -> Result<(), AppError> {
    let auth_info = get_git_auth_info(repo_path);

    let mut cmd = Command::new("git");
    cmd.current_dir(repo_path);

    if let Some(ref t) = auth_info.token {
        let auth_str = format!("oauth2:{}", t);
        let encoded = STANDARD.encode(auth_str.as_bytes());
        cmd.arg("-c")
           .arg(format!("http.extraHeader=Authorization: Basic {}", encoded))
           .arg("-c")
           .arg("credential.helper=");
    }

    // Always push to "origin" by name (NOT the URL) so that:
    //   git push -u origin <branch>
    // correctly sets the upstream tracking ref (branch.<name>.remote=origin,
    // branch.<name>.merge=refs/heads/<name>). Passing a URL instead of a remote
    // name prevents -u from configuring tracking, so status would keep showing
    // "Push N commits" even after a successful push.
    // Auth credentials are already baked into remote.origin.url by get_git_auth_info.
    cmd.arg("push").arg("-u").arg("origin").arg(branch_name);

    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        
        if stderr.contains("HTTP Basic: Access denied") || stderr.contains("Authentication failed") {
            if auth_info.token.is_none() {
                return Err(AppError::Auth(
                    "Authentication Required: Please sign in to your GitLab account in Account & Auth to push to remote.".to_string()
                ));
            }
            return Err(AppError::Auth(
                "Access Denied: Stored token does not have push permissions for this repository. Please re-login in Account & Auth.".to_string()
            ));
        }

        return Err(AppError::Git(format!("Failed to push to remote: {}", stderr.trim())));
    }

    Ok(())
}

pub fn pull_from_remote(repo_path: &str, _branch_name: &str) -> Result<PullResult, AppError> {
    let auth_info = get_git_auth_info(repo_path);

    let mut cmd = Command::new("git");
    cmd.current_dir(repo_path);

    if let Some(ref t) = auth_info.token {
        let auth_str = format!("oauth2:{}", t);
        let encoded = STANDARD.encode(auth_str.as_bytes());
        cmd.arg("-c")
           .arg(format!("http.extraHeader=Authorization: Basic {}", encoded))
           .arg("-c")
           .arg("credential.helper=");
    }

    cmd.arg("pull").arg("--no-rebase");

    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        
        let repo = Repository::open(repo_path)?;
        let mut conflicts = Vec::new();
        let statuses = repo.statuses(None)?;
        for entry in statuses.iter() {
            if entry.status().contains(git2::Status::CONFLICTED) {
                if let Some(p) = entry.path() {
                    conflicts.push(p.to_string());
                }
            }
        }

        if !conflicts.is_empty() {
            return Ok(PullResult {
                success: false,
                conflicts,
                commits_pulled: 0,
            });
        }

        return Err(AppError::Git(format!("Git pull failed: {}", stderr.trim())));
    }

    Ok(PullResult {
        success: true,
        conflicts: Vec::new(),
        commits_pulled: 1,
    })
}

pub fn clone_repository(remote_url: &str, local_path: &str) -> Result<(), AppError> {
    let path = Path::new(local_path);
    if path.exists() && fs_is_not_empty(path) {
        return Err(AppError::Validation(format!("Destination path '{}' is not empty", local_path)));
    }

    let token = keyring::get_token().unwrap_or(None);
    let mut authenticated_url = remote_url.to_string();

    if let Some(ref t) = token {
        if remote_url.starts_with("https://") {
            authenticated_url = remote_url.replacen("https://", &format!("https://oauth2:{}@", t), 1);
        }
    }

    let output = Command::new("git")
        .arg("clone")
        .arg(&authenticated_url)
        .arg(local_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(AppError::Git(format!("Failed to clone repository: {}", stderr)));
    }

    Ok(())
}

fn fs_is_not_empty(path: &Path) -> bool {
    if let Ok(mut entries) = std::fs::read_dir(path) {
        entries.next().is_some()
    } else {
        false
    }
}
