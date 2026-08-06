use serde::{Deserialize, Serialize};
use git2::Repository;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitInfo {
    pub sha: String,
    pub short_sha: String,
    pub author_name: String,
    pub author_email: String,
    pub message: String,
    pub timestamp: i64,
    pub relative_date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitDetails {
    pub commit: CommitInfo,
    pub changed_files: Vec<String>,
}

pub fn get_commit_history(repo_path: &str, limit: usize, offset: usize) -> Result<Vec<CommitInfo>, AppError> {
    let repo = Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;

    let mut revwalk = repo.revwalk()?;
    revwalk.push_head().map_err(|_| AppError::Git("Repository has no HEAD commit".to_string()))?;

    let mut commits = Vec::new();
    let entries: Vec<_> = revwalk.skip(offset).take(limit).collect();

    for oid_res in entries {
        let oid = oid_res?;
        let commit = repo.find_commit(oid)?;

        let author = commit.author();
        let author_name = author.name().unwrap_or("Unknown").to_string();
        let author_email = author.email().unwrap_or("").to_string();

        let message = commit.message().unwrap_or("").trim().to_string();
        let sha = commit.id().to_string();
        let short_sha = sha.chars().take(7).collect();
        let timestamp = commit.time().seconds();

        let relative_date = format_relative_date(timestamp);

        commits.push(CommitInfo {
            sha,
            short_sha,
            author_name,
            author_email,
            message,
            timestamp,
            relative_date,
        });
    }

    Ok(commits)
}

pub fn get_commit_details(repo_path: &str, sha: &str) -> Result<CommitDetails, AppError> {
    let repo = Repository::open(repo_path)?;
    let oid = git2::Oid::from_str(sha)
        .map_err(|_| AppError::Validation(format!("Invalid commit SHA: {}", sha)))?;

    let commit = repo.find_commit(oid)?;
    let author = commit.author();

    let commit_info = CommitInfo {
        sha: commit.id().to_string(),
        short_sha: commit.id().to_string().chars().take(7).collect(),
        author_name: author.name().unwrap_or("Unknown").to_string(),
        author_email: author.email().unwrap_or("").to_string(),
        message: commit.message().unwrap_or("").trim().to_string(),
        timestamp: commit.time().seconds(),
        relative_date: format_relative_date(commit.time().seconds()),
    };

    let mut changed_files = Vec::new();
    if let Ok(parent) = commit.parent(0) {
        let commit_tree = commit.tree()?;
        let parent_tree = parent.tree()?;
        let diff = repo.diff_tree_to_tree(Some(&parent_tree), Some(&commit_tree), None)?;

        for delta in diff.deltas() {
            if let Some(path) = delta.new_file().path() {
                changed_files.push(path.to_string_lossy().to_string());
            }
        }
    }

    Ok(CommitDetails {
        commit: commit_info,
        changed_files,
    })
}

fn format_relative_date(timestamp: i64) -> String {
    let now = chrono::Utc::now().timestamp();
    let diff = now - timestamp;

    if diff < 60 {
        "just now".to_string()
    } else if diff < 3600 {
        format!("{} mins ago", diff / 60)
    } else if diff < 86400 {
        format!("{} hours ago", diff / 3600)
    } else {
        format!("{} days ago", diff / 86400)
    }
}
