use super::provider::{AccountPatch, AuthProvider, ProviderAccount, ProviderKind, TokenStatus};
use crate::error::AppError;
use keyring::Entry;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, LazyLock, Mutex as StdMutex};
use tokio::sync::Mutex as TokioMutex;

const KEYRING_SERVICE: &str = "git-desktop-accounts";

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

// In-memory short-term debounce cache for recently validated access tokens (5s TTL)
static VALID_TOKEN_CACHE: LazyLock<StdMutex<HashMap<String, (String, i64)>>> =
    LazyLock::new(|| StdMutex::new(HashMap::new()));

const SHORT_CACHE_TTL_SECS: i64 = 5;

fn get_cached_valid_token(account_id: &str, now: i64) -> Option<String> {
    let cache = VALID_TOKEN_CACHE.lock().unwrap();
    if let Some((token, cached_at)) = cache.get(account_id) {
        if now - *cached_at < SHORT_CACHE_TTL_SECS && !token.is_empty() {
            return Some(token.clone());
        }
    }
    None
}

fn set_cached_valid_token(account_id: &str, token: &str, now: i64) {
    let mut cache = VALID_TOKEN_CACHE.lock().unwrap();
    cache.insert(account_id.to_string(), (token.to_string(), now));
}

fn invalidate_cached_token(account_id: &str) {
    let mut cache = VALID_TOKEN_CACHE.lock().unwrap();
    cache.remove(account_id);
}

// Per-account single-flight mutex map to prevent concurrent refresh stampedes
static ACCOUNT_REFRESH_LOCKS: LazyLock<StdMutex<HashMap<String, Arc<TokioMutex<()>>>>> =
    LazyLock::new(|| StdMutex::new(HashMap::new()));

fn get_account_refresh_lock(account_id: &str) -> Arc<TokioMutex<()>> {
    let mut locks = ACCOUNT_REFRESH_LOCKS.lock().unwrap();
    locks
        .entry(account_id.to_string())
        .or_insert_with(|| Arc::new(TokioMutex::new(())))
        .clone()
}

fn get_app_dir() -> PathBuf {
    let path = crate::domain::git_runtime::get_app_data_dir();
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

fn write_registry(reg: &AccountsRegistry) -> Result<(), AppError> {
    let file = get_accounts_registry_file();
    let content = serde_json::to_string_pretty(reg).map_err(|e| {
        crate::log_error!(
            crate::core::logging::LogCategory::Account,
            format!("Failed to serialize accounts registry: {}", e)
        );
        AppError::Unknown(format!("Failed to serialize accounts registry: {}", e))
    })?;
    fs::write(&file, content).map_err(|e| {
        crate::log_error!(
            crate::core::logging::LogCategory::Account,
            format!("Failed to write accounts registry to disk at {}: {}", file.display(), e)
        );
        AppError::Unknown(format!("Failed to write accounts registry: {}", e))
    })?;
    Ok(())
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

fn write_tokens_store(store: &TokensStore) -> Result<(), AppError> {
    let file = get_tokens_store_file();
    let content = serde_json::to_string_pretty(store).map_err(|e| {
        crate::log_error!(
            crate::core::logging::LogCategory::Account,
            format!("Failed to serialize tokens store: {}", e)
        );
        AppError::Unknown(format!("Failed to serialize tokens store: {}", e))
    })?;
    fs::write(&file, content).map_err(|e| {
        crate::log_error!(
            crate::core::logging::LogCategory::Account,
            format!("Failed to write tokens store to disk at {}: {}", file.display(), e)
        );
        AppError::Unknown(format!("Failed to write tokens store: {}", e))
    })?;
    Ok(())
}

fn sanitize_keyring_target(id: &str) -> String {
    id.replace(':', "_").replace('@', "_at_")
}

pub fn list_accounts() -> Vec<ProviderAccount> {
    let mut reg = read_registry();
    let now = chrono::Utc::now().timestamp();

    // Always merge accounts from legacy keyring to ensure full sync between PAT logins and OAuth
    let legacy_accounts = crate::auth::keyring::list_accounts();
    let mut modified = false;

    for leg in legacy_accounts {
        let kind = match leg.provider.as_str() {
            "github" => ProviderKind::Github,
            "bitbucket" => ProviderKind::Bitbucket,
            _ => ProviderKind::Gitlab,
        };
        let handle = if leg.username.starts_with('@') {
            leg.username.clone()
        } else {
            format!("@{}", leg.username)
        };

        if let Some(pos) = reg.accounts.iter().position(|a| a.id == leg.id) {
            let acc = &mut reg.accounts[pos];
            let mut changed = false;

            if acc.instance_url != leg.server_url {
                acc.instance_url = leg.server_url.clone();
                changed = true;
            }
            if acc.handle != handle {
                acc.handle = handle.clone();
                changed = true;
            }
            if !leg.name.is_empty() && acc.display_name != leg.name {
                acc.display_name = leg.name.clone();
                changed = true;
            }
            if let Some(ref avatar) = leg.avatar_url {
                if acc.avatar_url != *avatar {
                    acc.avatar_url = avatar.clone();
                    changed = true;
                }
            }
            if let Some(ref email) = leg.email {
                if acc.commit_email != *email {
                    acc.commit_email = email.clone();
                    changed = true;
                }
            }
            if let Some(ref scopes) = leg.scopes {
                if acc.scopes != *scopes {
                    acc.scopes = scopes.clone();
                    changed = true;
                }
            }
            // Only update expires_at from legacy if acc doesn't have one or legacy is strictly newer
            if let Some(exp) = leg.expires_at {
                if acc.expires_at.is_none() || acc.expires_at < Some(exp) {
                    acc.expires_at = Some(exp);
                    changed = true;
                }
            }
            if leg.is_active && reg.active_account_id.as_deref() != Some(&leg.id) {
                reg.active_account_id = Some(leg.id.clone());
                changed = true;
            }

            if changed {
                modified = true;
            }

            // Only populate tokens from legacy if missing in primary/store
            if let Ok(None) = get_token(&leg.id) {
                if !leg.token.trim().is_empty() {
                    let _ = store_token(&leg.id, &leg.token);
                }
            }
            if let Ok(None) = get_refresh_token(&leg.id) {
                if let Some(ref ref_tok) = leg.refresh_token {
                    if !ref_tok.trim().is_empty() {
                        let _ = store_refresh_token(&leg.id, ref_tok);
                    }
                }
            }
        } else {
            let acc = ProviderAccount {
                id: leg.id.clone(),
                provider: kind,
                instance_url: leg.server_url.clone(),
                handle,
                display_name: if !leg.name.is_empty() {
                    leg.name.clone()
                } else {
                    leg.id.clone()
                },
                avatar_url: leg.avatar_url.unwrap_or_default(),
                commit_email: leg.email.unwrap_or_default(),
                is_active: leg.is_active,
                token_status: TokenStatus::Valid,
                scopes: leg.scopes.unwrap_or_default(),
                expires_at: leg.expires_at,
                refresh_token_expires_at: leg.refresh_token_expires_at,
            };
            reg.accounts.push(acc);
            if !leg.token.trim().is_empty() {
                let _ = store_token(&leg.id, &leg.token);
            }
            if let Some(ref ref_tok) = leg.refresh_token {
                if !ref_tok.trim().is_empty() {
                    let _ = store_refresh_token(&leg.id, ref_tok);
                }
            }
            if leg.is_active {
                reg.active_account_id = Some(leg.id.clone());
            }
            modified = true;
        }
    }

    if reg.active_account_id.is_none() && !reg.accounts.is_empty() {
        reg.active_account_id = Some(reg.accounts[0].id.clone());
        modified = true;
    }

    if modified {
        let _ = write_registry(&reg);
    }

    let active_id = reg.active_account_id.clone();
    for acc in &mut reg.accounts {
        acc.is_active = active_id.as_deref() == Some(&acc.id);
        if acc.token_status == TokenStatus::NeedsReauth {
            continue;
        }
        if let Some(ref_exp) = acc.refresh_token_expires_at {
            if ref_exp - now <= 0 {
                acc.token_status = TokenStatus::NeedsReauth;
                continue;
            }
        }
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
        reg.accounts[pos] = account.clone();
    } else {
        reg.accounts.push(account.clone());
    }

    write_registry(&reg)?;

    // Also sync to legacy keyring store so it stays consistent
    let legacy_acc = crate::auth::keyring::SavedAccount {
        id: account.id.clone(),
        username: account.handle.trim_start_matches('@').to_string(),
        name: account.display_name.clone(),
        email: Some(account.commit_email.clone()),
        server_url: account.instance_url.clone(),
        provider: match account.provider {
            ProviderKind::Github => "github".to_string(),
            ProviderKind::Bitbucket => "bitbucket".to_string(),
            _ => "gitlab".to_string(),
        },
        token: token.to_string(),
        refresh_token: refresh_token.map(|s| s.to_string()),
        expires_at: account.expires_at,
        scopes: Some(account.scopes.clone()),
        avatar_url: Some(account.avatar_url.clone()),
        is_active: account.is_active,
        created_at: Some(chrono::Utc::now().timestamp()),
        refresh_token_expires_at: account.refresh_token_expires_at,
    };
    let _ = crate::auth::keyring::add_or_update_account(legacy_acc);
    invalidate_cached_token(&account.id);

    Ok(())
}

pub fn set_active_account(account_id: &str) -> Result<(), AppError> {
    let mut reg = read_registry();
    if reg.accounts.iter().any(|a| a.id == account_id) {
        reg.active_account_id = Some(account_id.to_string());
        for a in &mut reg.accounts {
            a.is_active = a.id == account_id;
        }
        write_registry(&reg)?;
    }
    // Also sync to legacy keyring store
    let _ = crate::auth::keyring::switch_active_account(account_id);
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
        if let Some(avatar) = patch.avatar_url {
            acc.avatar_url = avatar.trim().to_string();
        }
        let updated = acc.clone();
        write_registry(&reg)?;
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
    let promoted_active = if reg.active_account_id.as_deref() == Some(account_id) {
        reg.active_account_id = reg.accounts.first().map(|a| a.id.clone());
        reg.active_account_id.clone()
    } else {
        None
    };
    write_registry(&reg)?;

    // Delete secrets from persistent stores
    let _ = delete_token(account_id);
    let _ = delete_refresh_token(account_id);
    invalidate_cached_token(account_id);

    // Also remove from legacy keyring
    let _ = crate::auth::keyring::remove_account(account_id);

    // Sync promoted active account to legacy keyring
    if let Some(new_active_id) = promoted_active {
        let _ = crate::auth::keyring::switch_active_account(&new_active_id);
    }

    Ok(())
}

pub fn get_token(account_id: &str) -> Result<Option<String>, AppError> {
    // 1. Primary: OS keyring with sanitized key
    let sanitized = sanitize_keyring_target(account_id);
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &sanitized) {
        if let Ok(p) = entry.get_password() {
            if !p.trim().is_empty() {
                return Ok(Some(p));
            }
        }
    }

    // 2. Primary: OS keyring with raw account_id
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, account_id) {
        if let Ok(p) = entry.get_password() {
            if !p.trim().is_empty() {
                return Ok(Some(p));
            }
        }
    }

    // 3. Check legacy keyring entries under previous service names
    if let Ok(entry) = Entry::new("gitlab-desktop-accounts", account_id) {
        if let Ok(p) = entry.get_password() {
            if !p.trim().is_empty() {
                let _ = store_token(account_id, &p);
                return Ok(Some(p));
            }
        }
    }
    if let Ok(entry) = Entry::new("gitlab-desktop", account_id) {
        if let Ok(p) = entry.get_password() {
            if !p.trim().is_empty() {
                let _ = store_token(account_id, &p);
                return Ok(Some(p));
            }
        }
    }

    // 4. Check legacy auth::keyring store (EXACT MATCH ONLY: a.id == account_id)
    let legacy_accounts = crate::auth::keyring::list_accounts();
    if let Some(leg) = legacy_accounts.iter().find(|a| a.id == account_id) {
        if !leg.token.trim().is_empty() {
            let _ = store_token(account_id, &leg.token);
            return Ok(Some(leg.token.clone()));
        }
    }

    // 5. Fallback: local persistent tokens file store
    let store = read_tokens_store();
    if let Some(token) = store.tokens.get(account_id) {
        if !token.trim().is_empty() {
            return Ok(Some(token.clone()));
        }
    }

    // 6. Check legacy default gitlab token if matching default
    if account_id == "gitlab_token" || account_id == "default" {
        if let Ok(entry) = Entry::new("gitlab-desktop", "gitlab_token") {
            if let Ok(p) = entry.get_password() {
                if !p.trim().is_empty() {
                    let _ = store_token(account_id, &p);
                    return Ok(Some(p));
                }
            }
        }
    }

    Ok(None)
}

pub fn get_refresh_token(account_id: &str) -> Result<Option<String>, AppError> {
    let key = format!("{}_refresh", account_id);
    let sanitized = sanitize_keyring_target(&key);

    // 1. Primary: OS keyring
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

    // 2. Check legacy auth::keyring refresh_token (exact match)
    let legacy_accounts = crate::auth::keyring::list_accounts();
    if let Some(leg) = legacy_accounts.iter().find(|a| a.id == account_id) {
        if let Some(ref ref_tok) = leg.refresh_token {
            if !ref_tok.trim().is_empty() {
                let _ = store_refresh_token(account_id, ref_tok);
                return Ok(Some(ref_tok.clone()));
            }
        }
    }

    // 3. Fallback: file tokens store
    let store = read_tokens_store();
    if let Some(token) = store.tokens.get(&key) {
        if !token.trim().is_empty() {
            return Ok(Some(token.clone()));
        }
    }

    Ok(None)
}

/// Retrieve a valid access token for the account, automatically refreshing it via OAuth if expired or expiring soon.
/// Thread-safe, debounced, and single-flighted per account_id to eliminate race conditions with rotated refresh tokens.
pub async fn get_valid_token(account_id: &str) -> Result<Option<String>, AppError> {
    let now = chrono::Utc::now().timestamp();

    // 1. Short-term in-memory cache check (avoids redundant disk/expiry checks on startup burst)
    if let Some(cached) = get_cached_valid_token(account_id, now) {
        return Ok(Some(cached));
    }

    // 2. Initial fast check against registry metadata without locking
    let accounts = list_accounts();
    let account = accounts.iter().find(|a| a.id == account_id).cloned();

    let account = match account {
        Some(acc) => acc,
        None => return get_token(account_id),
    };

    if account.token_status == TokenStatus::NeedsReauth {
        crate::log_warn!(
            crate::core::logging::LogCategory::Account,
            format!("Account {} requires reauthorization; skipping automated refresh", account_id);
            meta: serde_json::json!({ "account_id": account_id, "status": "needs_reauth" })
        );
        return Ok(None);
    }

    let is_expiring = match account.expires_at {
        Some(exp) => exp - now <= 300, // Refresh if expired or expiring within 5 minutes
        None => false,
    };

    if account.token_status != TokenStatus::Expired
        && account.token_status != TokenStatus::ExpiringSoon
        && !is_expiring
    {
        if let Ok(Some(tok)) = get_token(account_id) {
            set_cached_valid_token(account_id, &tok, now);
            return Ok(Some(tok));
        }
        return Ok(None);
    }

    // 3. Acquire per-account lock to single-flight the refresh process
    let account_lock = get_account_refresh_lock(account_id);
    let is_contested = account_lock.try_lock().is_err();
    if is_contested {
        crate::log_info!(
            crate::core::logging::LogCategory::Account,
            format!("OAuth token refresh already in flight for account {}, awaiting existing operation", account_id);
            meta: serde_json::json!({ "account_id": account_id, "state": "awaiting_in_flight" })
        );
    }
    let _guard = account_lock.lock().await;

    let now_locked = chrono::Utc::now().timestamp();

    // Check in-memory cache again in case another task refreshed it while we waited for the lock
    if let Some(cached) = get_cached_valid_token(account_id, now_locked) {
        crate::log_info!(
            crate::core::logging::LogCategory::Account,
            format!("OAuth token refresh skipped: account {} was already refreshed by another task", account_id);
            meta: serde_json::json!({ "account_id": account_id, "state": "skipped_already_refreshed" })
        );
        return Ok(Some(cached));
    }

    // 4. Double-checked locking: Re-check registry after acquiring the lock
    let accounts = list_accounts();
    let account = match accounts.iter().find(|a| a.id == account_id).cloned() {
        Some(acc) => acc,
        None => return get_token(account_id),
    };

    if account.token_status == TokenStatus::NeedsReauth {
        return Ok(None);
    }

    let is_still_expiring = match account.expires_at {
        Some(exp) => exp - now_locked <= 300,
        None => false,
    };

    if account.token_status == TokenStatus::Valid && !is_still_expiring {
        crate::log_info!(
            crate::core::logging::LogCategory::Account,
            format!("OAuth token refresh skipped: account {} was already refreshed by another task", account_id);
            meta: serde_json::json!({ "account_id": account_id, "state": "skipped_already_refreshed" })
        );
        if let Ok(Some(tok)) = get_token(account_id) {
            set_cached_valid_token(account_id, &tok, now_locked);
            return Ok(Some(tok));
        }
        return Ok(None);
    }

    // 5. Fetch the latest rotated refresh token and perform the single-flight refresh
    if let Ok(Some(ref_tok)) = get_refresh_token(account_id) {
        if !ref_tok.trim().is_empty() {
            crate::log_info!(
                crate::core::logging::LogCategory::Account,
                format!("Starting new OAuth token refresh for account {}", account_id);
                meta: serde_json::json!({ "account_id": account_id, "provider": format!("{:?}", account.provider) })
            );

            let refreshed = match account.provider {
                ProviderKind::Gitlab => {
                    crate::integrations::gitlab::auth::GitLabAuthProvider
                        .refresh_token(&account, &ref_tok)
                        .await
                }
                ProviderKind::Github => {
                    crate::integrations::github::auth::GitHubAuthProvider
                        .refresh_token(&account, &ref_tok)
                        .await
                }
                ProviderKind::Bitbucket => {
                    crate::integrations::bitbucket::auth::BitbucketAuthProvider
                        .refresh_token(&account, &ref_tok)
                        .await
                }
            };

            match refreshed {
                Ok(updated_account) => {
                    crate::log_info!(
                        crate::core::logging::LogCategory::Account,
                        format!("OAuth token refresh completed successfully for account {}", account_id);
                        meta: serde_json::json!({ "account_id": account_id, "expires_at": updated_account.expires_at })
                    );
                    if let Ok(Some(tok)) = get_token(account_id) {
                        set_cached_valid_token(account_id, &tok, now_locked);
                        return Ok(Some(tok));
                    }
                    return Ok(None);
                }
                Err(e) => {
                    let err_str = e.to_string();
                    let is_needs_reauth = err_str.contains("[NEEDS_REAUTH]")
                        || err_str.contains("invalid_grant")
                        || err_str.contains("bad_refresh_token");

                    if is_needs_reauth {
                        crate::log_error!(
                            crate::core::logging::LogCategory::Account,
                            format!("OAuth token refresh failed - needs reauth for account {}: {}", account_id, err_str);
                            meta: serde_json::json!({ "account_id": account_id, "error": err_str, "status": "needs_reauth" })
                        );
                    } else {
                        crate::log_warn!(
                            crate::core::logging::LogCategory::Account,
                            format!("OAuth token refresh failed - transient error for account {}: {}", account_id, err_str);
                            meta: serde_json::json!({ "account_id": account_id, "error": err_str, "status": "transient" })
                        );
                    }

                    // Defensive check: only mark Expired / NeedsReauth if account was not refreshed in the meantime
                    let mut reg = read_registry();
                    if let Some(acc) = reg.accounts.iter_mut().find(|a| a.id == account_id) {
                        let is_now_valid = match acc.expires_at {
                            Some(exp) => exp - now_locked > 300,
                            None => false,
                        };
                        if !is_now_valid {
                            if is_needs_reauth {
                                acc.token_status = TokenStatus::NeedsReauth;
                            } else {
                                acc.token_status = TokenStatus::Expired;
                            }
                            let _ = write_registry(&reg);
                        } else {
                            crate::log_warn!(
                                crate::core::logging::LogCategory::Account,
                                format!("Suppressed updating account {} token status because a newer valid expiration timestamp exists", account_id);
                                meta: serde_json::json!({ "account_id": account_id, "expires_at": acc.expires_at })
                            );
                        }
                    }
                }
            }
        }
    }

    let fallback = get_token(account_id)?;
    if let Some(ref tok) = fallback {
        set_cached_valid_token(account_id, tok, now_locked);
    }
    Ok(fallback)
}

fn store_token(account_id: &str, token: &str) -> Result<(), AppError> {
    // 1. Primary: OS Keyring
    let sanitized = sanitize_keyring_target(account_id);
    let mut keyring_ok = false;
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &sanitized) {
        if entry.set_password(token).is_ok() {
            keyring_ok = true;
        }
    }
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, account_id) {
        if entry.set_password(token).is_ok() {
            keyring_ok = true;
        }
    }

    if !keyring_ok {
        crate::log_debug!(
            crate::core::logging::LogCategory::Account,
            format!("OS Keyring set_password not available or failed for account {}; fallback to file store", account_id)
        );
    }

    // 2. Secondary: local tokens file
    let mut store = read_tokens_store();
    store.tokens.insert(account_id.to_string(), token.to_string());
    write_tokens_store(&store)?;

    Ok(())
}

fn store_refresh_token(account_id: &str, token: &str) -> Result<(), AppError> {
    let key = format!("{}_refresh", account_id);
    let sanitized = sanitize_keyring_target(&key);

    // 1. Primary: OS Keyring
    let mut keyring_ok = false;
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &sanitized) {
        if entry.set_password(token).is_ok() {
            keyring_ok = true;
        }
    }
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &key) {
        if entry.set_password(token).is_ok() {
            keyring_ok = true;
        }
    }

    if !keyring_ok {
        crate::log_debug!(
            crate::core::logging::LogCategory::Account,
            format!("OS Keyring set_password not available for refresh token of account {}; fallback to file store", account_id)
        );
    }

    // 2. Secondary: local tokens file
    let mut store = read_tokens_store();
    store.tokens.insert(key.clone(), token.to_string());
    write_tokens_store(&store)?;

    Ok(())
}

fn delete_token(account_id: &str) -> Result<(), AppError> {
    // 1. Delete from OS keyring
    let sanitized = sanitize_keyring_target(account_id);
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &sanitized) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, account_id) {
        let _ = entry.delete_credential();
    }

    // 2. Delete from file
    let mut store = read_tokens_store();
    store.tokens.remove(account_id);
    write_tokens_store(&store)?;

    Ok(())
}

fn delete_refresh_token(account_id: &str) -> Result<(), AppError> {
    let key = format!("{}_refresh", account_id);
    let sanitized = sanitize_keyring_target(&key);
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &sanitized) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, &key) {
        let _ = entry.delete_credential();
    }

    let mut store = read_tokens_store();
    store.tokens.remove(&key);
    write_tokens_store(&store)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_single_flight_per_account_lock() {
        let account_id = "test:concurrency:account_mock_1";

        let account = ProviderAccount {
            id: account_id.to_string(),
            provider: ProviderKind::Github,
            instance_url: "https://github.com".to_string(),
            handle: "@concurrency_user".to_string(),
            display_name: "Concurrency Test User".to_string(),
            avatar_url: "".to_string(),
            commit_email: "test@example.com".to_string(),
            is_active: true,
            token_status: TokenStatus::Valid,
            scopes: vec!["repo".to_string()],
            expires_at: Some(chrono::Utc::now().timestamp() + 3600),
            refresh_token_expires_at: None,
        };

        save_account(account, "token_12345", Some("refresh_12345")).unwrap();

        // 20 concurrent calls to get_valid_token for the same account
        let mut handles = Vec::new();
        for _ in 0..20 {
            let aid = account_id.to_string();
            handles.push(tokio::spawn(async move {
                get_valid_token(&aid).await
            }));
        }

        for handle in handles {
            let token_res = handle.await.expect("Task join should succeed");
            let token = token_res.expect("Token lookup should succeed");
            assert_eq!(token, Some("token_12345".to_string()));
        }
    }
}


