use crate::error::AppError;
use std::process::Command;

pub fn export_patch(
    repo_path: &str,
    target_path: &str,
    range: Option<&str>,
) -> Result<(), AppError> {
    let mut cmd = Command::new("git");

    if let Some(r) = range {
        cmd.arg("format-patch").arg("--stdout").arg(r);
    } else {
        cmd.arg("diff");
    }

    cmd.current_dir(repo_path);
    let output = cmd.output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to generate patch: {}",
            stderr.trim()
        )));
    }

    std::fs::write(target_path, output.stdout)
        .map_err(|e| AppError::Unknown(format!("Failed to write patch file: {}", e)))?;

    Ok(())
}

pub fn apply_patch(repo_path: &str, patch_file_path: &str) -> Result<(), AppError> {
    let output = Command::new("git")
        .arg("apply")
        .arg(patch_file_path)
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to apply patch: {}",
            stderr.trim()
        )));
    }

    Ok(())
}
