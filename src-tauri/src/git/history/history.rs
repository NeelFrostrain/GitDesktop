use crate::error::AppError;
use git2::Repository;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitFileStat {
    pub path: String,
    pub additions: usize,
    pub deletions: usize,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitInfo {
    pub sha: String,
    pub short_sha: String,
    pub author_name: String,
    pub author_email: String,
    pub message: String,
    pub timestamp: i64,
    pub relative_date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub additions: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deletions: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommitDetails {
    pub commit: CommitInfo,
    pub changed_files: Vec<String>,
    pub total_additions: usize,
    pub total_deletions: usize,
    pub file_stats: Vec<CommitFileStat>,
}

pub fn get_commit_history(
    repo_path: &str,
    limit: usize,
    offset: usize,
) -> Result<Vec<CommitInfo>, AppError> {
    let repo = Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;

    let mut revwalk = repo.revwalk()?;
    revwalk
        .push_head()
        .map_err(|_| AppError::Git("Repository has no HEAD commit".to_string()))?;

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
            additions: None,
            deletions: None,
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

    let mut changed_files = Vec::new();
    let mut total_additions = 0;
    let mut total_deletions = 0;
    let mut file_stats = Vec::new();

    if let Ok(commit_tree) = commit.tree() {
        let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());
        if let Ok(diff) = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None) {
            if let Ok(stats) = diff.stats() {
                total_additions = stats.insertions();
                total_deletions = stats.deletions();
            }

            use std::collections::HashMap;
            let mut file_line_counts: HashMap<String, (usize, usize)> = HashMap::new();
            let _ = diff.print(git2::DiffFormat::Patch, |delta, _hunk, line| {
                if let Some(path) = delta.new_file().path() {
                    let path_str = path.to_string_lossy().to_string();
                    let entry = file_line_counts.entry(path_str).or_insert((0, 0));
                    match line.origin() {
                        '+' => entry.0 += 1,
                        '-' => entry.1 += 1,
                        _ => {}
                    }
                }
                true
            });

            for delta in diff.deltas() {
                if let Some(path) = delta.new_file().path() {
                    let path_str = path.to_string_lossy().to_string();
                    changed_files.push(path_str.clone());

                    let counts = file_line_counts.get(&path_str).copied().unwrap_or((0, 0));
                    let status = match delta.status() {
                        git2::Delta::Added => "added",
                        git2::Delta::Deleted => "deleted",
                        git2::Delta::Modified => "modified",
                        git2::Delta::Renamed => "renamed",
                        git2::Delta::Copied => "copied",
                        _ => "modified",
                    };

                    file_stats.push(CommitFileStat {
                        path: path_str,
                        additions: counts.0,
                        deletions: counts.1,
                        status: status.to_string(),
                    });
                }
            }
        }
    }

    let commit_info = CommitInfo {
        sha: commit.id().to_string(),
        short_sha: commit.id().to_string().chars().take(7).collect(),
        author_name: author.name().unwrap_or("Unknown").to_string(),
        author_email: author.email().unwrap_or("").to_string(),
        message: commit.message().unwrap_or("").trim().to_string(),
        timestamp: commit.time().seconds(),
        relative_date: format_relative_date(commit.time().seconds()),
        additions: Some(total_additions),
        deletions: Some(total_deletions),
    };

    Ok(CommitDetails {
        commit: commit_info,
        changed_files,
        total_additions,
        total_deletions,
        file_stats,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BranchComparison {
    pub commits: Vec<CommitInfo>,
    pub files: Vec<CommitFileStat>,
    pub total_additions: usize,
    pub total_deletions: usize,
}

pub fn get_branch_comparison(
    repo_path: &str,
    base_branch: &str,
    head_branch: &str,
) -> Result<BranchComparison, AppError> {
    let repo = Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;

    let resolve_ref = |name: &str| -> Option<git2::Commit> {
        if let Ok(obj) = repo.revparse_single(name) {
            if let Ok(c) = obj.peel_to_commit() {
                return Some(c);
            }
        }
        if let Ok(obj) = repo.revparse_single(&format!("origin/{}", name)) {
            if let Ok(c) = obj.peel_to_commit() {
                return Some(c);
            }
        }
        if let Ok(obj) = repo.revparse_single(&format!("refs/heads/{}", name)) {
            if let Ok(c) = obj.peel_to_commit() {
                return Some(c);
            }
        }
        None
    };

    let base_commit = resolve_ref(base_branch);
    let head_commit = resolve_ref(head_branch);

    let mut commits = Vec::new();
    let mut files = Vec::new();
    let mut total_additions = 0;
    let mut total_deletions = 0;

    if let (Some(base), Some(head)) = (base_commit, head_commit) {
        let mut revwalk = repo.revwalk().map_err(|e| AppError::Git(e.to_string()))?;
        revwalk.push(head.id()).ok();
        revwalk.hide(base.id()).ok();

        for oid in revwalk.take(100).flatten() {
            if let Ok(c) = repo.find_commit(oid) {
                let author = c.author();
                commits.push(CommitInfo {
                    sha: c.id().to_string(),
                    short_sha: c.id().to_string().chars().take(7).collect(),
                    author_name: author.name().unwrap_or("Unknown").to_string(),
                    author_email: author.email().unwrap_or("").to_string(),
                    message: c.message().unwrap_or("").trim().to_string(),
                    timestamp: c.time().seconds(),
                    relative_date: format_relative_date(c.time().seconds()),
                    additions: None,
                    deletions: None,
                });
            }
        }

        let merge_base = repo.merge_base(base.id(), head.id()).unwrap_or_else(|_| base.id());
        if let (Ok(base_c), Ok(head_c)) = (repo.find_commit(merge_base), repo.find_commit(head.id())) {
            if let (Ok(base_tree), Ok(head_tree)) = (base_c.tree(), head_c.tree()) {
                if let Ok(diff) = repo.diff_tree_to_tree(Some(&base_tree), Some(&head_tree), None) {
                    if let Ok(stats) = diff.stats() {
                        total_additions = stats.insertions();
                        total_deletions = stats.deletions();
                    }

                    for delta in diff.deltas() {
                        if let Some(path) = delta.new_file().path() {
                            let path_str = path.to_string_lossy().to_string();
                            let status = match delta.status() {
                                git2::Delta::Added => "added",
                                git2::Delta::Deleted => "deleted",
                                git2::Delta::Modified => "modified",
                                git2::Delta::Renamed => "renamed",
                                git2::Delta::Copied => "copied",
                                _ => "modified",
                            };

                            files.push(CommitFileStat {
                                path: path_str,
                                additions: 0,
                                deletions: 0,
                                status: status.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(BranchComparison {
        commits,
        files,
        total_additions,
        total_deletions,
    })
}
