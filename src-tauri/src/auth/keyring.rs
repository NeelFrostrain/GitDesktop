use keyring::Entry;
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use crate::error::AppError;

const SERVICE_NAME: &str = "gitlab-desktop";
const TOKEN_KEY: &str = "gitlab_token";
const SERVER_URL_KEY: &str = "gitlab_server_url";

#[derive(Serialize, Deserialize, Default)]
struct LocalAuthStore {
    token: Option<String>,
    server_url: Option<String>,
}

fn get_local_auth_file() -> PathBuf {
    let mut path = if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata)
    } else if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home)
    } else {
        PathBuf::from(".")
    };
    path.push("gitlab-desktop");
    let _ = fs::create_dir_all(&path);
    path.push("auth.json");
    path
}

fn read_local_store() -> LocalAuthStore {
    let path = get_local_auth_file();
    if let Ok(content) = fs::read_to_string(path) {
        if let Ok(store) = serde_json::from_str::<LocalAuthStore>(&content) {
            return store;
        }
    }
    LocalAuthStore::default()
}

fn write_local_store(store: &LocalAuthStore) {
    let path = get_local_auth_file();
    if let Ok(content) = serde_json::to_string_pretty(store) {
        let _ = fs::write(path, content);
    }
}

pub fn save_token(token: &str) -> Result<(), AppError> {
    if let Ok(entry) = Entry::new(SERVICE_NAME, TOKEN_KEY) {
        let _ = entry.set_password(token);
    }
    let mut store = read_local_store();
    store.token = Some(token.to_string());
    write_local_store(&store);
    Ok(())
}

pub fn get_token() -> Result<Option<String>, AppError> {
    if let Ok(entry) = Entry::new(SERVICE_NAME, TOKEN_KEY) {
        if let Ok(password) = entry.get_password() {
            if !password.trim().is_empty() {
                return Ok(Some(password));
            }
        }
    }

    let store = read_local_store();
    if let Some(ref t) = store.token {
        if !t.trim().is_empty() {
            return Ok(Some(t.clone()));
        }
    }

    if let Ok(env_token) = std::env::var("VITE_GITLAB_PAT") {
        if !env_token.trim().is_empty() {
            return Ok(Some(env_token));
        }
    }

    Ok(None)
}

pub fn delete_token() -> Result<(), AppError> {
    if let Ok(entry) = Entry::new(SERVICE_NAME, TOKEN_KEY) {
        let _ = entry.delete_credential();
    }
    let mut store = read_local_store();
    store.token = None;
    write_local_store(&store);
    Ok(())
}

pub fn save_server_url(url: &str) -> Result<(), AppError> {
    if let Ok(entry) = Entry::new(SERVICE_NAME, SERVER_URL_KEY) {
        let _ = entry.set_password(url);
    }
    let mut store = read_local_store();
    store.server_url = Some(url.to_string());
    write_local_store(&store);
    Ok(())
}

pub fn get_server_url() -> Result<Option<String>, AppError> {
    if let Ok(entry) = Entry::new(SERVICE_NAME, SERVER_URL_KEY) {
        if let Ok(url) = entry.get_password() {
            if !url.trim().is_empty() {
                return Ok(Some(url));
            }
        }
    }

    let store = read_local_store();
    if let Some(ref u) = store.server_url {
        if !u.trim().is_empty() {
            return Ok(Some(u.clone()));
        }
    }

    Ok(Some("https://gitlab.com".to_string()))
}
