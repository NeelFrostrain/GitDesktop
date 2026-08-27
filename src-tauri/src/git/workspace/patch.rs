use crate::error::AppError;
use crate::git::command::silent_git_command;

pub fn export_patch(
    repo_path: &str,
    target_path: &str,
    range: Option<&str>,
) -> Result<(), AppError> {
    let mut cmd = silent_git_command();

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
    let output = silent_git_command()
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

pub fn stage_patch(repo_path: &str, patch_content: &str) -> Result<(), AppError> {
    use std::io::Write;
    use std::process::Stdio;

    let mut cmd = silent_git_command();
    cmd.arg("apply")
        .arg("--cached")
        .arg("--recount")
        .arg("--whitespace=nowarn")
        .arg("-")
        .current_dir(repo_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn()?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(patch_content.as_bytes())?;
    }

    let output = child.wait_with_output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to stage selected lines: {}",
            stderr.trim()
        )));
    }

    Ok(())
}

pub fn unstage_patch(repo_path: &str, patch_content: &str) -> Result<(), AppError> {
    use std::io::Write;
    use std::process::Stdio;

    let mut cmd = silent_git_command();
    cmd.arg("apply")
        .arg("--cached")
        .arg("--reverse")
        .arg("--recount")
        .arg("--whitespace=nowarn")
        .arg("-")
        .current_dir(repo_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn()?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(patch_content.as_bytes())?;
    }

    let output = child.wait_with_output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to unstage selected lines: {}",
            stderr.trim()
        )));
    }

    Ok(())
}

pub fn discard_patch(repo_path: &str, patch_content: &str) -> Result<(), AppError> {
    use std::io::Write;
    use std::process::Stdio;

    let mut cmd = silent_git_command();
    cmd.arg("apply")
        .arg("--reverse")
        .arg("--recount")
        .arg("--whitespace=nowarn")
        .arg("-")
        .current_dir(repo_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn()?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(patch_content.as_bytes())?;
    }

    let output = child.wait_with_output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!(
            "Failed to discard selected lines: {}",
            stderr.trim()
        )));
    }

    Ok(())
}
