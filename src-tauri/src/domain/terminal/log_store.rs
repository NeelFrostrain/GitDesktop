use super::{get_logs_dir, safe_repo_id, LogSessionSummary};
use crate::error::AppError;
use chrono::Utc;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

pub fn get_repo_logs_dir(repo_id: &str) -> std::path::PathBuf {
    let mut dir = get_logs_dir();
    dir.push(safe_repo_id(repo_id));
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn append_to_session_log(repo_id: &str, session_id: &str, chunk: &str) {
    if chunk.is_empty() {
        return;
    }
    let dir = get_repo_logs_dir(repo_id);
    let file_path = dir.join(format!("{}.log", session_id));
    let is_new = !file_path.exists();

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&file_path) {
        if is_new {
            let header = format!(
                "=== GIT DESKTOP TERMINAL SESSION ===\nRepo: {}\nSession ID: {}\nStarted: {}\n====================================\n\n",
                repo_id,
                session_id,
                Utc::now().to_rfc3339()
            );
            let _ = file.write_all(header.as_bytes());
        }
        let _ = file.write_all(chunk.as_bytes());
    }
}

pub fn list_log_sessions(repo_id: &str) -> Result<Vec<LogSessionSummary>, AppError> {
    let dir = get_repo_logs_dir(repo_id);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut sessions: Vec<LogSessionSummary> = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("log") {
                let file_name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
                if file_name.is_empty() {
                    continue;
                }

                let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                let date = entry
                    .metadata()
                    .and_then(|m| m.modified())
                    .map(|sys_time| {
                        let dt: chrono::DateTime<Utc> = sys_time.into();
                        dt.to_rfc3339()
                    })
                    .unwrap_or_else(|_| Utc::now().to_rfc3339());

                // Read quick sample to estimate command count / duration
                let content = fs::read_to_string(&path).unwrap_or_default();
                let command_count = content.lines().filter(|l| {
                    let trim = l.trim_start();
                    trim.starts_with("$ ") || trim.starts_with("PS ") || trim.starts_with("> ") || trim.starts_with("[GD_CMD:")
                }).count();

                sessions.push(LogSessionSummary {
                    session_id: file_name,
                    repo_id: repo_id.to_string(),
                    date,
                    command_count: if command_count > 0 { command_count } else { 1 },
                    size_bytes,
                    duration_secs: None,
                });
            }
        }
    }

    // Sort descending by date
    sessions.sort_by(|a, b| b.date.cmp(&a.date));

    Ok(sessions)
}

pub fn get_log_session(repo_id: &str, session_id: &str) -> Result<String, AppError> {
    let dir = get_repo_logs_dir(repo_id);
    let file_path = dir.join(format!("{}.log", session_id));

    if !file_path.exists() {
        return Err(AppError::NotFound(format!("Log session '{}' not found", session_id)));
    }

    fs::read_to_string(file_path).map_err(|e| AppError::Filesystem(format!("Failed to read session log: {}", e)))
}

pub fn export_log_session(repo_id: &str, session_id: &str, dest_path: &str) -> Result<(), AppError> {
    let dir = get_repo_logs_dir(repo_id);
    let src_path = dir.join(format!("{}.log", session_id));

    if !src_path.exists() {
        return Err(AppError::NotFound(format!("Log session '{}' not found", session_id)));
    }

    let dest = Path::new(dest_path);
    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }

    fs::copy(&src_path, dest)
        .map_err(|e| AppError::Filesystem(format!("Failed to export log file: {}", e)))?;

    Ok(())
}

pub fn cleanup_old_sessions(repo_id: &str, keep_count: usize) {
    let dir = get_repo_logs_dir(repo_id);
    if !dir.exists() {
        return;
    }

    if let Ok(entries) = fs::read_dir(&dir) {
        let mut files: Vec<(std::path::PathBuf, std::time::SystemTime)> = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("log") {
                if let Ok(meta) = entry.metadata() {
                    if let Ok(mod_time) = meta.modified() {
                        files.push((path, mod_time));
                    }
                }
            }
        }

        // Sort descending by modified time
        files.sort_by(|a, b| b.1.cmp(&a.1));

        if files.len() > keep_count {
            for (path, _) in &files[keep_count..] {
                let _ = fs::remove_file(path);
            }
        }
    }
}
