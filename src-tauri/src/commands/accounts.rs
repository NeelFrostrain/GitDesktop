use tauri::command;
use tauri_plugin_opener::OpenerExt;
use crate::error::AppError;
use crate::domain::accounts::provider::{ProviderAccount, ProviderKind, AccountPatch, AuthProvider};
use crate::domain::accounts::token_store;
use crate::domain::accounts::active_account;
use crate::integrations::gitlab::auth::GitLabAuthProvider;
use crate::integrations::github::auth::GitHubAuthProvider;

#[command]
pub async fn accounts_list() -> Result<Vec<ProviderAccount>, AppError> {
    tokio::task::spawn_blocking(token_store::list_accounts)
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))
}

#[command]
pub async fn accounts_set_active(
    account_id: String,
    active_repo_path: Option<String>,
) -> Result<(), AppError> {
    let aid = account_id.clone();
    let repo_path = active_repo_path.clone();
    tokio::task::spawn_blocking(move || {
        active_account::set_active_and_sync_git(&aid, repo_path.as_deref())
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_info!(
        crate::core::logging::LogCategory::Account,
        format!("Switched active account to {}", account_id);
        repo_id: active_repo_path,
        meta: serde_json::json!({ "account_id": account_id })
    );

    Ok(())
}

#[command]
pub async fn accounts_update(
    account_id: String,
    patch: AccountPatch,
) -> Result<ProviderAccount, AppError> {
    let aid = account_id.clone();
    let res = tokio::task::spawn_blocking(move || token_store::update_account(&aid, patch))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_info!(
        crate::core::logging::LogCategory::Account,
        format!("Updated account settings for {}", res.handle);
        meta: serde_json::json!({ "account_id": account_id, "handle": res.handle })
    );

    Ok(res)
}

#[command]
pub async fn accounts_remove(account_id: String) -> Result<(), AppError> {
    let aid = account_id.clone();
    tokio::task::spawn_blocking(move || {
        let accounts = token_store::list_accounts();
        if let Some(acc) = accounts.iter().find(|a| a.id == aid) {
            // Revoke on remote where supported
            match acc.provider {
                ProviderKind::Gitlab => {
                    let provider = GitLabAuthProvider;
                    let _ = tokio::runtime::Handle::current().block_on(provider.revoke_token(acc));
                }
                ProviderKind::Github => {
                    let provider = GitHubAuthProvider;
                    let _ = tokio::runtime::Handle::current().block_on(provider.revoke_token(acc));
                }
            }
        }
        token_store::remove_account(&aid)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_info!(
        crate::core::logging::LogCategory::Account,
        format!("Removed account {}", account_id);
        meta: serde_json::json!({ "account_id": account_id })
    );

    Ok(())
}

#[command]
pub async fn accounts_start_oauth(
    app: tauri::AppHandle,
    provider: String,
    instance_url: Option<String>,
) -> Result<(), AppError> {
    let url = match provider.to_lowercase().as_str() {
        "gitlab" => {
            let p = GitLabAuthProvider;
            let target = instance_url.clone().unwrap_or_else(|| p.default_instance_url().to_string());
            p.start_oauth(&target)?
        }
        "github" => {
            let p = GitHubAuthProvider;
            let target = instance_url.clone().unwrap_or_else(|| p.default_instance_url().to_string());
            p.start_oauth(&target)?
        }
        _ => return Err(AppError::Validation(format!("Unsupported provider '{}'", provider))),
    };

    crate::log_info!(
        crate::core::logging::LogCategory::Account,
        format!("Started OAuth sign-in for {}", provider);
        meta: serde_json::json!({ "provider": provider, "instance_url": instance_url })
    );

    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| AppError::Unknown(format!("Failed to open system browser: {}", e)))?;

    Ok(())
}
