use crate::domain::settings::store;
use crate::error::AppError;
use serde_json::Value;
use std::collections::HashMap;

#[tauri::command]
pub async fn settings_get_all() -> Result<HashMap<String, Value>, AppError> {
    Ok(store::get_app_settings())
}

#[tauri::command]
pub async fn settings_save_value(key: String, value: Value) -> Result<(), AppError> {
    store::set_app_setting(&key, value)
}

#[tauri::command]
pub async fn settings_reset_value(key: String) -> Result<(), AppError> {
    store::reset_app_setting(&key)
}

#[tauri::command]
pub async fn settings_reset_all() -> Result<(), AppError> {
    store::reset_all_app_settings()
}

#[tauri::command]
pub async fn settings_get_repo(repo_path: String) -> Result<HashMap<String, Value>, AppError> {
    Ok(store::get_repo_settings(&repo_path))
}

#[tauri::command]
pub async fn settings_save_repo_value(
    repo_path: String,
    key: String,
    value: Value,
) -> Result<(), AppError> {
    store::set_repo_setting(&repo_path, &key, value)
}

#[tauri::command]
pub async fn settings_reset_repo_value(repo_path: String, key: String) -> Result<(), AppError> {
    store::reset_repo_setting(&repo_path, &key)
}
