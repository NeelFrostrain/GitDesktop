use serde::{Deserialize, Serialize};
use std::process::Command;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RebaseCommitPlanItem {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub action: String, // "pick", "reword", "edit", "squash", "fixup", "drop"
}

pub fn get_rebase_commits(repo_path: &str, target_branch: &str) -> Result<Vec<RebaseCommitPlanItem>, AppError> {
    let output = Command::new("git")
        .arg("log")
        .arg("--oneline")
        .arg(format!("{}..HEAD", target_branch))
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to get commits for rebase: {}", stderr.trim())));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut items = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(2, ' ').collect();
        if parts.len() == 2 {
            items.push(RebaseCommitPlanItem {
                sha: parts[0].to_string(),
                short_sha: parts[0].to_string(),
                message: parts[1].to_string(),
                action: "pick".to_string(),
            });
        }
    }

    // Git log lists commits newest first; rebase processes oldest first
    items.reverse();
    Ok(items)
}

pub fn execute_rebase(
    repo_path: &str,
    target: &str,
    plan: Vec<RebaseCommitPlanItem>,
) -> Result<(), AppError> {
    if plan.is_empty() {
        let output = Command::new("git")
            .arg("rebase")
            .arg(target)
            .current_dir(repo_path)
            .output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Git(format!("Rebase failed: {}", stderr.trim())));
        }
        return Ok(());
    }

    // Write a temporary instruction todo sequence
    let mut todo_content = String::new();
    for item in &plan {
        todo_content.push_str(&format!("{} {} {}\n", item.action, item.short_sha, item.message));
    }

    // Set sequence editor script
    let mut cmd = Command::new("git");
    cmd.arg("rebase").arg("-i").arg(target);
    cmd.env("GIT_SEQUENCE_EDITOR", format!("echo '{}' >", todo_content));
    cmd.current_dir(repo_path);

    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Interactive rebase failed: {}", stderr.trim())));
    }

    Ok(())
}

pub fn rebase_continue(repo_path: &str) -> Result<(), AppError> {
    let output = Command::new("git")
        .arg("rebase")
        .arg("--continue")
        .env("GIT_EDITOR", "true")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Rebase continue failed: {}", stderr.trim())));
    }
    Ok(())
}

pub fn rebase_abort(repo_path: &str) -> Result<(), AppError> {
    let output = Command::new("git")
        .arg("rebase")
        .arg("--abort")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Rebase abort failed: {}", stderr.trim())));
    }
    Ok(())
}

pub fn rebase_skip(repo_path: &str) -> Result<(), AppError> {
    let output = Command::new("git")
        .arg("rebase")
        .arg("--skip")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Rebase skip failed: {}", stderr.trim())));
    }
    Ok(())
}
