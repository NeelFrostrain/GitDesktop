use crate::domain::git_runtime::{
    detect_git_runtime, download_and_install_mingit, GitRuntimeInfo,
};
use crate::error::AppError;
use tauri::AppHandle;

#[tauri::command]
pub async fn git_runtime_get_status() -> Result<GitRuntimeInfo, AppError> {
    Ok(detect_git_runtime())
}

#[tauri::command]
pub async fn git_runtime_install_mingit(app_handle: AppHandle) -> Result<GitRuntimeInfo, AppError> {
    download_and_install_mingit(&app_handle).await
}
