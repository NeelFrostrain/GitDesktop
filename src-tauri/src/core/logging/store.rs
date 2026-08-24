use crate::core::logging::model::{LogEntry, LogFilter};
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const MAX_LOG_ENTRIES: usize = 10_000;
const MAX_LOG_FILE_BYTES: u64 = 50 * 1024 * 1024; // 50MB

static STORE_LOCK: Mutex<()> = Mutex::new(());

/// Generates a filesystem-safe identifier for a repository path.
pub fn safe_repo_id(repo_id: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(repo_id.as_bytes());
    let hash = format!("{:x}", hasher.finalize());
    let short_hash = &hash[..8];

    let sanitized: String = repo_id
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();

    let name = sanitized.trim_matches('_');
    let short_name = if name.len() > 24 {
        &name[name.len() - 24..]
    } else if name.is_empty() {
        "repo"
    } else {
        name
    };

    format!("{}_{}", short_name, short_hash)
}

/// Base logging directory: `{data_dir}/gitlab-desktop/logs`
pub fn get_logs_base_dir() -> PathBuf {
    let mut path = if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata)
    } else if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        PathBuf::from(home)
    } else {
        PathBuf::from(".")
    };
    path.push("gitlab-desktop");
    path.push("logs");
    path
}

/// Global log file: `{logs_dir}/app.jsonl`
pub fn get_global_log_path() -> PathBuf {
    get_logs_base_dir().join("app.jsonl")
}

/// Repo log file: `{logs_dir}/repos/{safe_repo_id}.jsonl`
pub fn get_repo_log_path(repo_id: &str) -> PathBuf {
    get_logs_base_dir()
        .join("repos")
        .join(format!("{}.jsonl", safe_repo_id(repo_id)))
}

/// Appends a LogEntry to the global log and per-repo log (if applicable).
pub fn append_log(entry: &LogEntry) {
    let _guard = match STORE_LOCK.lock() {
        Ok(g) => g,
        Err(poisoned) => poisoned.into_inner(),
    };

    let line = match serde_json::to_string(entry) {
        Ok(l) => l,
        Err(_) => return,
    };

    // 1. Append to global log
    let global_path = get_global_log_path();
    append_to_file(&global_path, &line);
    rotate_if_needed(&global_path);

    // 2. Append to repo log if repo_id is set
    if let Some(ref repo_id) = entry.repo_id {
        let repo_path = get_repo_log_path(repo_id);
        append_to_file(&repo_path, &line);
        rotate_if_needed(&repo_path);
    }
}

fn append_to_file(path: &Path, line: &str) {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{}", line);
    }
}

fn rotate_if_needed(path: &Path) {
    if !path.exists() {
        return;
    }

    let should_rotate = if let Ok(meta) = fs::metadata(path) {
        meta.len() > MAX_LOG_FILE_BYTES
    } else {
        false
    };

    if should_rotate {
        prune_file(path, MAX_LOG_ENTRIES / 2);
    }
}

fn prune_file(path: &Path, keep_last: usize) {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return,
    };

    let reader = BufReader::new(file);
    let mut lines: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();

    if lines.len() > keep_last {
        let trimmed: Vec<String> = lines.split_off(lines.len() - keep_last);
        if let Ok(mut out) = fs::File::create(path) {
            for l in trimmed {
                let _ = writeln!(out, "{}", l);
            }
        }
    }
}

/// Reads entries from a file in reverse chronological order (newest first).
fn read_entries_from_file(path: &Path) -> Vec<LogEntry> {
    if !path.exists() {
        return Vec::new();
    }

    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };

    let reader = BufReader::new(file);
    let mut entries = Vec::new();

    for line in reader.lines() {
        if let Ok(l) = line {
            let trimmed = l.trim();
            if !trimmed.is_empty() {
                if let Ok(entry) = serde_json::from_str::<LogEntry>(trimmed) {
                    entries.push(entry);
                }
            }
        }
    }

    entries.reverse(); // Newest first
    entries
}

/// Queries logs from disk matching the filter, paginated.
pub fn query_logs(filter: &LogFilter, limit: usize, offset: usize) -> Vec<LogEntry> {
    let _guard = match STORE_LOCK.lock() {
        Ok(g) => g,
        Err(poisoned) => poisoned.into_inner(),
    };

    let all_entries = if filter.this_repo_only.unwrap_or(false) && filter.repo_id.is_some() {
        let repo_id = filter.repo_id.as_ref().unwrap();
        read_entries_from_file(&get_repo_log_path(repo_id))
    } else {
        read_entries_from_file(&get_global_log_path())
    };

    all_entries
        .into_iter()
        .filter(|e| filter.matches(e))
        .skip(offset)
        .take(limit)
        .collect()
}

/// Exports matching logs to the specified destination path.
pub fn export_logs(filter: &LogFilter, dest_path: &str) -> Result<(), String> {
    let entries = query_logs(filter, 100_000, 0);

    let mut file =
        fs::File::create(dest_path).map_err(|e| format!("Failed to create export file: {}", e))?;

    let is_json = dest_path.ends_with(".json") || dest_path.ends_with(".jsonl");

    if is_json {
        for entry in entries {
            let line = serde_json::to_string(&entry)
                .map_err(|e| format!("Failed to serialize entry: {}", e))?;
            writeln!(file, "{}", line).map_err(|e| format!("Failed to write to file: {}", e))?;
        }
    } else {
        writeln!(file, "=== GIT DESKTOP LOG EXPORT ===").map_err(|e| e.to_string())?;
        writeln!(file, "Generated: {}", chrono::Utc::now().to_rfc3339())
            .map_err(|e| e.to_string())?;
        writeln!(file, "Total Entries: {}", entries.len()).map_err(|e| e.to_string())?;
        writeln!(file, "==============================\n").map_err(|e| e.to_string())?;

        for entry in entries {
            let repo_str = entry
                .repo_id
                .as_deref()
                .map(|r| format!(" [{}]", r))
                .unwrap_or_default();
            let meta_str = entry
                .metadata
                .as_ref()
                .map(|m| format!("\n  Metadata: {}", m))
                .unwrap_or_default();

            writeln!(
                file,
                "[{}] [{:?}] [{:?}]{} {}{}",
                entry.at, entry.level, entry.category, repo_str, entry.message, meta_str
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// Clears logs: either for a specific repo or globally.
pub fn clear_logs(repo_id: Option<&str>) -> Result<(), String> {
    let _guard = match STORE_LOCK.lock() {
        Ok(g) => g,
        Err(poisoned) => poisoned.into_inner(),
    };

    if let Some(r) = repo_id {
        let repo_path = get_repo_log_path(r);
        if repo_path.exists() {
            let _ = fs::remove_file(repo_path);
        }
    } else {
        let global_path = get_global_log_path();
        if global_path.exists() {
            let _ = fs::remove_file(global_path);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::logging::model::{LogCategory, LogLevel};

    #[test]
    fn test_log_model_creation_and_filter() {
        let entry = LogEntry::new(
            LogLevel::Success,
            LogCategory::Remote,
            "Pushed 3 commits to origin/main",
            Some("repo_test_123".to_string()),
            Some(serde_json::json!({ "commits": 3 })),
        );

        assert_eq!(entry.level, LogLevel::Success);
        assert_eq!(entry.category, LogCategory::Remote);
        assert_eq!(entry.repo_id.as_deref(), Some("repo_test_123"));

        let mut filter = LogFilter::default();
        assert!(filter.matches(&entry));

        filter.categories = Some(vec![LogCategory::Remote]);
        assert!(filter.matches(&entry));

        filter.categories = Some(vec![LogCategory::Account]);
        assert!(!filter.matches(&entry));

        filter.categories = None;
        filter.levels = Some(vec![LogLevel::Success]);
        assert!(filter.matches(&entry));

        filter.search = Some("pushed 3".to_string());
        assert!(filter.matches(&entry));

        filter.search = Some("nonexistent".to_string());
        assert!(!filter.matches(&entry));
    }

    #[test]
    fn test_safe_repo_id() {
        let safe = safe_repo_id("E:/Projects/gitlab-desktop");
        assert!(!safe.contains(':'));
        assert!(!safe.contains('/'));
        assert!(!safe.contains('\\'));
    }
}
