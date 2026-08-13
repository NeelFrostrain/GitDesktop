use serde::{Deserialize, Serialize};
use git2::Repository;
use std::process::Command;
use std::path::Path;
use crate::error::AppError;
use crate::auth::keyring;
use base64::{engine::general_purpose::STANDARD, Engine};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PullResult {
    pub success: bool,
    pub conflicts: Vec<String>,
    pub commits_pulled: usize,
}

pub struct GitAuthInfo {
    pub token: Option<String>,
    pub username: Option<String>,
    pub provider: String,
}

pub fn get_git_auth_info(repo_path: &str) -> GitAuthInfo {
    // 1. Check if a specific account is linked to this repository
    let acct = keyring::get_account_for_repo(repo_path);

    // 2. Determine provider from linked account or auto-detect from remote URL
    let mut repo_provider = acct.as_ref().map(|a| a.provider.clone());

    if let Ok(repo) = Repository::open(repo_path) {
        let remote_name = if repo.find_remote("origin").is_ok() {
            "origin"
        } else if repo.find_remote("upstream").is_ok() {
            "upstream"
        } else {
            "origin"
        };

        if let Ok(remote) = repo.find_remote(remote_name) {
            if let Some(url) = remote.url() {
                let url_lower = url.to_lowercase();
                if repo_provider.is_none() {
                    if url_lower.contains("github.com") {
                        repo_provider = Some("github".to_string());
                    } else if url_lower.contains("gitlab") {
                        repo_provider = Some("gitlab".to_string());
                    }
                }

                // Clean legacy embedded credentials from the git remote URL (e.g. https://oauth2:token@host/repo.git -> https://host/repo.git)
                if url.starts_with("https://") && url.contains('@') {
                    let url_without_scheme = &url["https://".len()..];
                    if let Some(idx) = url_without_scheme.find('@') {
                        let clean_url = format!("https://{}", &url_without_scheme[idx + 1..]);
                        let _ = Command::new("git")
                            .arg("remote")
                            .arg("set-url")
                            .arg(remote_name)
                            .arg(&clean_url)
                            .current_dir(repo_path)
                            .output();
                    }
                }
            }
        }
    }

    let provider = repo_provider.unwrap_or_else(|| "gitlab".to_string());

    // 3. Match token to provider: only use token if account provider matches repo provider
    let (token, username) = if let Some(a) = acct {
        (Some(a.token), Some(a.username))
    } else if let Some(active) = keyring::get_active_account() {
        if active.provider == provider {
            (Some(active.token), Some(active.username))
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    GitAuthInfo { token, username, provider }
}

pub fn apply_git_auth_args_pub(cmd: &mut Command, auth_info: &GitAuthInfo) {
    apply_git_auth_args(cmd, auth_info);
}

fn apply_git_auth_args(cmd: &mut Command, auth_info: &GitAuthInfo) {
    if let Some(ref t) = auth_info.token {
        let t_clean = t.trim();
        if !t_clean.is_empty() {
            let auth_user = if auth_info.provider == "github" { "x-access-token" } else { "oauth2" };
            let auth_str = format!("{}:{}", auth_user, t_clean);
            let encoded = STANDARD.encode(auth_str.as_bytes());

            cmd.arg("-c")
               .arg(format!("http.extraHeader=Authorization: Basic {}", encoded))
               .arg("-c")
               .arg("credential.helper=");
        }
    }
}

pub fn fetch_remote(repo_path: &str) -> Result<(), AppError> {
    let auth_info = get_git_auth_info(repo_path);

    let mut cmd = Command::new("git");
    cmd.current_dir(repo_path);
    apply_git_auth_args(&mut cmd, &auth_info);

    cmd.arg("fetch").arg("--all").arg("--prune");

    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if stderr.contains("HTTP Basic: Access denied") || stderr.contains("Authentication failed") {
            if auth_info.token.is_none() {
                return Err(AppError::Auth(
                    format!("Authentication Required: Please sign in to your account in Account Services to fetch from {}.", auth_info.provider)
                ));
            }
            return Err(AppError::Auth(
                format!("Access Denied: {}", stderr.trim())
            ));
        }
        return Err(AppError::Git(format!("Fetch failed: {}", stderr.trim())));
    }

    Ok(())
}

pub fn push_to_remote(repo_path: &str, branch_name: &str) -> Result<(), AppError> {
    let auth_info = get_git_auth_info(repo_path);

    let mut cmd = Command::new("git");
    cmd.current_dir(repo_path);
    apply_git_auth_args(&mut cmd, &auth_info);

    cmd.arg("push").arg("-u").arg("origin").arg(branch_name);

    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let combined = format!("{}\n{}", stderr.trim(), stdout.trim());
        let err_msg = combined.trim().to_string();

        if err_msg.contains("HTTP Basic: Access denied") || err_msg.contains("Authentication failed") || err_msg.contains("Permission denied") {
            if auth_info.token.is_none() {
                return Err(AppError::Auth(
                    format!("Authentication Required: Please sign in to your account in Account Services to push to {}.", auth_info.provider)
                ));
            }
            return Err(AppError::Auth(
                format!("Access Denied: {}", err_msg)
            ));
        }

        return Err(AppError::Git(format!("Failed to push to remote: {}", err_msg)));
    }

    Ok(())
}

pub fn pull_from_remote(repo_path: &str, branch_name: &str) -> Result<PullResult, AppError> {
    let auth_info = get_git_auth_info(repo_path);

    let mut cmd = Command::new("git");
    cmd.current_dir(repo_path);
    apply_git_auth_args(&mut cmd, &auth_info);

    cmd.arg("pull").arg("--no-rebase");
    if !branch_name.trim().is_empty() && branch_name != "HEAD" {
        cmd.arg("origin").arg(branch_name.trim());
    }

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

        if stderr.contains("HTTP Basic: Access denied") || stderr.contains("Authentication failed") {
            return Err(AppError::Auth(
                "Access Denied: Stored token is invalid or lacks pull permissions. Please re-authenticate in Account Services.".to_string()
            ));
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

    let target_provider = if remote_url.to_lowercase().contains("github.com") { "github" } else { "gitlab" };
    let active_acct = keyring::get_active_account();
    let token = active_acct.as_ref().and_then(|a| if a.provider == target_provider { Some(&a.token) } else { None });

    let mut cmd = Command::new("git");
    
    if let Some(t) = token {
        let t_clean = t.trim();
        if !t_clean.is_empty() {
            let auth_user = if target_provider == "github" { "x-access-token" } else { "oauth2" };
            let auth_str = format!("{}:{}", auth_user, t_clean);
            let encoded = STANDARD.encode(auth_str.as_bytes());

            cmd.arg("-c")
               .arg(format!("http.extraHeader=Authorization: Basic {}", encoded))
               .arg("-c")
               .arg("credential.helper=");
        }
    }

    cmd.arg("clone").arg(remote_url).arg(local_path);

    let output = cmd.output()?;

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
