use std::process::Command;
use crate::error::AppError;

pub fn cherry_pick_commits(
    repo_path: &str,
    shas: Vec<String>,
    no_commit: bool,
) -> Result<(), AppError> {
    if shas.is_empty() {
        return Err(AppError::Validation("No commits specified for cherry-pick".to_string()));
    }

    let mut cmd = Command::new("git");
    cmd.arg("cherry-pick");

    if no_commit {
        cmd.arg("-n");
    }

    for sha in &shas {
        cmd.arg(sha);
    }

    cmd.current_dir(repo_path);
    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Cherry-pick failed: {}", stderr.trim())));
    }

    Ok(())
}

pub fn cherry_pick_continue(repo_path: &str) -> Result<(), AppError> {
    let output = Command::new("git")
        .arg("cherry-pick")
        .arg("--continue")
        .env("GIT_EDITOR", "true")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Cherry-pick continue failed: {}", stderr.trim())));
    }
    Ok(())
}

pub fn cherry_pick_abort(repo_path: &str) -> Result<(), AppError> {
    let output = Command::new("git")
        .arg("cherry-pick")
        .arg("--abort")
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Cherry-pick abort failed: {}", stderr.trim())));
    }
    Ok(())
}
