use crate::error::AppError;
use crate::git::command::silent_git_command;
use crate::git::workspace::diff::{DiffLine, DiffResult};
use crate::git::workspace::status::{FileStatus, FileStatusKind};
use git2::{DiffOptions, Repository};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StashEntry {
    pub index: usize,
    pub sha: String,
    pub message: String,
    pub branch: String,
    pub date: String,
}

pub fn list_stashes(repo_path: &str) -> Result<Vec<StashEntry>, AppError> {
    let output = silent_git_command()
        .arg("stash")
        .arg("list")
        .arg("--format=%gd|%h|%s|%cr")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to list stashes: {}",
            stderr.trim()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut stashes = Vec::new();

    for (i, line) in stdout.lines().enumerate() {
        let parts: Vec<&str> = line.splitn(4, '|').collect();
        if parts.len() >= 4 {
            let _stash_ref = parts[0];

            let sha = parts[1].to_string();
            let msg = parts[2].to_string();
            let date = parts[3].to_string();

            let branch = if let Some(idx) = msg.find("Saved changes on ") {
                msg[idx + 17..]
                    .split(" before checkout")
                    .next()
                    .unwrap_or("active")
                    .trim()
                    .to_string()
            } else if let Some(idx) = msg.find("WIP on ") {
                msg[idx + 7..]
                    .split(':')
                    .next()
                    .unwrap_or("active")
                    .trim()
                    .to_string()
            } else if let Some(idx) = msg.find("On ") {
                msg[idx + 3..]
                    .split(':')
                    .next()
                    .unwrap_or("active")
                    .trim()
                    .to_string()
            } else {
                "active".to_string()
            };

            stashes.push(StashEntry {
                index: i,
                sha,
                message: msg,
                branch,
                date,
            });
        }
    }

    Ok(stashes)
}

pub fn create_stash(
    repo_path: &str,
    message: Option<&str>,
    include_untracked: bool,
) -> Result<(), AppError> {
    let mut cmd = silent_git_command();
    cmd.arg("stash").arg("push");

    if include_untracked {
        cmd.arg("-u");
    }

    if let Some(m) = message {
        if !m.trim().is_empty() {
            cmd.arg("-m").arg(m.trim());
        }
    }

    cmd.current_dir(repo_path);
    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to create stash: {}",
            stderr.trim()
        )));
    }

    Ok(())
}

pub fn apply_stash(repo_path: &str, index: usize) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("stash")
        .arg("apply")
        .arg(format!("stash@{{{}}}", index))
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to apply stash: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn pop_stash(repo_path: &str, index: usize) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("stash")
        .arg("pop")
        .arg(format!("stash@{{{}}}", index))
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to pop stash: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn drop_stash(repo_path: &str, index: usize) -> Result<(), AppError> {
    let output = silent_git_command()
        .arg("stash")
        .arg("drop")
        .arg(format!("stash@{{{}}}", index))
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to drop stash: {}",
            stderr.trim()
        )));
    }
    Ok(())
}

pub fn get_stash_diff(repo_path: &str, index: usize) -> Result<String, AppError> {
    let output = silent_git_command()
        .arg("stash")
        .arg("show")
        .arg("-p")
        .arg(format!("stash@{{{}}}", index))
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to show stash diff: {}",
            stderr.trim()
        )));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn get_stash_files(repo_path: &str, index: usize) -> Result<Vec<FileStatus>, AppError> {
    let stash_ref = format!("stash@{{{}}}", index);
    let mut files = Vec::new();

    // 1. Regular tracked stashed changes: git stash show --name-status stash@{index}
    let output = silent_git_command()
        .arg("stash")
        .arg("show")
        .arg("--name-status")
        .arg(&stash_ref)
        .current_dir(repo_path)
        .output()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() >= 2 {
                let status_code = parts[0];
                let path = parts[1..].join(" ");
                let status = match status_code.chars().next() {
                    Some('A') => FileStatusKind::Untracked,
                    Some('D') => FileStatusKind::Deleted,
                    Some('R') => FileStatusKind::Renamed,
                    _ => FileStatusKind::Modified,
                };
                files.push(FileStatus {
                    path,
                    status,
                    staged: false,
                });
            }
        }
    }

    // 2. Untracked files stash commit (stash@{index}^3 if present)
    let untracked_output = silent_git_command()
        .arg("ls-tree")
        .arg("-r")
        .arg("--name-only")
        .arg(format!("{}^3", stash_ref))
        .current_dir(repo_path)
        .output();

    if let Ok(u_out) = untracked_output {
        if u_out.status.success() {
            let u_stdout = String::from_utf8_lossy(&u_out.stdout);
            for line in u_stdout.lines() {
                let path = line.trim().to_string();
                if !path.is_empty() && !files.iter().any(|f| f.path == path) {
                    files.push(FileStatus {
                        path,
                        status: FileStatusKind::Untracked,
                        staged: false,
                    });
                }
            }
        }
    }

    Ok(files)
}

pub fn get_stash_file_diff(
    repo_path: &str,
    index: usize,
    file_path: &str,
) -> Result<DiffResult, AppError> {
    let repo = Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;

    let stash_ref = format!("stash@{{{}}}", index);

    let stash_obj = repo
        .revparse_single(&stash_ref)
        .map_err(|e| AppError::Git(format!("Failed to resolve stash '{}': {}", stash_ref, e)))?;
    let stash_commit = stash_obj
        .peel_to_commit()
        .map_err(|e| AppError::Git(format!("Failed to peel stash commit: {}", e)))?;

    let parent_commit = stash_commit
        .parent(0)
        .map_err(|e| AppError::Git(format!("Failed to get stash parent: {}", e)))?;

    let parent_tree = parent_commit
        .tree()
        .map_err(|e| AppError::Git(format!("Failed to get parent tree: {}", e)))?;
    let stash_tree = stash_commit
        .tree()
        .map_err(|e| AppError::Git(format!("Failed to get stash tree: {}", e)))?;

    let mut opts = DiffOptions::new();
    opts.pathspec(file_path);

    let diff = repo
        .diff_tree_to_tree(Some(&parent_tree), Some(&stash_tree), Some(&mut opts))
        .map_err(|e| AppError::Git(format!("Failed to calculate stash diff: {}", e)))?;

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
    })
    .map_err(|e| AppError::Git(format!("Failed to format diff patch: {}", e)))?;

    // If diff lines are empty, check if it was an untracked file stashed in stash@{index}^3
    if lines.is_empty() {
        let untracked_out = silent_git_command()
            .arg("show")
            .arg(format!("{}^3:{}", stash_ref, file_path))
            .current_dir(repo_path)
            .output();

        if let Ok(u_res) = untracked_out {
            if u_res.status.success() {
                let raw_content = String::from_utf8_lossy(&u_res.stdout);
                for (i, line) in raw_content.lines().enumerate() {
                    lines.push(DiffLine {
                        line_type: "addition".to_string(),
                        old_line_num: None,
                        new_line_num: Some((i + 1) as u32),
                        content: line.to_string(),
                    });
                }
                return Ok(DiffResult {
                    file_path: file_path.to_string(),
                    lines,
                    is_binary: false,
                    is_large_file: false,
                    file_size_bytes: u_res.stdout.len() as u64,
                });
            }
        }
    }

    Ok(DiffResult {
        file_path: file_path.to_string(),
        lines,
        is_binary,
        is_large_file: false,
        file_size_bytes: 0,
    })
}
