use serde::{Deserialize, Serialize};
use git2::{Repository, FetchOptions, RemoteCallbacks, Cred};
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

pub fn fetch_remote(repo_path: &str) -> Result<(), AppError> {
    let repo = Repository::open(repo_path)?;
    let mut remote = repo.find_remote("origin")
        .or_else(|_| repo.find_remote("upstream"))
        .map_err(|e| AppError::Git(format!("No remote configured: {}", e)))?;

    let token = keyring::get_token().unwrap_or(None);

    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, username_from_url, _allowed_types| {
        if let Some(ref t) = token {
            let user = username_from_url.unwrap_or("oauth2");
            Cred::userpass_plaintext(user, t)
        } else {
            Cred::default()
        }
    });

    let mut opts = FetchOptions::new();
    opts.remote_callbacks(callbacks);

    remote.fetch(&["refs/heads/*:refs/remotes/origin/*"], Some(&mut opts), None)?;
    Ok(())
}

pub fn push_to_remote(repo_path: &str, branch_name: &str) -> Result<(), AppError> {
    // Shelling out to system `git push` here because libgit2 SSH/HTTP credentials handling
    // for complex enterprise proxies / SSH agent auth can be brittle across platforms.
    // Using system `git` provides seamless integration with the user's local SSH agent & git config.
    let output = Command::new("git")
        .arg("push")
        .arg("origin")
        .arg(branch_name)
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(AppError::Git(format!("Failed to push to remote: {}", err_msg)));
    }

    Ok(())
}

pub fn pull_from_remote(repo_path: &str, _branch_name: &str) -> Result<PullResult, AppError> {
    // We shell out to `git pull --no-rebase` to execute merge/pull operations cleanly.
    // libgit2 handles fetch well, but performing non-trivial automatic 3-way tree merges with conflict markers in workdir
    // is significantly cleaner via system `git`, ensuring index conflict flags match Git CLI standards.
    let output = Command::new("git")
        .arg("pull")
        .arg("--no-rebase")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        
        // Inspect if pull failed due to conflicts
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

        return Err(AppError::Git(format!("Git pull failed: {}", stderr)));
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
