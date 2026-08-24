use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BlameLine {
    pub line_num: usize,
    pub commit_sha: String,
    pub short_sha: String,
    pub author_name: String,
    pub date: String,
    pub content: String,
}

pub fn get_file_blame(repo_path: &str, file_path: &str) -> Result<Vec<BlameLine>, AppError> {
    let output = Command::new("git")
        .arg("blame")
        .arg("--line-porcelain")
        .arg(file_path)
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to get file blame: {}",
            stderr.trim()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut blame_lines = Vec::new();

    let mut current_sha = String::new();
    let mut current_author = String::new();
    let mut current_date = String::new();
    let mut line_count = 0;

    for line in stdout.lines() {
        if line.starts_with('\t') {
            line_count += 1;
            let content = line[1..].to_string();
            let short_sha = if current_sha.len() >= 7 {
                current_sha[..7].to_string()
            } else {
                current_sha.clone()
            };

            blame_lines.push(BlameLine {
                line_num: line_count,
                commit_sha: current_sha.clone(),
                short_sha,
                author_name: current_author.clone(),
                date: current_date.clone(),
                content,
            });
        } else if let Some(author) = line.strip_prefix("author ") {
            current_author = author.to_string();
        } else if let Some(time) = line.strip_prefix("author-time ") {
            if let Ok(ts) = time.parse::<i64>() {
                if let Some(dt) = chrono::DateTime::from_timestamp(ts, 0) {
                    current_date = dt.format("%Y-%m-%d").to_string();
                }
            }
        } else {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 && parts[0].len() == 40 {
                current_sha = parts[0].to_string();
            }
        }
    }

    Ok(blame_lines)
}
