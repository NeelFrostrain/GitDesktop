use tauri::{command, AppHandle};
use crate::core::logging::model::{LogCategory, LogEntry, LogFilter, LogLevel};
use crate::core::logging::{bus, store};
use crate::error::AppError;

#[command]
pub async fn logs_query(
    filter: Option<LogFilter>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<LogEntry>, AppError> {
    let f = filter.unwrap_or_default();
    let l = limit.unwrap_or(100) as usize;
    let o = offset.unwrap_or(0) as usize;

    tokio::task::spawn_blocking(move || {
        Ok(store::query_logs(&f, l, o))
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn logs_export(
    filter: Option<LogFilter>,
    dest_path: String,
) -> Result<(), AppError> {
    let f = filter.unwrap_or_default();

    tokio::task::spawn_blocking(move || {
        store::export_logs(&f, &dest_path).map_err(|e| AppError::Unknown(e))
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn logs_clear(repo_id: Option<String>) -> Result<(), AppError> {
    tokio::task::spawn_blocking(move || {
        store::clear_logs(repo_id.as_deref()).map_err(|e| AppError::Unknown(e))
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[command]
pub async fn logs_add(
    app: AppHandle,
    level: LogLevel,
    category: LogCategory,
    message: String,
    repo_id: Option<String>,
    metadata: Option<serde_json::Value>,
) -> Result<LogEntry, AppError> {
    let entry = LogEntry::new(level, category, message, repo_id, metadata);
    bus::log(Some(&app), entry.clone());
    Ok(entry)
}
