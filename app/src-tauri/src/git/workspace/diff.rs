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
pub struct SubmoduleDiffInfo {
    pub is_submodule: bool,
    pub name: String,
    pub path: String,
    pub url: Option<String>,
    pub old_commit: Option<String>,
    pub new_commit: Option<String>,
    pub status_summary: String,
    pub submodule_full_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffResult {
    pub file_path: String,
    pub lines: Vec<DiffLine>,
    pub is_binary: bool,
    pub is_large_file: bool,
    pub file_size_bytes: u64,
    pub submodule_info: Option<SubmoduleDiffInfo>,
}

pub fn check_submodule_info(
    repo: &Repository,
    repo_path: &str,
    clean_path: &str,
    staged: bool,
) -> Option<SubmoduleDiffInfo> {
    let target_norm = clean_path.replace('\\', "/").trim_start_matches("./").to_string();
    let target_name = Path::new(clean_path).file_name().and_then(|n| n.to_str()).unwrap_or(clean_path);

    // 1. Check libgit2 repo.submodules()
    if let Ok(mut submodules) = repo.submodules() {
        for sub in submodules.iter_mut() {
            let sub_path = sub.path().to_string_lossy().replace('\\', "/").trim_start_matches("./").to_string();
            let sub_name = sub.name().unwrap_or(&sub_path);

            if sub_path == target_norm || sub_name == clean_path || sub_name == target_name {
                let url = sub.url().map(|s| s.to_string());
                let head_id = sub.head_id().map(|o| o.to_string());
                let index_id = sub.index_id().map(|o| o.to_string());
                let wd_id = sub.workdir_id().map(|o| o.to_string());

                let sub_full_path = Path::new(repo_path).join(&sub_path);
                let actual_wd_id = if let Ok(sub_repo) = Repository::open(&sub_full_path) {
                    sub_repo.head().ok().and_then(|h| h.target()).map(|o| o.to_string()).or(wd_id)
                } else {
                    wd_id
                };

                let old_commit = head_id.or(index_id.clone());
                let new_commit = if staged {
                    index_id.or(actual_wd_id.clone())
                } else {
                    actual_wd_id.or(index_id)
                };

                let short_old = old_commit.as_ref().map(|s| if s.len() >= 7 { &s[..7] } else { s });
                let short_new = new_commit.as_ref().map(|s| if s.len() >= 7 { &s[..7] } else { s });

                let summary = match (&short_old, &short_new) {
                    (Some(old), Some(new)) if old != new => {
                        format!("This submodule changed its commit from {} to {}.", old, new)
                    }
                    (Some(old), Some(_)) => {
                        format!("Submodule at commit {}.", old)
                    }
                    (None, Some(new)) => {
                        format!("New submodule at commit {}.", new)
                    }
                    _ => "Submodule modified.".to_string(),
                };

                return Some(SubmoduleDiffInfo {
                    is_submodule: true,
                    name: sub_name.to_string(),
                    path: sub_path,
                    url,
                    old_commit,
                    new_commit,
                    status_summary: summary,
                    submodule_full_path: Some(sub_full_path.to_string_lossy().to_string()),
                });
            }
        }
    }

    // 2. Fallback: Parse .gitmodules if present
    let gitmodules_path = Path::new(repo_path).join(".gitmodules");
    if gitmodules_path.exists() {
        if let Ok(content) = fs::read_to_string(&gitmodules_path) {
            let mut current_sub_name = String::new();
            let mut current_sub_path = String::new();
            let mut current_sub_url = String::new();

            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("[submodule \"") && trimmed.ends_with("\"]") {
                    current_sub_name = trimmed.trim_start_matches("[submodule \"").trim_end_matches("\"]").to_string();
                    current_sub_path.clear();
                    current_sub_url.clear();
                } else if let Some((k, v)) = trimmed.split_once('=') {
                    let k = k.trim();
                    let v = v.trim();
                    if k == "path" {
                        current_sub_path = v.to_string();
                    } else if k == "url" {
                        current_sub_url = v.to_string();
                    }
                }

                if !current_sub_path.is_empty() {
                    let norm_sub_path = current_sub_path.replace('\\', "/").trim_start_matches("./").to_string();
                    if norm_sub_path == target_norm || current_sub_name == clean_path || current_sub_name == target_name {
                        let sub_full_path = Path::new(repo_path).join(&current_sub_path);
                        let sub_head_commit = if let Ok(sub_repo) = Repository::open(&sub_full_path) {
                            sub_repo.head().ok().and_then(|h| h.target()).map(|o| o.to_string())
                        } else {
                            None
                        };

                        return Some(SubmoduleDiffInfo {
                            is_submodule: true,
                            name: current_sub_name,
                            path: current_sub_path,
                            url: if current_sub_url.is_empty() { None } else { Some(current_sub_url) },
                            old_commit: None,
                            new_commit: sub_head_commit.clone(),
                            status_summary: format!(
                                "Submodule changes (commit {})",
                                sub_head_commit.as_ref().map(|s| if s.len() >= 7 { &s[..7] } else { s }).unwrap_or("unknown")
                            ),
                            submodule_full_path: Some(sub_full_path.to_string_lossy().to_string()),
                        });
                    }
                }
            }
        }
    }

    None
}

pub fn get_file_diff(
    repo_path: &str,
    file_path: &str,
    staged: bool,
) -> Result<DiffResult, AppError> {
    let repo = Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;

    let clean_path = file_path.trim_end_matches('/').trim_end_matches('\\');
    let full_path = Path::new(repo_path).join(clean_path);

    let submodule_info = check_submodule_info(&repo, repo_path, clean_path, staged);

    let file_size_bytes = if full_path.exists() {
        fs::metadata(&full_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    if file_size_bytes > MAX_FILE_SIZE_BYTES && submodule_info.is_none() {
        return Ok(DiffResult {
            file_path: file_path.to_string(),
            lines: Vec::new(),
            is_binary: false,
            is_large_file: true,
            file_size_bytes,
            submodule_info: None,
        });
    }

    let parse_diff = |diff: &git2::Diff| -> (bool, Vec<DiffLine>) {
        let mut is_binary = false;
        let mut lines = Vec::new();
        const MAX_DIFF_LINES: usize = 6000;

        let _ = diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            if lines.len() >= MAX_DIFF_LINES {
                return false;
            }

            let origin = line.origin();
            if origin == 'B' {
                is_binary = true;
                return false;
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
    if full_path.is_dir() && submodule_info.is_none() {
        let glob = format!("{}/*", clean_path.replace('\\', "/"));
        opts.pathspec(glob);
        opts.recurse_untracked_dirs(true);
    } else {
        opts.pathspec(clean_path);
        opts.recurse_untracked_dirs(false);
    }
    opts.include_untracked(true);
    opts.show_untracked_content(true);

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

    // Submodule synthetic lines fallback
    if let Some(ref sub) = submodule_info {
        if lines.is_empty() {
            let old_str = sub.old_commit.as_deref().unwrap_or("0000000");
            let new_str = sub.new_commit.as_deref().unwrap_or("0000000");
            let old_short = if old_str.len() >= 7 { &old_str[..7] } else { old_str };
            let new_short = if new_str.len() >= 7 { &new_str[..7] } else { new_str };

            lines.push(DiffLine {
                line_type: "header".to_string(),
                old_line_num: None,
                new_line_num: None,
                content: format!("Submodule {} commit changed from {} to {}", sub.name, old_short, new_short),
            });
            if old_str != new_str {
                lines.push(DiffLine {
                    line_type: "deletion".to_string(),
                    old_line_num: Some(1),
                    new_line_num: None,
                    content: format!("-Subproject commit {}", old_str),
                });
                lines.push(DiffLine {
                    line_type: "addition".to_string(),
                    old_line_num: None,
                    new_line_num: Some(1),
                    content: format!("+Subproject commit {}", new_str),
                });
            }
        }
    }

    Ok(DiffResult {
        file_path: file_path.to_string(),
        lines,
        is_binary,
        is_large_file: false,
        file_size_bytes,
        submodule_info,
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
        submodule_info: None,
    })
}

use base64::Engine;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImageDiffData {
    pub file_path: String,
    pub current_data_url: Option<String>,
    pub previous_data_url: Option<String>,
    pub current_size_bytes: u64,
    pub previous_size_bytes: u64,
    pub mime_type: String,
    pub is_new: bool,
    pub is_deleted: bool,
    pub is_modified: bool,
}

fn get_blob_bytes_from_tree(repo: &Repository, tree: &git2::Tree, path: &str) -> Option<Vec<u8>> {
    let normalized = path.replace('\\', "/");
    let entry = tree.get_path(Path::new(&normalized)).ok()?;
    let object = entry.to_object(repo).ok()?;
    let blob = object.as_blob()?;
    Some(blob.content().to_vec())
}

fn get_mime_type_from_path(path: &str) -> String {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "bmp" => "image/bmp",
        "avif" => "image/avif",
        "tiff" | "tif" => "image/tiff",
        _ => "application/octet-stream",
    }
    .to_string()
}

pub fn get_image_diff_data(
    repo_path: &str,
    file_path: &str,
    commit_sha: Option<&str>,
) -> Result<ImageDiffData, AppError> {
    let repo = Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;

    let mime_type = get_mime_type_from_path(file_path);

    let (current_bytes, previous_bytes) = match commit_sha {
        Some(sha) if !sha.trim().is_empty() => {
            let oid = git2::Oid::from_str(sha.trim())
                .map_err(|_| AppError::Validation(format!("Invalid commit SHA: {}", sha)))?;
            let commit = repo.find_commit(oid)?;
            let current_tree = commit.tree()?;
            let curr = get_blob_bytes_from_tree(&repo, &current_tree, file_path);

            let prev = commit
                .parent(0)
                .ok()
                .and_then(|p| p.tree().ok())
                .and_then(|pt| get_blob_bytes_from_tree(&repo, &pt, file_path));

            (curr, prev)
        }
        _ => {
            // Working directory vs HEAD
            let full_path = Path::new(repo_path).join(file_path);
            let curr = if full_path.exists() && full_path.is_file() {
                fs::read(&full_path).ok()
            } else {
                None
            };

            let prev = repo
                .head()
                .and_then(|h| h.peel_to_tree())
                .ok()
                .and_then(|head_tree| get_blob_bytes_from_tree(&repo, &head_tree, file_path));

            (curr, prev)
        }
    };

    let is_new = previous_bytes.is_none() && current_bytes.is_some();
    let is_deleted = previous_bytes.is_some() && current_bytes.is_none();
    let is_modified = previous_bytes.is_some() && current_bytes.is_some();

    let current_size_bytes = current_bytes.as_ref().map(|b| b.len() as u64).unwrap_or(0);
    let previous_size_bytes = previous_bytes.as_ref().map(|b| b.len() as u64).unwrap_or(0);

    let current_data_url = current_bytes.map(|bytes| {
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        format!("data:{};base64,{}", mime_type, b64)
    });

    let previous_data_url = previous_bytes.map(|bytes| {
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        format!("data:{};base64,{}", mime_type, b64)
    });

    Ok(ImageDiffData {
        file_path: file_path.to_string(),
        current_data_url,
        previous_data_url,
        current_size_bytes,
        previous_size_bytes,
        mime_type,
        is_new,
        is_deleted,
        is_modified,
    })
}
