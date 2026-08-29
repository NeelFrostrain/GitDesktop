use crate::auth::github::{GitHubClient, GitHubUser};
use crate::auth::gitlab::{
    exchange_code_for_token_response, generate_pkce, listen_for_oauth_callback,
    refresh_oauth_token, GitLabClient, GitLabUser, PkcePair, TokenInfo, DEFAULT_CLIENT_ID,
    DEFAULT_REDIRECT_URI, LOOPBACK_REDIRECT_URI,
};
use crate::auth::keyring::{self, SavedAccount};
use crate::error::AppError;
use tauri::command;
use tauri_plugin_opener::OpenerExt;

#[command]
pub async fn generate_pkce_cmd() -> Result<PkcePair, AppError> {
    Ok(generate_pkce())
}

#[command]
pub async fn login_gitlab_pat(
    server_url: String,
    token: String,
    custom_ca_pem: Option<String>,
) -> Result<GitLabUser, AppError> {
    if server_url.trim().is_empty() {
        return Err(AppError::Validation("Server URL is required".to_string()));
    }
    if token.trim().is_empty() {
        return Err(AppError::Validation(
            "Personal Access Token is required".to_string(),
        ));
    }

    let client = GitLabClient::new(server_url.clone(), token.clone(), custom_ca_pem)?;
    let user = client.get_current_user().await?;

    let account_id = keyring::make_account_id(&user.username, &server_url);
    let account = SavedAccount {
        id: account_id.clone(),
        server_url: server_url.clone(),
        token: token.clone(),
        name: user.name.clone(),
        username: user.username.clone(),
        email: user.email.clone(),
        avatar_url: user.avatar_url.clone(),
        is_active: true,
        provider: "gitlab".to_string(),
        refresh_token: None,
        expires_at: None,
        scopes: Some(vec!["api".to_string(), "read_user".to_string()]),
        created_at: Some(chrono::Utc::now().timestamp()),
        refresh_token_expires_at: None,
    };
    keyring::add_or_update_account(account)?;
    keyring::switch_active_account(&account_id)?;
    keyring::save_token(&token)?;
    keyring::save_server_url(&server_url)?;

    // Synchronize to domain::accounts::token_store
    let clean_url = server_url.trim_end_matches('/');
    let prov_account_id = format!(
        "gitlab:{}:{}",
        clean_url.replace("https://", "").replace("http://", ""),
        user.id
    );
    let handle = format!("@{}", user.username.trim_start_matches('@'));
    let prov_account = crate::domain::accounts::provider::ProviderAccount {
        id: prov_account_id.clone(),
        provider: crate::domain::accounts::provider::ProviderKind::Gitlab,
        instance_url: clean_url.to_string(),
        handle,
        display_name: user.name.clone(),
        avatar_url: user.avatar_url.clone().unwrap_or_default(),
        commit_email: user.email.clone().unwrap_or_default(),
        is_active: true,
        token_status: crate::domain::accounts::provider::TokenStatus::Valid,
        scopes: vec!["api".to_string(), "read_user".to_string()],
        expires_at: None,
        refresh_token_expires_at: None,
    };
    let _ = crate::domain::accounts::token_store::save_account(prov_account, &token, None);
    let _ = crate::domain::accounts::active_account::set_active_and_sync_git(&prov_account_id, None);

    crate::log_success!(
        crate::core::logging::LogCategory::Account,
        format!("Logged in to GitLab as @{}", user.username);
        meta: serde_json::json!({ "username": user.username, "server_url": server_url })
    );

    Ok(user)
}

#[command]
pub async fn start_oauth_login(
    app: tauri::AppHandle,
    server_url: String,
    challenge: String,
    verifier: String,
    client_id: Option<String>,
    client_secret: Option<String>,
    use_loopback: Option<bool>,
) -> Result<(), AppError> {
    let clean_url = server_url.trim_end_matches('/').to_string();
    let cid = client_id.unwrap_or_else(|| DEFAULT_CLIENT_ID.to_string());
    let loopback = use_loopback.unwrap_or(true);

    let redirect_uri = if loopback {
        LOOPBACK_REDIRECT_URI.to_string()
    } else {
        DEFAULT_REDIRECT_URI.to_string()
    };

    if loopback {
        let app_handle = app.clone();
        let surl = clean_url.clone();
        let client_id_clone = cid.clone();
        let redirect_uri_clone = redirect_uri.clone();

        tokio::spawn(async move {
            let _ = listen_for_oauth_callback(
                surl,
                client_id_clone,
                client_secret,
                verifier,
                redirect_uri_clone,
                app_handle,
            )
            .await;
        });
    }

    let encoded_redirect = urlencoding::encode(&redirect_uri);
    let auth_url = format!(
        "{}/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&scope=api+read_user&code_challenge={}&code_challenge_method=S256",
        clean_url, cid, encoded_redirect, challenge
    );

    app.opener()
        .open_url(auth_url, None::<&str>)
        .map_err(|e| AppError::Network(format!("Failed to open browser: {}", e)))?;

    Ok(())
}

#[command]
pub async fn complete_oauth_login(
    server_url: String,
    code: String,
    verifier: String,
    client_id: Option<String>,
    client_secret: Option<String>,
    redirect_uri: Option<String>,
) -> Result<GitLabUser, AppError> {
    let cid = client_id.unwrap_or_else(|| DEFAULT_CLIENT_ID.to_string());
    let red_uri = redirect_uri.unwrap_or_else(|| DEFAULT_REDIRECT_URI.to_string());

    let token_resp = exchange_code_for_token_response(
        &server_url,
        &cid,
        client_secret.as_deref(),
        &code,
        &verifier,
        &red_uri,
    )
    .await?;

    let client = GitLabClient::new(server_url.clone(), token_resp.access_token.clone(), None)?;
    let user = client.get_current_user().await?;

    let scopes_list = token_resp.scope.as_ref().map(|s| {
        s.split_whitespace()
            .map(|x| x.to_string())
            .collect::<Vec<String>>()
    });

    let expires_at = token_resp
        .expires_in
        .map(|exp| chrono::Utc::now().timestamp() + exp);

    let account_id = keyring::make_account_id(&user.username, &server_url);
    let account = SavedAccount {
        id: account_id.clone(),
        server_url: server_url.clone(),
        token: token_resp.access_token.clone(),
        name: user.name.clone(),
        username: user.username.clone(),
        email: user.email.clone(),
        avatar_url: user.avatar_url.clone(),
        is_active: true,
        provider: "gitlab".to_string(),
        refresh_token: token_resp.refresh_token.clone(),
        expires_at,
        scopes: scopes_list,
        created_at: Some(chrono::Utc::now().timestamp()),
        refresh_token_expires_at: None,
    };
    keyring::add_or_update_account(account)?;
    keyring::switch_active_account(&account_id)?;
    keyring::save_token(&token_resp.access_token)?;
    keyring::save_server_url(&server_url)?;

    crate::log_success!(
        crate::core::logging::LogCategory::Account,
        format!("Completed OAuth sign-in for @{}", user.username);
        meta: serde_json::json!({ "username": user.username, "server_url": server_url })
    );

    Ok(user)
}

#[command]
pub async fn gitlab_ensure_fresh_token(account_id: String) -> Result<String, AppError> {
    let accounts = keyring::list_accounts();
    let account = accounts
        .iter()
        .find(|a| a.id == account_id)
        .ok_or_else(|| AppError::NotFound(format!("Account '{}' not found", account_id)))?;

    // If no expires_at or refresh_token, token is static PAT or does not expire
    let now = chrono::Utc::now().timestamp();
    if let (Some(expires_at), Some(ref refresh_tok)) = (account.expires_at, &account.refresh_token)
    {
        // If token expires in less than 5 minutes (300 seconds), refresh it
        if expires_at - now < 300 {
            let refreshed =
                refresh_oauth_token(&account.server_url, DEFAULT_CLIENT_ID, None, refresh_tok)
                    .await?;

            let new_expires_at = refreshed.expires_in.map(|exp| now + exp);
            let mut updated_account = account.clone();
            updated_account.token = refreshed.access_token.clone();
            if let Some(new_rt) = refreshed.refresh_token {
                updated_account.refresh_token = Some(new_rt);
            }
            updated_account.expires_at = new_expires_at;

            keyring::add_or_update_account(updated_account)?;

            crate::log_info!(
                crate::core::logging::LogCategory::Account,
                format!("Refreshed OAuth access token for account {}", account_id);
                meta: serde_json::json!({ "account_id": account_id })
            );

            return Ok(refreshed.access_token);
        }
    }

    Ok(account.token.clone())
}

#[command]
pub async fn gitlab_get_token_info_cmd(account_id: String) -> Result<TokenInfo, AppError> {
    let accounts = crate::domain::accounts::token_store::list_accounts();
    let account = accounts
        .iter()
        .find(|a| a.id == account_id)
        .ok_or_else(|| AppError::NotFound(format!("Account '{}' not found", account_id)))?;

    let token = crate::domain::accounts::token_store::get_valid_token(&account_id)
        .await?
        .ok_or_else(|| AppError::Auth(format!("No token found for account '{}'", account_id)))?;

    let client = GitLabClient::new(account.instance_url.clone(), token, None)?;
    client.get_token_info().await
}

#[command]
pub async fn get_current_user() -> Result<Option<GitLabUser>, AppError> {
    if let Some(acct) = keyring::get_active_account() {
        if acct.provider == "github" {
            return Ok(None);
        }
    }

    let token = keyring::get_token()?;
    let server_url = keyring::get_server_url()?.unwrap_or_else(|| "https://gitlab.com".to_string());

    if let Some(tok) = token {
        if !tok.trim().is_empty() {
            let client = GitLabClient::new(server_url.clone(), tok.clone(), None)?;
            match client.get_current_user().await {
                Ok(user) => {
                    let account_id = keyring::make_account_id(&user.username, &server_url);
                    let account = SavedAccount {
                        id: account_id,
                        server_url: server_url.clone(),
                        token: tok,
                        name: user.name.clone(),
                        username: user.username.clone(),
                        email: user.email.clone(),
                        avatar_url: user.avatar_url.clone(),
                        is_active: true,
                        provider: "gitlab".to_string(),
                        refresh_token: None,
                        expires_at: None,
                        scopes: None,
                        created_at: None,
                        refresh_token_expires_at: None,
                    };
                    let _ = keyring::add_or_update_account(account);
                    Ok(Some(user))
                }
                Err(_) => Ok(None),
            }
        } else {
            Ok(None)
        }
    } else {
        Ok(None)
    }
}

#[command]
pub async fn logout_gitlab() -> Result<(), AppError> {
    keyring::delete_token()?;
    Ok(())
}

#[command]
pub async fn list_accounts_cmd() -> Result<Vec<keyring::SavedAccount>, AppError> {
    Ok(keyring::list_accounts())
}

#[command]
pub async fn switch_account_cmd(account_id: String) -> Result<Option<GitLabUser>, AppError> {
    keyring::switch_active_account(&account_id)?;

    // Also sync to domain token_store
    let accounts = crate::domain::accounts::token_store::list_accounts();
    if let Some(acc) = accounts.iter().find(|a| {
        a.id == account_id
            || a.handle.trim_start_matches('@') == account_id.split('@').next().unwrap_or("")
            || account_id.contains(&a.handle.trim_start_matches('@').to_string())
    }) {
        let _ = crate::domain::accounts::token_store::set_active_account(&acc.id);
    }

    if let Some(acct) = keyring::get_active_account() {
        if acct.provider == "gitlab" {
            let server_url = acct.server_url.clone();
            let token = acct.token.clone();
            if let Ok(client) = GitLabClient::new(server_url, token, None) {
                if let Ok(user) = client.get_current_user().await {
                    return Ok(Some(user));
                }
            }
        }
    }
    Ok(None)
}

#[command]
pub async fn remove_account_cmd(account_id: String) -> Result<(), AppError> {
    let _ = crate::domain::accounts::token_store::remove_account(&account_id);
    keyring::remove_account(&account_id)
}

#[command]
pub async fn update_account_info_cmd(
    account_id: String,
    name: String,
    email: Option<String>,
) -> Result<(), AppError> {
    keyring::update_account_profile(&account_id, &name, email)
}

#[command]
pub async fn set_repo_account_cmd(repo_path: String, account_id: String) -> Result<(), AppError> {
    keyring::set_account_for_repo(&repo_path, &account_id)
}

/// Login to GitHub using a Personal Access Token
#[command]
pub async fn login_github_pat(token: String) -> Result<GitHubUser, AppError> {
    if token.trim().is_empty() {
        return Err(AppError::Validation(
            "GitHub Personal Access Token is required".to_string(),
        ));
    }

    let client = GitHubClient::new(Some(&token))?;
    let gh_user = client.get_current_user().await?;

    let server_url = "https://github.com".to_string();
    let account_id = keyring::make_account_id(&gh_user.login, &server_url);
    let account = SavedAccount {
        id: account_id.clone(),
        server_url: server_url.clone(),
        token: token.clone(),
        name: gh_user
            .name
            .clone()
            .unwrap_or_else(|| gh_user.login.clone()),
        username: gh_user.login.clone(),
        email: gh_user.email.clone(),
        avatar_url: gh_user.avatar_url.clone(),
        is_active: true,
        provider: "github".to_string(),
        refresh_token: None,
        expires_at: None,
        scopes: Some(vec!["repo".to_string(), "read:user".to_string()]),
        created_at: Some(chrono::Utc::now().timestamp()),
        refresh_token_expires_at: None,
    };
    keyring::add_or_update_account(account)?;
    keyring::switch_active_account(&account_id)?;

    // Synchronize to domain::accounts::token_store
    let clean_url = "https://github.com";
    let prov_account_id = format!("github:{}", gh_user.id);
    let handle = format!("@{}", gh_user.login.trim_start_matches('@'));
    let prov_account = crate::domain::accounts::provider::ProviderAccount {
        id: prov_account_id.clone(),
        provider: crate::domain::accounts::provider::ProviderKind::Github,
        instance_url: clean_url.to_string(),
        handle,
        display_name: gh_user.name.clone().unwrap_or_else(|| gh_user.login.clone()),
        avatar_url: gh_user.avatar_url.clone().unwrap_or_default(),
        commit_email: gh_user.email.clone().unwrap_or_default(),
        is_active: true,
        token_status: crate::domain::accounts::provider::TokenStatus::Valid,
        scopes: vec!["repo".to_string(), "read:user".to_string()],
        expires_at: None,
        refresh_token_expires_at: None,
    };
    let _ = crate::domain::accounts::token_store::save_account(prov_account, &token, None);
    let _ = crate::domain::accounts::active_account::set_active_and_sync_git(&prov_account_id, None);

    crate::log_success!(
        crate::core::logging::LogCategory::Account,
        format!("Logged in to GitHub as @{}", gh_user.login);
        meta: serde_json::json!({ "username": gh_user.login })
    );

    Ok(gh_user)
}

/// Restore GitHub session from saved active account
#[command]
pub async fn get_github_user() -> Result<Option<GitHubUser>, AppError> {
    if let Some(acct) = keyring::get_active_account() {
        if acct.provider == "github" && !acct.token.trim().is_empty() {
            let client = GitHubClient::new(Some(&acct.token))?;
            match client.get_current_user().await {
                Ok(user) => return Ok(Some(user)),
                Err(_) => return Ok(None),
            }
        }
    }
    Ok(None)
}
