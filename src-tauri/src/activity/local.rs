use crate::error::AppError;
use git2::{Repository, Sort};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum ActivityKind {
    Commit {
        sha: String,
        short_sha: String,
        summary: String,
        author: String,
        author_email: String,
    },
    Push {
        remote: String,
        branch: String,
        commit_count: u32,
    },
    MergeRequest {
        title: String,
        state: String,
        url: String,
        author: String,
        source_branch: String,
        target_branch: String,
    },
    Pipeline {
        status: String,
        branch: String,
        url: String,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActivityEvent {
    pub id: String,
    pub kind: ActivityKind,
    pub repo_path: String,
    pub repo_name: String,
    pub at: i64, // Unix timestamp in seconds
    pub relative_date: String,
}

pub fn get_local_activity(
    repo_paths: Vec<String>,
    limit: usize,
) -> Result<Vec<ActivityEvent>, AppError> {
    let mut all_events = Vec::new();
    let max_per_repo = 20;

    let effective_paths: Vec<String> = if repo_paths.is_empty() {
        crate::repos::registry::list_known_repos()
            .into_iter()
            .map(|r| r.path)
            .collect()
    } else {
        repo_paths
    };

    for path_str in &effective_paths {
        let path = Path::new(path_str);
        let repo = match Repository::open(path) {
            Ok(r) => r,
            Err(_) => continue,
        };

        let repo_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("repo")
            .to_string();

        let mut revwalk = match repo.revwalk() {
            Ok(w) => w,
            Err(_) => continue,
        };

        let _ = revwalk.set_sorting(Sort::TIME);
        let _ = revwalk.push_head();

        let mut count = 0;
        for oid_result in revwalk {
            if count >= max_per_repo {
                break;
            }
            if let Ok(oid) = oid_result {
                if let Ok(commit) = repo.find_commit(oid) {
                    let sha = commit.id().to_string();
                    let short_sha = sha[..7.min(sha.len())].to_string();
                    let summary = commit.summary().unwrap_or("No commit message").to_string();
                    let author = commit.author().name().unwrap_or("Unknown").to_string();
                    let author_email = commit.author().email().unwrap_or("").to_string();
                    let timestamp = commit.time().seconds();

                    let relative_date = format_relative_date(timestamp);

                    all_events.push(ActivityEvent {
                        id: format!("commit-{}-{}", sha, timestamp),
                        kind: ActivityKind::Commit {
                            sha,
                            short_sha,
                            summary,
                            author,
                            author_email,
                        },
                        repo_path: path_str.clone(),
                        repo_name: repo_name.clone(),
                        at: timestamp,
                        relative_date,
                    });

                    count += 1;
                }
            }
        }
    }

    // Sort descending by timestamp
    all_events.sort_by_key(|b| std::cmp::Reverse(b.at));

    if all_events.len() > limit && limit > 0 {
        all_events.truncate(limit);
    }

    Ok(all_events)
}

fn format_relative_date(timestamp: i64) -> String {
    let now = chrono::Utc::now().timestamp();
    let diff = now - timestamp;

    if diff < 60 {
        "just now".to_string()
    } else if diff < 3600 {
        let mins = diff / 60;
        format!("{} min{} ago", mins, if mins == 1 { "" } else { "s" })
    } else if diff < 86400 {
        let hours = diff / 3600;
        format!("{} hour{} ago", hours, if hours == 1 { "" } else { "s" })
    } else if diff < 604800 {
        let days = diff / 86400;
        format!("{} day{} ago", days, if days == 1 { "" } else { "s" })
    } else {
        let dt =
            chrono::DateTime::from_timestamp(timestamp, 0).unwrap_or_else(chrono::Utc::now);
        dt.format("%b %d, %Y").to_string()
    }
}
