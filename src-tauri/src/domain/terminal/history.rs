use super::{get_history_dir, safe_repo_id, HistoryEntry};
use crate::error::AppError;
use chrono::Utc;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};

pub fn append_history(repo_id: &str, cmd: &str, exit_code: Option<i32>) -> Result<(), AppError> {
    let clean_cmd = cmd.trim();
    if clean_cmd.is_empty() {
        return Ok(());
    }

    let file_path = get_history_dir().join(format!("{}.jsonl", safe_repo_id(repo_id)));
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| AppError::Filesystem(format!("Failed to open history file: {}", e)))?;

    let entry = HistoryEntry {
        cmd: clean_cmd.to_string(),
        at: Utc::now().to_rfc3339(),
        exit_code,
    };

    let json_line = serde_json::to_string(&entry)
        .map_err(|e| AppError::Validation(format!("Failed to serialize history entry: {}", e)))?;

    writeln!(file, "{}", json_line)
        .map_err(|e| AppError::Filesystem(format!("Failed to write history entry: {}", e)))?;

    crate::log_info!(
        crate::core::logging::LogCategory::Terminal,
        format!("Ran '{}'", clean_cmd);
        repo_id: Some(repo_id.to_string()),
        meta: serde_json::json!({ "command": clean_cmd, "exit_code": exit_code })
    );

    Ok(())
}

pub fn get_history(repo_id: &str, limit: u32, offset: u32) -> Result<Vec<HistoryEntry>, AppError> {
    let file_path = get_history_dir().join(format!("{}.jsonl", safe_repo_id(repo_id)));
    if !file_path.exists() {
        return Ok(Vec::new());
    }

    let file = fs::File::open(&file_path)
        .map_err(|e| AppError::Filesystem(format!("Failed to read history file: {}", e)))?;
    let reader = BufReader::new(file);

    let mut entries: Vec<HistoryEntry> = Vec::new();
    for line in reader.lines() {
        if let Ok(l) = line {
            let trimmed = l.trim();
            if !trimmed.is_empty() {
                if let Ok(entry) = serde_json::from_str::<HistoryEntry>(trimmed) {
                    entries.push(entry);
                }
            }
        }
    }

    // Most recent entries first or in sequence
    let total = entries.len();
    if total == 0 {
        return Ok(Vec::new());
    }

    // Offset is from the end (most recent) if desired, or standard
    // For replay on open, we typically want the last N commands in chronological order:
    let start = total.saturating_sub((offset + limit) as usize);
    let end = total.saturating_sub(offset as usize);
    let slice = &entries[start..end];

    Ok(slice.to_vec())
}

pub fn clear_history(repo_id: &str) -> Result<(), AppError> {
    let file_path = get_history_dir().join(format!("{}.jsonl", safe_repo_id(repo_id)));
    if file_path.exists() {
        let _ = fs::remove_file(file_path);
    }
    Ok(())
}
