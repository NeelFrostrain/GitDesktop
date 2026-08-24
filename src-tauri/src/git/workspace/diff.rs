use crate::error::AppError;
use git2::{DiffOptions, Repository};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

const MAX_FILE_SIZE_BYTES: u64 = 2 * 1024 * 1024; // 2 MB

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffLine {
    pub line_type: String, // "addition", "deletion", "context", "header"
    pub old_line_num: Option<u32>,
    pub new_line_num: Option<u32>,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffResult {
    pub file_path: String,
    pub lines: Vec<DiffLine>,
    pub is_binary: bool,
    pub is_large_file: bool,
    pub file_size_bytes: u64,
}

pub fn get_file_diff(
    repo_path: &str,
    file_path: &str,
    staged: bool,
) -> Result<DiffResult, AppError> {
    let repo = Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;

    let full_path = Path::new(repo_path).join(file_path);

    let file_size_bytes = if full_path.exists() {
        fs::metadata(&full_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    if file_size_bytes > MAX_FILE_SIZE_BYTES {
        return Ok(DiffResult {
            file_path: file_path.to_string(),
            lines: Vec::new(),
            is_binary: false,
            is_large_file: true,
            file_size_bytes,
        });
    }

    let parse_diff = |diff: &git2::Diff| -> (bool, Vec<DiffLine>) {
        let mut is_binary = false;
        let mut lines = Vec::new();

        let _ = diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            let origin = line.origin();
            if origin == 'B' {
                is_binary = true;
                return true;
            }

            let content = String::from_utf8_lossy(line.content()).to_string();

            if origin == '>'
                || origin == '<'
                || content
                    .trim_start()
                    .starts_with("\\ No newline at end of file")
            {
                return true;
            }

            let line_type = match origin {
                '+' => "addition",
                '-' => "deletion",
                ' ' => "context",
                'F' | 'H' => "header",
                _ => "context",
            };

            lines.push(DiffLine {
                line_type: line_type.to_string(),
                old_line_num: line.old_lineno(),
                new_line_num: line.new_lineno(),
                content,
            });

            true
        });

        (is_binary, lines)
    };

    let mut opts = DiffOptions::new();
    opts.pathspec(file_path);
    opts.include_untracked(true);
    opts.show_untracked_content(true);
    opts.recurse_untracked_dirs(true);

    let head_tree = repo.head().and_then(|h| h.peel_to_tree()).ok();

    let diff = if staged {
        let index = repo.index().ok();
        repo.diff_tree_to_index(head_tree.as_ref(), index.as_ref(), Some(&mut opts))
            .ok()
    } else {
        repo.diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut opts))
            .ok()
            .or_else(|| {
                repo.diff_tree_to_workdir(head_tree.as_ref(), Some(&mut opts))
                    .ok()
            })
            .or_else(|| repo.diff_index_to_workdir(None, Some(&mut opts)).ok())
    };

    let (mut is_binary, mut lines) = if let Some(ref d) = diff {
        parse_diff(d)
    } else {
        (false, Vec::new())
    };

    if lines.is_empty() {
        if let Ok(fallback_diff) = repo.diff_tree_to_workdir(head_tree.as_ref(), Some(&mut opts)) {
            let (fb_bin, fb_lines) = parse_diff(&fallback_diff);
            if !fb_lines.is_empty() {
                is_binary = fb_bin;
                lines = fb_lines;
            }
        }
    }

    // Direct disk fallback for untracked newly created files
    if lines.is_empty() && full_path.exists() && full_path.is_file() {
        if let Ok(content) = fs::read_to_string(&full_path) {
            lines = content
                .lines()
                .enumerate()
                .map(|(idx, l)| DiffLine {
                    line_type: "addition".to_string(),
                    old_line_num: None,
                    new_line_num: Some((idx + 1) as u32),
                    content: l.to_string(),
                })
                .collect();
        }
    }

    Ok(DiffResult {
        file_path: file_path.to_string(),
        lines,
        is_binary,
        is_large_file: false,
        file_size_bytes,
    })
}

pub fn get_commit_file_diff(
    repo_path: &str,
    sha: &str,
    file_path: &str,
) -> Result<DiffResult, AppError> {
    let repo = Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;
    let oid = git2::Oid::from_str(sha)
        .map_err(|_| AppError::Validation(format!("Invalid commit SHA: {}", sha)))?;
    let commit = repo.find_commit(oid)?;
    let commit_tree = commit.tree()?;
    let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());

    let mut opts = DiffOptions::new();
    opts.pathspec(file_path);

    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), Some(&mut opts))?;

    let mut is_binary = false;
    let mut lines = Vec::new();

    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        if origin == 'B' {
            is_binary = true;
            return true;
        }

        let content = String::from_utf8_lossy(line.content()).to_string();

        if origin == '>'
            || origin == '<'
            || content
                .trim_start()
                .starts_with("\\ No newline at end of file")
        {
            return true;
        }

        let line_type = match origin {
            '+' => "addition",
            '-' => "deletion",
            ' ' => "context",
            'F' | 'H' => "header",
            _ => "context",
        };

        lines.push(DiffLine {
            line_type: line_type.to_string(),
            old_line_num: line.old_lineno(),
            new_line_num: line.new_lineno(),
            content,
        });

        true
    })?;

    Ok(DiffResult {
        file_path: file_path.to_string(),
        lines,
        is_binary,
        is_large_file: false,
        file_size_bytes: 0,
    })
}
