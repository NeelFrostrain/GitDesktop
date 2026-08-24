use crate::error::AppError;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

fn get_app_settings_file() -> PathBuf {
    let mut path = if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata)
    } else if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        PathBuf::from(home)
    } else {
        PathBuf::from(".")
    };
    path.push("gitlab-desktop");
    let _ = fs::create_dir_all(&path);
    path.push("settings.json");
    path
}

fn get_repo_settings_file(repo_path: &str) -> PathBuf {
    let base = Path::new(repo_path);
    let git_dir = base.join(".git");
    if git_dir.is_dir() {
        git_dir.join("desktop_settings.json")
    } else {
        base.join(".desktop_settings.json")
    }
}

pub fn get_app_settings() -> HashMap<String, Value> {
    let file = get_app_settings_file();
    if let Ok(content) = fs::read_to_string(file) {
        if let Ok(map) = serde_json::from_str::<HashMap<String, Value>>(&content) {
            return map;
        }
    }
    HashMap::new()
}

pub fn set_app_setting(key: &str, value: Value) -> Result<(), AppError> {
    let mut map = get_app_settings();
    map.insert(key.to_string(), value);
    let file = get_app_settings_file();
    let json = serde_json::to_string_pretty(&map)
        .map_err(|e| AppError::Validation(format!("Serialization error: {}", e)))?;
    fs::write(file, json).map_err(|e| AppError::Filesystem(format!("Write error: {}", e)))?;
    Ok(())
}

pub fn reset_app_setting(key: &str) -> Result<(), AppError> {
    let mut map = get_app_settings();
    if map.remove(key).is_some() {
        let file = get_app_settings_file();
        let json = serde_json::to_string_pretty(&map)
            .map_err(|e| AppError::Validation(format!("Serialization error: {}", e)))?;
        fs::write(file, json).map_err(|e| AppError::Filesystem(format!("Write error: {}", e)))?;
    }
    Ok(())
}

pub fn reset_all_app_settings() -> Result<(), AppError> {
    let file = get_app_settings_file();
    let _ = fs::remove_file(file);
    Ok(())
}

pub fn get_repo_settings(repo_path: &str) -> HashMap<String, Value> {
    let file = get_repo_settings_file(repo_path);
    if let Ok(content) = fs::read_to_string(file) {
        if let Ok(map) = serde_json::from_str::<HashMap<String, Value>>(&content) {
            return map;
        }
    }
    HashMap::new()
}

pub fn set_repo_setting(repo_path: &str, key: &str, value: Value) -> Result<(), AppError> {
    let mut map = get_repo_settings(repo_path);
    map.insert(key.to_string(), value);
    let file = get_repo_settings_file(repo_path);
    let json = serde_json::to_string_pretty(&map)
        .map_err(|e| AppError::Validation(format!("Serialization error: {}", e)))?;
    fs::write(file, json).map_err(|e| AppError::Filesystem(format!("Write error: {}", e)))?;
    Ok(())
}

pub fn reset_repo_setting(repo_path: &str, key: &str) -> Result<(), AppError> {
    let mut map = get_repo_settings(repo_path);
    if map.remove(key).is_some() {
        let file = get_repo_settings_file(repo_path);
        let json = serde_json::to_string_pretty(&map)
            .map_err(|e| AppError::Validation(format!("Serialization error: {}", e)))?;
        fs::write(file, json).map_err(|e| AppError::Filesystem(format!("Write error: {}", e)))?;
    }
    Ok(())
}
