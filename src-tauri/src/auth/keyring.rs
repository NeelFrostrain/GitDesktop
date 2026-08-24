use crate::error::AppError;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const SERVICE_NAME: &str = "gitlab-desktop";
const TOKEN_KEY: &str = "gitlab_token";
const SERVER_URL_KEY: &str = "gitlab_server_url";

fn default_provider() -> String {
    "gitlab".to_string()
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SavedAccount {
    pub id: String,
    pub server_url: String,
    pub token: String,
    pub name: String,
    pub username: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    #[serde(default = "default_provider")]
    pub provider: String, // "gitlab" | "github"
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
    pub scopes: Option<Vec<String>>,
    pub created_at: Option<i64>,
}

#[derive(Serialize, Deserialize, Default)]
struct LocalAuthStore {
    token: Option<String>,
    server_url: Option<String>,
    #[serde(default)]
    accounts: Vec<SavedAccount>,
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

pub fn make_account_id(username: &str, server_url: &str) -> String {
    let host = server_url
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_end_matches('/')
        .to_string();
    format!("{}@{}", username, host)
}

pub fn list_accounts() -> Vec<SavedAccount> {
    let mut store = read_local_store();
    if store.accounts.is_empty() {
        if let (Some(token), Some(server_url)) = (store.token.take(), store.server_url.take()) {
            if !token.trim().is_empty() {
                let host = server_url
                    .trim_start_matches("https://")
                    .trim_start_matches("http://")
                    .trim_end_matches('/')
                    .to_string();
                let acct = SavedAccount {
                    id: format!("user@{}", host),
                    server_url,
                    token,
                    name: "GitLab User".to_string(),
                    username: "user".to_string(),
                    email: None,
                    avatar_url: None,
                    is_active: true,
                    provider: "gitlab".to_string(),
                    refresh_token: None,
                    expires_at: None,
                    scopes: None,
                    created_at: None,
                };
                store.accounts.push(acct);
                write_local_store(&store);
            }
        }
    }
    store.accounts
}

pub fn add_or_update_account(account: SavedAccount) -> Result<(), AppError> {
    let mut store = read_local_store();

    // Purge legacy dummy migration entries
    store.accounts.retain(|a| !a.id.starts_with("user@"));

    let should_activate = store.accounts.is_empty() || account.is_active;

    if should_activate {
        for a in store.accounts.iter_mut() {
            a.is_active = false;
        }
    }

    if let Some(existing) = store.accounts.iter_mut().find(|a| a.id == account.id) {
        *existing = SavedAccount {
            is_active: should_activate,
            ..account
        };
    } else {
        store.accounts.push(SavedAccount {
            is_active: should_activate,
            ..account
        });
    }

    write_local_store(&store);
    Ok(())
}

pub fn update_account_profile(
    account_id: &str,
    name: &str,
    email: Option<String>,
) -> Result<(), AppError> {
    let mut store = read_local_store();
    if let Some(acct) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        if !name.trim().is_empty() {
            acct.name = name.trim().to_string();
        }
        acct.email = email
            .map(|e| e.trim().to_string())
            .filter(|e| !e.is_empty());
    }
    write_local_store(&store);
    Ok(())
}

pub fn remove_account(account_id: &str) -> Result<(), AppError> {
    let mut store = read_local_store();
    let was_active = store
        .accounts
        .iter()
        .any(|a| a.id == account_id && a.is_active);
    store.accounts.retain(|a| a.id != account_id);
    if was_active {
        if let Some(first) = store.accounts.first_mut() {
            first.is_active = true;
        }
    }
    write_local_store(&store);
    Ok(())
}

pub fn switch_active_account(account_id: &str) -> Result<(), AppError> {
    let mut store = read_local_store();
    for acct in store.accounts.iter_mut() {
        acct.is_active = acct.id == account_id;
    }
    write_local_store(&store);
    Ok(())
}

pub fn get_active_account() -> Option<SavedAccount> {
    let accounts = list_accounts();
    accounts
        .iter()
        .find(|a| a.is_active)
        .cloned()
        .or_else(|| accounts.into_iter().next())
}

fn get_repo_accounts_file() -> PathBuf {
    let mut path = if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata)
    } else {
        PathBuf::from(".")
    };
    path.push("gitlab-desktop");
    let _ = fs::create_dir_all(&path);
    path.push("repo_accounts.json");
    path
}

#[derive(Serialize, Deserialize, Default)]
struct RepoAccountMap {
    #[serde(default)]
    entries: std::collections::HashMap<String, String>,
}

pub fn get_account_for_repo(repo_path: &str) -> Option<SavedAccount> {
    let path = get_repo_accounts_file();
    if let Ok(content) = fs::read_to_string(path) {
        if let Ok(map) = serde_json::from_str::<RepoAccountMap>(&content) {
            if let Some(account_id) = map.entries.get(repo_path) {
                let accounts = list_accounts();
                if let Some(acct) = accounts.iter().find(|a| &a.id == account_id) {
                    return Some(acct.clone());
                }
            }
        }
    }
    get_active_account()
}

pub fn sync_git_config_for_repo(repo_path: &str) -> Result<(), AppError> {
    if let Some(acct) = get_account_for_repo(repo_path) {
        if let Ok(repo) = git2::Repository::open(repo_path) {
            if let Ok(mut config) = repo.config() {
                let _ = config.set_str("user.name", &acct.name);
                if let Some(ref email) = acct.email {
                    let _ = config.set_str("user.email", email);
                } else {
                    let _ = config.set_str("user.email", &format!("{}@git.local", acct.username));
                }
            }
        }
    }
    Ok(())
}

pub fn set_account_for_repo(repo_path: &str, account_id: &str) -> Result<(), AppError> {
    let file = get_repo_accounts_file();
    let mut map: RepoAccountMap = fs::read_to_string(&file)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default();
    map.entries
        .insert(repo_path.to_string(), account_id.to_string());
    if let Ok(content) = serde_json::to_string_pretty(&map) {
        let _ = fs::write(file, content);
    }
    let _ = sync_git_config_for_repo(repo_path);
    Ok(())
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
    if let Some(acct) = get_active_account() {
        if !acct.token.trim().is_empty() {
            return Ok(Some(acct.token));
        }
    }
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
    if let Some(acct) = get_active_account() {
        return Ok(Some(acct.server_url));
    }
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
