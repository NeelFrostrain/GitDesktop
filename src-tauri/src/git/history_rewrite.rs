use serde::{Deserialize, Serialize};
use std::process::Command;
use std::fs;
use git2::Repository;
use crate::error::AppError;
use crate::git::status::get_repo_status;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReorderCommitsPayload {
    pub source_sha: String,
    pub target_sha: String,
    pub position: String, // "before" | "after"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MergeCommitsPayload {
    pub source_sha: String,
    pub target_sha: String,
    pub new_message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum HistoryOperationPayload {
    Reorder {
        #[serde(rename = "sourceSha")]
        source_sha: String,
        #[serde(rename = "targetSha")]
        target_sha: String,
        position: String,
    },
    Merge {
        #[serde(rename = "sourceSha")]
        source_sha: String,
        #[serde(rename = "targetSha")]
        target_sha: String,
        #[serde(rename = "newMessage")]
        new_message: String,
    },
    Remove {
        #[serde(rename = "sourceSha")]
        source_sha: String,
    },
}

pub fn execute_history_operation(
    repo_path: &str,
    operation: HistoryOperationPayload,
) -> Result<(), AppError> {
    // 1. Safety check: ensure working tree is clean
    let status = get_repo_status(repo_path)?;
    if !status.files.is_empty() {
        return Err(AppError::Git(
            "Working directory contains uncommitted changes. Please commit or stash your changes before rewriting history.".to_string()
        ));
    }

    match operation {
        HistoryOperationPayload::Reorder { source_sha, target_sha, position } => {
            reorder_commits(repo_path, &source_sha, &target_sha, &position)
        }
        HistoryOperationPayload::Merge { source_sha, target_sha, new_message } => {
            merge_commits(repo_path, &source_sha, &target_sha, &new_message)
        }
        HistoryOperationPayload::Remove { .. } => {
            Err(AppError::Git("Commit removal is not enabled yet.".to_string()))
        }
    }
}

fn get_commits_up_to_base(repo_path: &str, oldest_sha: &str) -> Result<(String, Vec<(String, String)>), AppError> {
    let repo = Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;

    let oid = git2::Oid::from_str(oldest_sha)
        .map_err(|_| AppError::Validation(format!("Invalid commit SHA: {}", oldest_sha)))?;

    let commit = repo.find_commit(oid)
        .map_err(|e| AppError::Git(format!("Commit not found: {}", e)))?;

    let base_arg = if let Ok(parent) = commit.parent(0) {
        parent.id().to_string()
    } else {
        // Root commit
        "--root".to_string()
    };

    // Get list of commits from base_arg..HEAD in chronological order (oldest first)
    let log_range = if base_arg == "--root" {
        "HEAD".to_string()
    } else {
        format!("{}..HEAD", base_arg)
    };

    let output = Command::new("git")
        .arg("log")
        .arg("--reverse")
        .arg("--format=%H %s")
        .arg(&log_range)
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to read history range: {}", stderr.trim())));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut items = Vec::new();
    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(2, ' ').collect();
        if parts.len() == 2 {
            items.push((parts[0].to_string(), parts[1].to_string()));
        } else if parts.len() == 1 && !parts[0].is_empty() {
            items.push((parts[0].to_string(), String::new()));
        }
    }

    Ok((base_arg, items))
}

fn reorder_commits(
    repo_path: &str,
    source_sha: &str,
    target_sha: &str,
    position: &str,
) -> Result<(), AppError> {
    if source_sha == target_sha {
        return Ok(());
    }

    // Find oldest involved commit
    let (base_arg, mut commits) = get_commits_up_to_base(repo_path, source_sha)?;

    let source_idx = commits.iter().position(|(sha, _)| sha == source_sha || sha.starts_with(source_sha))
        .ok_or_else(|| AppError::Git(format!("Source commit {} not found in active branch history", source_sha)))?;

    if !commits.iter().any(|(sha, _)| sha == target_sha || sha.starts_with(target_sha)) {
        return Err(AppError::Git(format!("Target commit {} not found in active branch history", target_sha)));
    }

    let item = commits.remove(source_idx);

    let mut new_target_idx = commits.iter().position(|(sha, _)| sha == target_sha || sha.starts_with(target_sha))
        .ok_or_else(|| AppError::Git("Target commit missing after reorder calculation".to_string()))?;

    if position == "after" {
        new_target_idx += 1;
    }

    commits.insert(new_target_idx, item);

    // Build rebase todo list
    let mut todo_content = String::new();
    for (sha, msg) in &commits {
        let short = if sha.len() >= 7 { &sha[..7] } else { sha };
        todo_content.push_str(&format!("pick {} {}\n", short, msg));
    }

    run_interactive_rebase(repo_path, &base_arg, &todo_content, None)
}

fn merge_commits(
    repo_path: &str,
    source_sha: &str,
    target_sha: &str,
    new_message: &str,
) -> Result<(), AppError> {
    if source_sha == target_sha {
        return Ok(());
    }

    // Determine oldest commit between source and target
    let (_, commits) = get_commits_up_to_base(repo_path, source_sha)?;


    let source_idx = commits.iter().position(|(sha, _)| sha == source_sha || sha.starts_with(source_sha))
        .ok_or_else(|| AppError::Git(format!("Source commit {} not found in active branch history", source_sha)))?;

    let target_idx = commits.iter().position(|(sha, _)| sha == target_sha || sha.starts_with(target_sha))
        .ok_or_else(|| AppError::Git(format!("Target commit {} not found in active branch history", target_sha)))?;

    let oldest_sha = if source_idx < target_idx { source_sha } else { target_sha };
    let (base_arg, mut commits) = get_commits_up_to_base(repo_path, oldest_sha)?;

    let s_idx = commits.iter().position(|(sha, _)| sha == source_sha || sha.starts_with(source_sha))
        .ok_or_else(|| AppError::Git("Source commit not found".to_string()))?;
    let source_item = commits.remove(s_idx);

    let t_idx = commits.iter().position(|(sha, _)| sha == target_sha || sha.starts_with(target_sha))
        .ok_or_else(|| AppError::Git("Target commit not found".to_string()))?;

    // Insert source right after target to squash into target
    commits.insert(t_idx + 1, source_item);

    // Build rebase todo list
    let mut todo_content = String::new();
    for (idx, (sha, msg)) in commits.iter().enumerate() {
        let short = if sha.len() >= 7 { &sha[..7] } else { sha };
        if idx == t_idx + 1 {
            // This is the moved source commit, squash it into target
            todo_content.push_str(&format!("squash {} {}\n", short, msg));
        } else if idx == t_idx && !new_message.trim().is_empty() {
            // Reword target commit if new message provided
            todo_content.push_str(&format!("reword {} {}\n", short, msg));
        } else {
            todo_content.push_str(&format!("pick {} {}\n", short, msg));
        }
    }

    run_interactive_rebase(repo_path, &base_arg, &todo_content, Some(new_message))
}

fn run_interactive_rebase(
    repo_path: &str,
    base_arg: &str,
    todo_content: &str,
    commit_msg: Option<&str>,
) -> Result<(), AppError> {
    // Write temporary todo file
    let temp_dir = std::env::temp_dir();
    let todo_file_path = temp_dir.join(format!("git_todo_{}.txt", rand::random::<u32>()));
    fs::write(&todo_file_path, todo_content)
        .map_err(|e| AppError::Git(format!("Failed to write temporary todo file: {}", e)))?;

    let todo_str = todo_file_path.to_string_lossy().to_string();

    let seq_editor = if cfg!(windows) {
        format!("cmd /c copy /Y \"{}\"", todo_str)
    } else {
        format!("cp \"{}\"", todo_str)
    };

    let mut msg_file_path = temp_dir.join("git_msg_dummy.txt");
    let mut editor_env = None;

    if let Some(msg) = commit_msg {
        msg_file_path = temp_dir.join(format!("git_msg_{}.txt", rand::random::<u32>()));
        fs::write(&msg_file_path, msg)
            .map_err(|e| AppError::Git(format!("Failed to write temporary msg file: {}", e)))?;
        let msg_str = msg_file_path.to_string_lossy().to_string();

        let editor_cmd = if cfg!(windows) {
            format!("cmd /c copy /Y \"{}\"", msg_str)
        } else {
            format!("cp \"{}\"", msg_str)
        };
        editor_env = Some(editor_cmd);
    }

    let mut cmd = Command::new("git");
    cmd.arg("rebase").arg("-i");
    if base_arg != "--root" {
        cmd.arg(base_arg);
    } else {
        cmd.arg("--root");
    }

    cmd.env("GIT_SEQUENCE_EDITOR", &seq_editor);
    if let Some(ref ed) = editor_env {
        cmd.env("GIT_EDITOR", ed);
    }

    cmd.current_dir(repo_path);

    let output = cmd.output()?;

    // Clean temp files
    let _ = fs::remove_file(&todo_file_path);
    if editor_env.is_some() {
        let _ = fs::remove_file(&msg_file_path);
    }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Automatically abort failed rebase to restore repo state
        let _ = Command::new("git")
            .arg("rebase")
            .arg("--abort")
            .current_dir(repo_path)
            .output();

        let err_detail = if !stderr.trim().is_empty() { stderr.trim() } else { stdout.trim() };
        return Err(AppError::Git(format!("History rewrite failed: {}. Rebase aborted and repository restored.", err_detail)));
    }

    Ok(())
}
