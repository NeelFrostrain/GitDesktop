use crate::domain::terminal::{
    autocomplete, history, log_store, pty, AutocompleteSuggestion, HistoryEntry, LogSessionSummary,
    TerminalSessionInfo,
};
use crate::error::AppError;
use tauri::AppHandle;

#[tauri::command]
pub fn terminal_open(
    app: AppHandle,
    repo_id: String,
    repo_path: String,
) -> Result<TerminalSessionInfo, AppError> {
    pty::open_session(&app, &repo_id, &repo_path)
}

#[tauri::command]
pub fn terminal_write(repo_id: String, data: String) -> Result<(), AppError> {
    pty::write_to_session(&repo_id, &data)
}

#[tauri::command]
pub fn terminal_resize(repo_id: String, cols: u16, rows: u16) -> Result<(), AppError> {
    pty::resize_session(&repo_id, cols, rows)
}

#[tauri::command]
pub fn terminal_kill(repo_id: String) -> Result<(), AppError> {
    pty::kill_session(&repo_id)
}

#[tauri::command]
pub fn terminal_get_history(
    repo_id: String,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<HistoryEntry>, AppError> {
    history::get_history(&repo_id, limit.unwrap_or(20), offset.unwrap_or(0))
}

#[tauri::command]
pub fn terminal_record_history(
    repo_id: String,
    cmd: String,
    exit_code: Option<i32>,
) -> Result<(), AppError> {
    history::append_history(&repo_id, &cmd, exit_code)
}

#[tauri::command]
pub fn terminal_clear_history(repo_id: String) -> Result<(), AppError> {
    history::clear_history(&repo_id)
}

#[tauri::command]
pub fn terminal_list_log_sessions(repo_id: String) -> Result<Vec<LogSessionSummary>, AppError> {
    log_store::list_log_sessions(&repo_id)
}

#[tauri::command]
pub fn terminal_get_log_session(repo_id: String, session_id: String) -> Result<String, AppError> {
    log_store::get_log_session(&repo_id, &session_id)
}

#[tauri::command]
pub fn terminal_export_log_session(
    repo_id: String,
    session_id: String,
    dest_path: String,
) -> Result<(), AppError> {
    log_store::export_log_session(&repo_id, &session_id, &dest_path)
}

#[tauri::command]
pub fn autocomplete_suggest(
    repo_path: String,
    partial_command: String,
    cursor_pos: u32,
) -> Result<Vec<AutocompleteSuggestion>, AppError> {
    autocomplete::autocomplete_suggest(&repo_path, &partial_command, cursor_pos)
}
