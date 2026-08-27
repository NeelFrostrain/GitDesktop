use super::provider::{AccountPatch, ProviderAccount, ProviderKind, TokenStatus};
use crate::error::AppError;
use keyring::Entry;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

const KEYRING_SERVICE: &str = "gitlab-desktop-accounts";

#[derive(serde::Serialize, serde::Deserialize, Default, Debug)]
struct AccountsRegistry {
    active_account_id: Option<String>,
    accounts: Vec<ProviderAccount>,
}

#[derive(serde::Serialize, serde::Deserialize, Default, Debug)]
struct TokensStore {
    #[serde(default)]
    tokens: HashMap<String, String>,
}

fn get_app_dir() -> PathBuf {
    let mut path = if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata)
    } else if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        PathBuf::from(home)
    } else {
        PathBuf::from(".")
    };
    path.push("gitlab-desktop");
    let _ = fs::create_dir_all(&path);
    path
}

fn get_accounts_registry_file() -> PathBuf {
    let mut path = get_app_dir();
    path.push("provider_accounts.json");
    path
}

fn get_tokens_store_file() -> PathBuf {
    let mut path = get_app_dir();
    path.push("tokens.json");
    path
}

fn read_registry() -> AccountsRegistry {
    let file = get_accounts_registry_file();
    if let Ok(content) = fs::read_to_string(file) {
        if let Ok(reg) = serde_json::from_str::<AccountsRegistry>(&content) {
            return reg;
        }
    }
    AccountsRegistry::default()
}

fn write_registry(reg: &AccountsRegistry) {
    let file = get_accounts_registry_file();
    if let Ok(content) = serde_json::to_string_pretty(reg) {
        let _ = fs::write(file, content);
    }
}

fn read_tokens_store() -> TokensStore {
    let file = get_tokens_store_file();
    if let Ok(content) = fs::read_to_string(file) {
        if let Ok(store) = serde_json::from_str::<TokensStore>(&content) {
            return store;
        }
    }
    TokensStore::default()
}

fn write_tokens_store(store: &TokensStore) {
    let file = get_tokens_store_file();
    if let Ok(content) = serde_json::to_string_pretty(store) {
        let _ = fs::write(file, content);
    }
}

fn sanitize_keyring_target(id: &str) -> String {
    id.replace(':', "_").replace('@', "_at_")
}

pub fn list_accounts() -> Vec<ProviderAccount> {
    let mut reg = read_registry();
    let now = chrono::Utc::now().timestamp();

    // Migrate from legacy keyring if registry is empty
    if reg.accounts.is_empty() {
        let legacy_accounts = crate::auth::keyring::list_accounts();
        for leg in legacy_accounts {
            let kind = match leg.provider.as_str() {
                "github" => ProviderKind::Github,
                "bitbucket" => ProviderKind::Bitbucket,
                _ => ProviderKind::Gitlab,
            };
            let handle = if leg.username.starts_with('@') {
                leg.username
            } else {
                format!("@{}", leg.username)
            };
            let acc = ProviderAccount {
                id: leg.id.clone(),
                provider: kind,
                instance_url: leg.server_url.clone(),
                handle,
                display_name: if !leg.name.is_empty() {
                    leg.name
                } else {
                    leg.id.clone()
                },
                avatar_url: leg.avatar_url.unwrap_or_default(),
                commit_email: leg.email.unwrap_or_default(),
                is_active: leg.is_active,
                token_status: TokenStatus::Valid,
                scopes: leg.scopes.unwrap_or_default(),
                expires_at: leg.expires_at,
            };
            reg.accounts.push(acc);
            let _ = store_token(&leg.id, &leg.token);
        }
        if let Some(active) = reg.accounts.iter().find(|a| a.is_active) {
            reg.active_account_id = Some(active.id.clone());
        }
        write_registry(&reg);
    }

    let active_id = reg.active_account_id.clone();
    for acc in &mut reg.accounts {
        acc.is_active = active_id.as_deref() == Some(&acc.id);
        if let Some(exp) = acc.expires_at {
            let diff = exp - now;
            if diff <= 0 {
                acc.token_status = TokenStatus::Expired;
            } else if diff < 86400 {
                acc.token_status = TokenStatus::ExpiringSoon;
            } else {
                acc.token_status = TokenStatus::Valid;
            }
        } else {
            acc.token_status = TokenStatus::Valid;
        }
    }

    reg.accounts
}

pub fn save_account(
    mut account: ProviderAccount,
    token: &str,
    refresh_token: Option<&str>,
) -> Result<(), AppError> {
    let mut reg = read_registry();

    // Store secret token in dual persistent stores
    store_token(&account.id, token)?;
    if let Some(ref_tok) = refresh_token {
        store_refresh_token(&account.id, ref_tok)?;
    }

    if reg.accounts.is_empty() || reg.active_account_id.is_none() {
        account.is_active = true;
        reg.active_account_id = Some(account.id.clone());
    }

    if let Some(pos) = reg.accounts.iter().position(|a| a.id == account.id) {
        reg.accounts[pos] = account;
    } else {
        reg.accounts.push(account);
    }

    write_registry(&reg);
    Ok(())
}

pub fn set_active_account(account_id: &str) -> Result<(), AppError> {
    let mut reg = read_registry();
    if reg.accounts.iter().any(|a| a.id == account_id) {
        reg.active_account_id = Some(account_id.to_string());
        for a in &mut reg.accounts {
            a.is_active = a.id == account_id;
        }
        write_registry(&reg);
    }
    Ok(())
}

pub fn update_account(account_id: &str, patch: AccountPatch) -> Result<ProviderAccount, AppError> {
    let mut reg = read_registry();
    if let Some(acc) = reg.accounts.iter_mut().find(|a| a.id == account_id) {
        if let Some(name) = patch.display_name {
            if !name.trim().is_empty() {
                acc.display_name = name.trim().to_string();
            }
        }
        if let Some(email) = patch.commit_email {
            acc.commit_email = email.trim().to_string();
        }
        let updated = acc.clone();
        write_registry(&reg);
        Ok(updated)
    } else {
        Err(AppError::NotFound(format!(
            "Account '{}' not found",
            account_id
        )))
    }
}

pub fn remove_account(account_id: &str) -> Result<(), AppError> {
    let mut reg = read_registry();
    reg.accounts.retain(|a| a.id != account_id);
    if reg.active_account_id.as_deref() == Some(account_id) {
        reg.active_account_id = reg.accounts.first().map(|a| a.id.clone());
    }
    write_registry(&reg);

    // Delete secrets from persistent stores
    let _ = delete_token(account_id);
    let _ = delete_refresh_token(account_id);

    Ok(())
}

pub fn get_token(account_id: &str) -> Result<Option<String>, AppError> {
    // 1. Check local persistent tokens store (fast & 100% reliable)
    let store = read_tokens_store();
    if let Some(token) = store.tokens.get(account_id) {
        if !token.trim().is_empty() {
            return Ok(Some(token.clone()));
        }
    }

    // 2. Check OS keyring with sanitized key
    let sanitized = sanitize_keyring_target(account_id);
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &sanitized) {
        if let Ok(p) = entry.get_password() {
            if !p.trim().is_empty() {
                let _ = store_token(account_id, &p);
                return Ok(Some(p));
            }
        }
    }

    // 3. Check OS keyring with raw account_id
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, account_id) {
        if let Ok(p) = entry.get_password() {
            if !p.trim().is_empty() {
                let _ = store_token(account_id, &p);
                return Ok(Some(p));
            }
        }
    }

    // 4. Check legacy auth::keyring store
    let legacy_accounts = crate::auth::keyring::list_accounts();
    if let Some(leg) = legacy_accounts.iter().find(|a| {
        a.id == account_id
            || account_id.contains(&a.username)
            || account_id.ends_with(&a.id)
            || a.id.contains(account_id)
    }) {
        if !leg.token.trim().is_empty() {
            let _ = store_token(account_id, &leg.token);
            return Ok(Some(leg.token.clone()));
        }
    }

    // 5. Check legacy keyring entry under "gitlab-desktop" service
    if let Ok(entry) = Entry::new("gitlab-desktop", account_id) {
        if let Ok(p) = entry.get_password() {
            if !p.trim().is_empty() {
                let _ = store_token(account_id, &p);
                return Ok(Some(p));
            }
        }
    }

    // 6. Check legacy default gitlab token
    if let Ok(entry) = Entry::new("gitlab-desktop", "gitlab_token") {
        if let Ok(p) = entry.get_password() {
            if !p.trim().is_empty() {
                let _ = store_token(account_id, &p);
                return Ok(Some(p));
            }
        }
    }

    Ok(None)
}

pub fn get_refresh_token(account_id: &str) -> Result<Option<String>, AppError> {
    let key = format!("{}_refresh", account_id);
    let store = read_tokens_store();
    if let Some(token) = store.tokens.get(&key) {
        if !token.trim().is_empty() {
            return Ok(Some(token.clone()));
        }
    }

    let sanitized = sanitize_keyring_target(&key);
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &sanitized) {
        if let Ok(p) = entry.get_password() {
            if !p.trim().is_empty() {
                return Ok(Some(p));
            }
        }
    }

    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &key) {
        if let Ok(p) = entry.get_password() {
            if !p.trim().is_empty() {
                return Ok(Some(p));
            }
        }
    }

    Ok(None)
}

fn store_token(account_id: &str, token: &str) -> Result<(), AppError> {
    // 1. Write to local tokens file
    let mut store = read_tokens_store();
    store.tokens.insert(account_id.to_string(), token.to_string());
    write_tokens_store(&store);

    // 2. Also write to OS keyring (best effort)
    let sanitized = sanitize_keyring_target(account_id);
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &sanitized) {
        let _ = entry.set_password(token);
    }
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, account_id) {
        let _ = entry.set_password(token);
    }

    Ok(())
}

fn store_refresh_token(account_id: &str, token: &str) -> Result<(), AppError> {
    let key = format!("{}_refresh", account_id);
    let mut store = read_tokens_store();
    store.tokens.insert(key.clone(), token.to_string());
    write_tokens_store(&store);

    let sanitized = sanitize_keyring_target(&key);
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &sanitized) {
        let _ = entry.set_password(token);
    }
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &key) {
        let _ = entry.set_password(token);
    }

    Ok(())
}

fn delete_token(account_id: &str) -> Result<(), AppError> {
    let mut store = read_tokens_store();
    store.tokens.remove(account_id);
    write_tokens_store(&store);

    let sanitized = sanitize_keyring_target(account_id);
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &sanitized) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, account_id) {
        let _ = entry.delete_credential();
    }
    Ok(())
}

fn delete_refresh_token(account_id: &str) -> Result<(), AppError> {
    let key = format!("{}_refresh", account_id);
    let mut store = read_tokens_store();
    store.tokens.remove(&key);
    write_tokens_store(&store);

    let sanitized = sanitize_keyring_target(&key);
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &sanitized) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &key) {
        let _ = entry.delete_credential();
    }
    Ok(())
}

