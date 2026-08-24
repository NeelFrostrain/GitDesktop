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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
    pub push_url: Option<String>,
    pub is_default: bool,
    pub ahead: usize,
    pub behind: usize,
}

pub struct GitAuthInfo {
    pub token: Option<String>,
    pub username: Option<String>,
    pub provider: String,
}

/// Retrieve authentication info for a given remote URL or repo path
pub fn get_git_auth_info_for_url(repo_path: &str, remote_url: Option<&str>) -> GitAuthInfo {
    let accounts = keyring::list_accounts();

    // 1. If remote_url is provided, match account by URL host
    if let Some(url) = remote_url {
        let url_lower = url.to_lowercase();
        for acct in &accounts {
            let host = acct.server_url
                .trim_start_matches("https://")
                .trim_start_matches("http://")
                .trim_end_matches('/')
                .to_lowercase();
            
            if !host.is_empty() && url_lower.contains(&host) {
                return GitAuthInfo {
                    token: Some(acct.token.clone()),
                    username: Some(acct.username.clone()),
                    provider: acct.provider.clone(),
                };
            }
        }
    }

    // 2. Check if a specific account is linked to this repository
    let acct = keyring::get_account_for_repo(repo_path);
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

                // Clean legacy embedded credentials from the git remote URL
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

    // 3. Match token to provider
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

pub fn get_git_auth_info(repo_path: &str) -> GitAuthInfo {
    get_git_auth_info_for_url(repo_path, None)
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

/// List all remotes configured for a repository with ahead/behind counts
pub fn list_remotes(repo_path: &str) -> Result<Vec<RemoteInfo>, AppError> {
    let repo = Repository::open(repo_path)?;
    let remotes_str = repo.remotes()?;
    let current_branch = repo.head().ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .unwrap_or_else(|| "main".to_string());

    let mut remotes = Vec::new();

    for name_opt in remotes_str.iter() {
        if let Some(name) = name_opt {
            if let Ok(remote) = repo.find_remote(name) {
                let url = remote.url().unwrap_or("").to_string();
                let push_url = remote.pushurl().map(|s| s.to_string());
                let is_default = name == "origin";

                // Calculate ahead/behind for this specific remote
                let remote_ref = format!("{}/{}", name, current_branch);
                let (ahead, behind) = get_remote_ahead_behind(repo_path, &remote_ref);

                remotes.push(RemoteInfo {
                    name: name.to_string(),
                    url,
                    push_url,
                    is_default,
                    ahead,
                    behind,
                });
            }
        }
    }

    Ok(remotes)
}

fn get_remote_ahead_behind(repo_path: &str, remote_ref: &str) -> (usize, usize) {
    let ref_exists = Command::new("git")
        .args(["show-ref", "--quiet", "--verify", &format!("refs/remotes/{}", remote_ref)])
        .current_dir(repo_path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !ref_exists {
        let count = Command::new("git")
            .args(["rev-list", "--count", "HEAD"])
            .current_dir(repo_path)
            .output()
            .ok()
            .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<usize>().ok())
            .unwrap_or(0);
        return (count, 0);
    }

    let ahead = Command::new("git")
        .args(["rev-list", "--count", &format!("{}..HEAD", remote_ref)])
        .current_dir(repo_path)
        .output()
        .ok()
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<usize>().ok())
        .unwrap_or(0);

    let behind = Command::new("git")
        .args(["rev-list", "--count", &format!("HEAD..{}", remote_ref)])
        .current_dir(repo_path)
        .output()
        .ok()
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<usize>().ok())
        .unwrap_or(0);

    (ahead, behind)
}

/// Add a new remote to the repository
pub fn add_remote(repo_path: &str, name: &str, url: &str) -> Result<(), AppError> {
    let clean_name = name.trim();
    let clean_url = url.trim();

    if clean_name.is_empty() || clean_url.is_empty() {
        return Err(AppError::Validation("Remote name and URL cannot be empty".to_string()));
    }

    let output = Command::new("git")
        .args(["remote", "add", clean_name, clean_url])
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to add remote: {}", stderr.trim())));
    }

    Ok(())
}

/// Remove a remote from the repository
pub fn remove_remote(repo_path: &str, name: &str) -> Result<(), AppError> {
    let clean_name = name.trim();
    if clean_name.is_empty() {
        return Err(AppError::Validation("Remote name cannot be empty".to_string()));
    }

    let output = Command::new("git")
        .args(["remote", "remove", clean_name])
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to remove remote: {}", stderr.trim())));
    }

    Ok(())
}

/// Rename an existing remote
pub fn rename_remote(repo_path: &str, old_name: &str, new_name: &str) -> Result<(), AppError> {
    let clean_old = old_name.trim();
    let clean_new = new_name.trim();

    if clean_old.is_empty() || clean_new.is_empty() {
        return Err(AppError::Validation("Remote names cannot be empty".to_string()));
    }

    let output = Command::new("git")
        .args(["remote", "rename", clean_old, clean_new])
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to rename remote: {}", stderr.trim())));
    }

    Ok(())
}

/// Set URL or Push URL for a remote
pub fn set_remote_url(repo_path: &str, name: &str, url: &str, is_push: bool) -> Result<(), AppError> {
    let clean_name = name.trim();
    let clean_url = url.trim();

    if clean_name.is_empty() || clean_url.is_empty() {
        return Err(AppError::Validation("Remote name and URL cannot be empty".to_string()));
    }

    let mut cmd = Command::new("git");
    cmd.arg("remote").arg("set-url");
    if is_push {
        cmd.arg("--push");
    }
    cmd.arg(clean_name).arg(clean_url);
    cmd.current_dir(repo_path);

    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to set remote URL: {}", stderr.trim())));
    }

    Ok(())
}

/// Fetch from all remotes or a specific remote
pub fn fetch_remote(repo_path: &str) -> Result<(), AppError> {
    fetch_specific_remote(repo_path, "")
}

pub fn fetch_specific_remote(repo_path: &str, remote_name: &str) -> Result<(), AppError> {
    let clean_remote = remote_name.trim();
    let auth_info = get_git_auth_info(repo_path);

    let mut cmd = Command::new("git");
    cmd.current_dir(repo_path);
    apply_git_auth_args(&mut cmd, &auth_info);

    if clean_remote.is_empty() {
        cmd.arg("fetch").arg("--all").arg("--prune");
    } else {
        cmd.arg("fetch").arg(clean_remote).arg("--prune");
    }

    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if stderr.contains("HTTP Basic: Access denied") || stderr.contains("Authentication failed") {
            return Err(AppError::Auth(
                format!("Authentication failed for remote fetch: {}", stderr.trim())
            ));
        }
        return Err(AppError::Git(format!("Fetch failed: {}", stderr.trim())));
    }

    Ok(())
}

/// Push to a specific remote and branch
pub fn push_to_remote(repo_path: &str, branch_name: &str) -> Result<(), AppError> {
    push_specific_remote(repo_path, "origin", branch_name, false)
}

pub fn push_specific_remote(
    repo_path: &str,
    remote_name: &str,
    branch_name: &str,
    force: bool,
) -> Result<(), AppError> {
    let clean_remote = if remote_name.trim().is_empty() { "origin" } else { remote_name.trim() };
    let clean_branch = branch_name.trim();
    let auth_info = get_git_auth_info(repo_path);

    let mut cmd = Command::new("git");
    cmd.current_dir(repo_path);
    apply_git_auth_args(&mut cmd, &auth_info);

    cmd.arg("push").arg("-u");
    if force {
        cmd.arg("--force-with-lease");
    }
    cmd.arg(clean_remote).arg(clean_branch);

    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let combined = format!("{}\n{}", stderr.trim(), stdout.trim());
        let err_msg = combined.trim().to_string();
        let lower = err_msg.to_lowercase();

        if lower.contains("refusing to update checked out branch") {
            return Err(AppError::Git(format!(
                "Push rejected: Remote branch '{}' is checked out on the remote repository.",
                clean_branch
            )));
        }

        if lower.contains("fetch first") || lower.contains("non-fast-forward") || lower.contains("remote contains work") {
            return Err(AppError::Git(format!(
                "Push rejected: Remote '{}' has newer changes. Please Pull/Fetch first before pushing.",
                clean_remote
            )));
        }

        if lower.contains("protected branch") || lower.contains("hook declined") {
            return Err(AppError::Git(format!(
                "Push rejected: Protected branch rule or server hook declined the push on '{}'.",
                clean_remote
            )));
        }

        if lower.contains("http basic: access denied")
            || lower.contains("authentication failed")
            || lower.contains("permission denied")
            || lower.contains("could not read username")
            || lower.contains("invalid username or password")
        {
            return Err(AppError::Auth(format!(
                "Access Denied: Please verify your credentials for remote '{}'.",
                clean_remote
            )));
        }

        if lower.contains("secret scanning") || lower.contains("push protection") {
            return Err(AppError::Git(
                "Push blocked by Secret Protection. Check your commits for sensitive credentials or keys.".to_string(),
            ));
        }

        if let Some(idx) = err_msg.find("! [remote rejected]") {
            let rejection_line = err_msg[idx..].lines().next().unwrap_or("! [remote rejected]");
            return Err(AppError::Git(format!("Push rejected: {}", rejection_line)));
        }

        // Clean out boilerplate "To https://..." lines to present the actionable failure line
        let clean_summary: String = err_msg
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty() && !l.starts_with("To http") && !l.starts_with("To git@") && !l.starts_with("To ssh://"))
            .collect::<Vec<_>>()
            .join(" | ");

        let final_err = if !clean_summary.is_empty() { clean_summary } else { err_msg };
        return Err(AppError::Git(format!("Failed to push to remote '{}': {}", clean_remote, final_err)));
    }

    Ok(())
}

/// Pull from a specific remote and branch
pub fn pull_from_remote(repo_path: &str, branch_name: &str) -> Result<PullResult, AppError> {
    pull_specific_remote(repo_path, "origin", branch_name)
}

pub fn pull_specific_remote(
    repo_path: &str,
    remote_name: &str,
    branch_name: &str,
) -> Result<PullResult, AppError> {
    let clean_remote = if remote_name.trim().is_empty() { "origin" } else { remote_name.trim() };
    let clean_branch = branch_name.trim();
    let auth_info = get_git_auth_info(repo_path);

    let head_before = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(repo_path)
        .output()
        .ok()
        .and_then(|o| if o.status.success() {
            Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
        } else {
            None
        });

    let mut cmd = Command::new("git");
    cmd.current_dir(repo_path);
    apply_git_auth_args(&mut cmd, &auth_info);

    cmd.arg("pull").arg("--no-rebase");
    if !clean_branch.is_empty() && clean_branch != "HEAD" {
        cmd.arg(clean_remote).arg(clean_branch);
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
                format!("Access Denied: Stored token is invalid for remote '{}'.", clean_remote)
            ));
        }

        return Err(AppError::Git(format!("Git pull failed from '{}': {}", clean_remote, stderr.trim())));
    }

    let commits_pulled = if let Some(ref old_head) = head_before {
        Command::new("git")
            .args(["rev-list", "--count", &format!("{}..HEAD", old_head)])
            .current_dir(repo_path)
            .output()
            .ok()
            .and_then(|o| if o.status.success() {
                String::from_utf8_lossy(&o.stdout).trim().parse::<usize>().ok()
            } else {
                None
            })
            .unwrap_or(0)
    } else {
        0
    };

    Ok(PullResult {
        success: true,
        conflicts: Vec::new(),
        commits_pulled,
    })
}

pub fn clone_repository(remote_url: &str, local_path: &str) -> Result<(), AppError> {
    let path = Path::new(local_path);
    if path.exists() && fs_is_not_empty(path) {
        return Err(AppError::Validation(format!("Destination path '{}' is not empty", local_path)));
    }

    let auth_info = get_git_auth_info_for_url(".", Some(remote_url));

    let mut cmd = Command::new("git");
    apply_git_auth_args(&mut cmd, &auth_info);
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
