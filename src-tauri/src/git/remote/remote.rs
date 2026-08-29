use crate::auth::keyring;
use crate::error::AppError;
use crate::git::command::silent_git_command;
use base64::{engine::general_purpose::STANDARD, Engine};
use git2::Repository;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

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
    // 1. Check multi-provider token_store registry first
    let prov_accounts = crate::domain::accounts::token_store::list_accounts();
    if let Some(url) = remote_url {
        let url_lower = url.to_lowercase();

        // 1a. First check active accounts matching URL
        for acct in &prov_accounts {
            if !acct.is_active {
                continue;
            }
            let host = acct
                .instance_url
                .trim_start_matches("https://")
                .trim_start_matches("http://")
                .trim_end_matches('/')
                .to_lowercase();

            if (!host.is_empty() && url_lower.contains(&host))
                || (acct.provider == crate::domain::accounts::provider::ProviderKind::Github && url_lower.contains("github.com"))
                || (acct.provider == crate::domain::accounts::provider::ProviderKind::Gitlab && url_lower.contains("gitlab"))
                || (acct.provider == crate::domain::accounts::provider::ProviderKind::Bitbucket && url_lower.contains("bitbucket.org"))
            {
                if let Ok(Some(tok)) = crate::domain::accounts::token_store::get_valid_token_sync(&acct.id) {
                    let prov_str = match acct.provider {
                        crate::domain::accounts::provider::ProviderKind::Github => "github",
                        crate::domain::accounts::provider::ProviderKind::Gitlab => "gitlab",
                        crate::domain::accounts::provider::ProviderKind::Bitbucket => "bitbucket",
                    };
                    return GitAuthInfo {
                        token: Some(tok),
                        username: Some(acct.handle.trim_start_matches('@').to_string()),
                        provider: prov_str.to_string(),
                    };
                }
            }
        }

        // 1b. Check any account matching URL
        for acct in &prov_accounts {
            let host = acct
                .instance_url
                .trim_start_matches("https://")
                .trim_start_matches("http://")
                .trim_end_matches('/')
                .to_lowercase();

            if (!host.is_empty() && url_lower.contains(&host))
                || (acct.provider == crate::domain::accounts::provider::ProviderKind::Github && url_lower.contains("github.com"))
                || (acct.provider == crate::domain::accounts::provider::ProviderKind::Gitlab && url_lower.contains("gitlab"))
                || (acct.provider == crate::domain::accounts::provider::ProviderKind::Bitbucket && url_lower.contains("bitbucket.org"))
            {
                if let Ok(Some(tok)) = crate::domain::accounts::token_store::get_valid_token_sync(&acct.id) {
                    let prov_str = match acct.provider {
                        crate::domain::accounts::provider::ProviderKind::Github => "github",
                        crate::domain::accounts::provider::ProviderKind::Gitlab => "gitlab",
                        crate::domain::accounts::provider::ProviderKind::Bitbucket => "bitbucket",
                    };
                    return GitAuthInfo {
                        token: Some(tok),
                        username: Some(acct.handle.trim_start_matches('@').to_string()),
                        provider: prov_str.to_string(),
                    };
                }
            }
        }
    }

    let accounts = keyring::list_accounts();

    // 2. If remote_url is provided, match legacy account by URL host
    if let Some(url) = remote_url {
        let url_lower = url.to_lowercase();
        for acct in &accounts {
            let host = acct
                .server_url
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

    // 3. Check if a specific account is linked to this repository
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
                    } else if url_lower.contains("bitbucket.org") {
                        repo_provider = Some("bitbucket".to_string());
                    }
                }

                // Clean legacy embedded credentials from the git remote URL
                if url.starts_with("https://") && url.contains('@') {
                    let url_without_scheme = &url["https://".len()..];
                    if let Some(idx) = url_without_scheme.find('@') {
                        let clean_url = format!("https://{}", &url_without_scheme[idx + 1..]);
                        let _ = silent_git_command()
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

    // 4a. Match active account of the specific provider
    for acct in &prov_accounts {
        let matches = match acct.provider {
            crate::domain::accounts::provider::ProviderKind::Github => provider == "github",
            crate::domain::accounts::provider::ProviderKind::Gitlab => provider == "gitlab",
            crate::domain::accounts::provider::ProviderKind::Bitbucket => provider == "bitbucket",
        };
        if matches && acct.is_active {
            if let Ok(Some(tok)) = crate::domain::accounts::token_store::get_valid_token_sync(&acct.id) {
                return GitAuthInfo {
                    token: Some(tok),
                    username: Some(acct.handle.trim_start_matches('@').to_string()),
                    provider: provider.clone(),
                };
            }
        }
    }

    // 4b. Match any account of the specific provider
    for acct in &prov_accounts {
        let matches = match acct.provider {
            crate::domain::accounts::provider::ProviderKind::Github => provider == "github",
            crate::domain::accounts::provider::ProviderKind::Gitlab => provider == "gitlab",
            crate::domain::accounts::provider::ProviderKind::Bitbucket => provider == "bitbucket",
        };
        if matches {
            if let Ok(Some(tok)) = crate::domain::accounts::token_store::get_valid_token_sync(&acct.id) {
                return GitAuthInfo {
                    token: Some(tok),
                    username: Some(acct.handle.trim_start_matches('@').to_string()),
                    provider: provider.clone(),
                };
            }
        }
    }

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

    GitAuthInfo {
        token,
        username,
        provider,
    }
}

pub fn get_git_auth_info(repo_path: &str) -> GitAuthInfo {
    let remote_url = if let Ok(repo) = Repository::open(repo_path) {
        let remote_name = if repo.find_remote("origin").is_ok() {
            "origin"
        } else if repo.find_remote("upstream").is_ok() {
            "upstream"
        } else {
            "origin"
        };
        repo.find_remote(remote_name).ok().and_then(|r| r.url().map(|u| u.to_string()))
    } else {
        None
    };

    get_git_auth_info_for_url(repo_path, remote_url.as_deref())
}

pub fn apply_git_auth_args_pub(cmd: &mut Command, auth_info: &GitAuthInfo) {
    apply_git_auth_args(cmd, auth_info);
}

fn apply_git_auth_args(cmd: &mut Command, auth_info: &GitAuthInfo) {
    if let Some(ref t) = auth_info.token {
        let t_clean = t.trim();
        if !t_clean.is_empty() {
            let auth_user = if auth_info.provider == "github" {
                "x-access-token"
            } else if auth_info.provider == "bitbucket" {
                "x-token-auth"
            } else {
                "oauth2"
            };
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
    let current_branch = repo
        .head()
        .ok()
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
    let ref_exists = silent_git_command()
        .args([
            "show-ref",
            "--quiet",
            "--verify",
            &format!("refs/remotes/{}", remote_ref),
        ])
        .current_dir(repo_path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !ref_exists {
        let count = silent_git_command()
            .args(["rev-list", "--count", "HEAD"])
            .current_dir(repo_path)
            .output()
            .ok()
            .and_then(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .trim()
                    .parse::<usize>()
                    .ok()
            })
            .unwrap_or(0);
        return (count, 0);
    }

    let ahead = silent_git_command()
        .args(["rev-list", "--count", &format!("{}..HEAD", remote_ref)])
        .current_dir(repo_path)
        .output()
        .ok()
        .and_then(|o| {
            String::from_utf8_lossy(&o.stdout)
                .trim()
                .parse::<usize>()
                .ok()
        })
        .unwrap_or(0);

    let behind = silent_git_command()
        .args(["rev-list", "--count", &format!("HEAD..{}", remote_ref)])
        .current_dir(repo_path)
        .output()
        .ok()
        .and_then(|o| {
            String::from_utf8_lossy(&o.stdout)
                .trim()
                .parse::<usize>()
                .ok()
        })
        .unwrap_or(0);

    (ahead, behind)
}

/// Add a new remote to the repository
pub fn add_remote(repo_path: &str, name: &str, url: &str) -> Result<(), AppError> {
    let clean_name = name.trim();
    let clean_url = url.trim();

    if clean_name.is_empty() || clean_url.is_empty() {
        return Err(AppError::Validation(
            "Remote name and URL cannot be empty".to_string(),
        ));
    }

    let output = silent_git_command()
        .args(["remote", "add", clean_name, clean_url])
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to add remote: {}",
            stderr.trim()
        )));
    }

    Ok(())
}

/// Remove a remote from the repository
pub fn remove_remote(repo_path: &str, name: &str) -> Result<(), AppError> {
    let clean_name = name.trim();
    if clean_name.is_empty() {
        return Err(AppError::Validation(
            "Remote name cannot be empty".to_string(),
        ));
    }

    let output = silent_git_command()
        .args(["remote", "remove", clean_name])
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to remove remote: {}",
            stderr.trim()
        )));
    }

    Ok(())
}

/// Rename an existing remote
pub fn rename_remote(repo_path: &str, old_name: &str, new_name: &str) -> Result<(), AppError> {
    let clean_old = old_name.trim();
    let clean_new = new_name.trim();

    if clean_old.is_empty() || clean_new.is_empty() {
        return Err(AppError::Validation(
            "Remote names cannot be empty".to_string(),
        ));
    }

    let output = silent_git_command()
        .args(["remote", "rename", clean_old, clean_new])
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to rename remote: {}",
            stderr.trim()
        )));
    }

    Ok(())
}

/// Set URL or Push URL for a remote
pub fn set_remote_url(
    repo_path: &str,
    name: &str,
    url: &str,
    is_push: bool,
) -> Result<(), AppError> {
    let clean_name = name.trim();
    let clean_url = url.trim();

    if clean_name.is_empty() || clean_url.is_empty() {
        return Err(AppError::Validation(
            "Remote name and URL cannot be empty".to_string(),
        ));
    }

    let mut cmd = silent_git_command();
    cmd.arg("remote").arg("set-url");
    if is_push {
        cmd.arg("--push");
    }
    cmd.arg(clean_name).arg(clean_url);
    cmd.current_dir(repo_path);

    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to set remote URL: {}",
            stderr.trim()
        )));
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

    let mut cmd = silent_git_command();
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
        let stderr_lower = stderr.to_lowercase();

        if stderr_lower.contains("repository not found")
            || stderr_lower.contains("fatal: repository")
            || stderr_lower.contains("could not read from remote repository")
            || stderr_lower.contains("does not appear to be a git repository")
            || stderr_lower.contains("the project you were looking for could not be found")
            || stderr_lower.contains("remote: not found")
        {
            return Err(AppError::NotFound(format!(
                "Remote repository not found on server for '{}'. It may have been deleted or renamed on the provider: {}",
                clean_remote,
                stderr.trim()
            )));
        }

        if stderr.contains("HTTP Basic: Access denied") || stderr.contains("Authentication failed")
        {
            return Err(AppError::Auth(format!(
                "Authentication failed for remote fetch: {}",
                stderr.trim()
            )));
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
    let clean_remote = if remote_name.trim().is_empty() {
        "origin"
    } else {
        remote_name.trim()
    };
    let clean_branch = branch_name.trim();
    let auth_info = get_git_auth_info(repo_path);

    let mut cmd = silent_git_command();
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

        if lower.contains("repository not found")
            || lower.contains("fatal: repository")
            || lower.contains("could not read from remote repository")
            || lower.contains("does not appear to be a git repository")
            || lower.contains("the project you were looking for could not be found")
            || lower.contains("remote: not found")
        {
            return Err(AppError::NotFound(format!(
                "Remote repository was not found for '{}'. It may have been deleted on the cloud provider.",
                clean_remote
            )));
        }

        if lower.contains("refusing to update checked out branch") {
            return Err(AppError::Git(format!(
                "Push rejected: Remote branch '{}' is checked out on the remote repository.",
                clean_branch
            )));
        }

        if lower.contains("fetch first")
            || lower.contains("non-fast-forward")
            || lower.contains("remote contains work")
        {
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

        if lower.contains("without `workflow` scope") || lower.contains("workflow scope") {
            return Err(AppError::Auth(
                "GitHub Rejected: Your Personal Access Token is missing the 'workflow' scope required to modify files in .github/workflows/.".to_string(),
            ));
        }

        if lower.contains("secret scanning") || lower.contains("push protection") {
            return Err(AppError::Git(
                "Push blocked by Secret Protection. Check your commits for sensitive credentials or keys.".to_string(),
            ));
        }

        if let Some(idx) = err_msg.find("! [remote rejected]") {
            let rejection_line = err_msg[idx..]
                .lines()
                .next()
                .unwrap_or("! [remote rejected]");
            return Err(AppError::Git(format!("Push rejected: {}", rejection_line)));
        }

        // Clean out boilerplate "To https://..." lines to present the actionable failure line
        let clean_summary: String = err_msg
            .lines()
            .map(str::trim)
            .filter(|l| {
                !l.is_empty()
                    && !l.starts_with("To http")
                    && !l.starts_with("To git@")
                    && !l.starts_with("To ssh://")
            })
            .collect::<Vec<_>>()
            .join(" | ");

        let final_err = if !clean_summary.is_empty() {
            clean_summary
        } else {
            err_msg
        };
        return Err(AppError::Git(format!(
            "Failed to push to remote '{}': {}",
            clean_remote, final_err
        )));
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
    let clean_remote = if remote_name.trim().is_empty() {
        "origin"
    } else {
        remote_name.trim()
    };
    let clean_branch = branch_name.trim();
    let auth_info = get_git_auth_info(repo_path);

    let head_before = silent_git_command()
        .args(["rev-parse", "HEAD"])
        .current_dir(repo_path)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        });

    let mut cmd = silent_git_command();
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

        let lower = stderr.to_lowercase();
        if lower.contains("repository not found")
            || lower.contains("fatal: repository")
            || lower.contains("could not read from remote repository")
            || lower.contains("does not appear to be a git repository")
            || lower.contains("the project you were looking for could not be found")
            || lower.contains("remote: not found")
        {
            return Err(AppError::NotFound(format!(
                "Remote repository was not found for '{}'. It may have been deleted on the cloud provider.",
                clean_remote
            )));
        }

        if stderr.contains("HTTP Basic: Access denied") || stderr.contains("Authentication failed")
        {
            return Err(AppError::Auth(format!(
                "Access Denied: Stored token is invalid for remote '{}'.",
                clean_remote
            )));
        }

        return Err(AppError::Git(format!(
            "Git pull failed from '{}': {}",
            clean_remote,
            stderr.trim()
        )));
    }

    let commits_pulled = if let Some(ref old_head) = head_before {
        silent_git_command()
            .args(["rev-list", "--count", &format!("{}..HEAD", old_head)])
            .current_dir(repo_path)
            .output()
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    String::from_utf8_lossy(&o.stdout)
                        .trim()
                        .parse::<usize>()
                        .ok()
                } else {
                    None
                }
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
        return Err(AppError::Validation(format!(
            "Destination path '{}' is not empty",
            local_path
        )));
    }

    let auth_info = get_git_auth_info_for_url(".", Some(remote_url));

    let mut cmd = silent_git_command();
    apply_git_auth_args(&mut cmd, &auth_info);
    cmd.arg("clone").arg(remote_url).arg(local_path);

    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(AppError::Git(format!(
            "Failed to clone repository: {}",
            stderr
        )));
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

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct RemoteValidationResult {
    pub has_remote: bool,
    pub remote_url: Option<String>,
    pub is_valid: bool,
    pub is_deleted_or_missing: bool,
    pub error_message: Option<String>,
}

/// Validates whether the configured 'origin' remote repository still exists and is accessible on the server.
pub fn validate_remote_origin(repo_path: &str) -> Result<RemoteValidationResult, AppError> {
    let output = silent_git_command()
        .args(["remote", "get-url", "origin"])
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        return Ok(RemoteValidationResult {
            has_remote: false,
            remote_url: None,
            is_valid: false,
            is_deleted_or_missing: false,
            error_message: None,
        });
    }

    let remote_url = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if remote_url.is_empty() {
        return Ok(RemoteValidationResult {
            has_remote: false,
            remote_url: None,
            is_valid: false,
            is_deleted_or_missing: false,
            error_message: None,
        });
    }

    let auth_info = get_git_auth_info_for_url(repo_path, Some(&remote_url));
    let mut cmd = silent_git_command();
    cmd.current_dir(repo_path);
    apply_git_auth_args(&mut cmd, &auth_info);
    cmd.args(["ls-remote", "--exit-code", "origin", "HEAD"]);

    let probe_out = cmd.output()?;
    if probe_out.status.success() {
        return Ok(RemoteValidationResult {
            has_remote: true,
            remote_url: Some(remote_url),
            is_valid: true,
            is_deleted_or_missing: false,
            error_message: None,
        });
    }

    let stderr = String::from_utf8_lossy(&probe_out.stderr).to_string();
    let lower = stderr.to_lowercase();

    let is_missing = lower.contains("repository not found")
        || lower.contains("fatal: repository")
        || lower.contains("not found")
        || lower.contains("does not appear to be a git repository")
        || lower.contains("the project you were looking for could not be found")
        || lower.contains("could not read from remote repository")
        || lower.contains("remote: not found");

    Ok(RemoteValidationResult {
        has_remote: true,
        remote_url: Some(remote_url),
        is_valid: false,
        is_deleted_or_missing: is_missing,
        error_message: if stderr.trim().is_empty() {
            None
        } else {
            Some(stderr.trim().to_string())
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_validate_remote_origin_preserves_config_on_probe_failure() {
        let dir = std::env::temp_dir().join(format!("git_test_repo_{}", rand::random::<u32>()));
        let _ = fs::create_dir_all(&dir);
        let repo_path = dir.to_str().unwrap();

        // 1. Initialize git repo
        let repo = Repository::init(&dir).unwrap();

        // 2. Add an unreachable mock remote
        let remote_url = "https://invalid-host-mock.local/owner/repo.git";
        repo.remote("origin", remote_url).unwrap();

        // 3. Set branch tracking config and user config
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "Test User").unwrap();
        config.set_str("user.email", "test@user.local").unwrap();
        config.set_str("branch.main.remote", "origin").unwrap();
        config.set_str("branch.main.merge", "refs/heads/main").unwrap();
        config.set_str("branch.main.vscode-merge-base", "origin/main").unwrap();

        let config_file_path = dir.join(".git").join("config");
        let initial_config_content = fs::read_to_string(&config_file_path).unwrap();
        assert!(initial_config_content.contains("[remote \"origin\"]"));
        assert!(initial_config_content.contains("vscode-merge-base = origin/main"));

        // 4. Run validate_remote_origin - this will fail network probe
        let val_res = validate_remote_origin(repo_path).unwrap();
        assert!(!val_res.is_valid);
        assert!(val_res.has_remote);
        assert_eq!(val_res.remote_url.as_deref(), Some(remote_url));

        // 5. Verify .git/config still has [remote "origin"] and branch configuration intact
        let final_config_content = fs::read_to_string(&config_file_path).unwrap();
        assert!(final_config_content.contains("[remote \"origin\"]"), "Remote section must not be stripped");
        assert!(final_config_content.contains("url = https://invalid-host-mock.local/owner/repo.git"));
        assert!(final_config_content.contains("vscode-merge-base = origin/main"), "Branch config must remain intact");

        // Verify git2 can still find the remote
        let reloaded_repo = Repository::open(&dir).unwrap();
        assert!(reloaded_repo.find_remote("origin").is_ok());

        let _ = fs::remove_dir_all(&dir);
    }
}

