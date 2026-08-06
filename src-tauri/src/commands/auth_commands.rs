use tauri::command;
use tauri_plugin_opener::OpenerExt;
use crate::error::AppError;
use crate::auth::gitlab::{
    GitLabClient, GitLabUser, PkcePair, generate_pkce, exchange_code_for_token,
    listen_for_oauth_callback, DEFAULT_CLIENT_ID, DEFAULT_REDIRECT_URI, LOOPBACK_REDIRECT_URI,
};
use crate::auth::keyring;

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
        return Err(AppError::Validation("Personal Access Token is required".to_string()));
    }

    let client = GitLabClient::new(server_url.clone(), token.clone(), custom_ca_pem)?;
    let user = client.get_current_user().await?;

    keyring::save_token(&token)?;
    keyring::save_server_url(&server_url)?;

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

    let token = exchange_code_for_token(
        &server_url,
        &cid,
        client_secret.as_deref(),
        &code,
        &verifier,
        &red_uri,
    )
    .await?;

    let client = GitLabClient::new(server_url.clone(), token.clone(), None)?;
    let user = client.get_current_user().await?;

    keyring::save_token(&token)?;
    keyring::save_server_url(&server_url)?;

    Ok(user)
}

#[command]
pub async fn get_current_user() -> Result<Option<GitLabUser>, AppError> {
    let token = keyring::get_token()?;
    let server_url = keyring::get_server_url()?.unwrap_or_else(|| "https://gitlab.com".to_string());

    if let Some(tok) = token {
        if !tok.trim().is_empty() {
            let client = GitLabClient::new(server_url, tok, None)?;
            match client.get_current_user().await {
                Ok(user) => Ok(Some(user)),
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
