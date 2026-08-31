use crate::core::config;
use crate::domain::accounts::oauth_pkce;
use crate::domain::accounts::provider::{AuthProvider, ProviderAccount, ProviderKind, TokenStatus};
use crate::error::AppError;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use serde::Deserialize;

pub const BITBUCKET_DEFAULT_REDIRECT_URI: &str = "http://127.0.0.1:8585/oauth/callback";

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct BitbucketTokenResponse {
    access_token: String,
    #[serde(default)]
    token_type: String,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
    scopes: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize, Default)]
struct BitbucketAvatarLink {
    href: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize, Default)]
struct BitbucketLinks {
    avatar: Option<BitbucketAvatarLink>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct BitbucketUserResponse {
    #[serde(default)]
    uuid: String,
    username: Option<String>,
    nickname: Option<String>,
    account_id: Option<String>,
    display_name: Option<String>,
    links: Option<BitbucketLinks>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct BitbucketEmailEntry {
    email: String,
    is_primary: Option<bool>,
    is_confirmed: Option<bool>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct BitbucketEmailsResponse {
    values: Option<Vec<BitbucketEmailEntry>>,
}

pub struct BitbucketAuthProvider;

impl BitbucketAuthProvider {
    pub fn get_client_id(&self) -> Result<String, AppError> {
        let id = config::get_env_var("VITE_BITBUCKET_CLIENT_ID").unwrap_or_default();
        if id.trim().is_empty() {
            return Err(AppError::Auth(
                "Bitbucket OAuth Client ID is missing. Please set VITE_BITBUCKET_CLIENT_ID in your .env file."
                    .to_string(),
            ));
        }
        Ok(id.trim().to_string())
    }

    pub fn get_client_secret(&self) -> Result<String, AppError> {
        let secret = config::get_env_var("VITE_BITBUCKET_CLIENT_SECRET").unwrap_or_default();
        if secret.trim().is_empty() {
            return Err(AppError::Auth(
                "Bitbucket OAuth Client Secret is missing. Please set VITE_BITBUCKET_CLIENT_SECRET in your .env file."
                    .to_string(),
            ));
        }
        Ok(secret.trim().to_string())
    }

    pub fn get_redirect_uri(&self) -> String {
        config::get_env_var("VITE_BITBUCKET_REDIRECT_URI")
            .unwrap_or_else(|| BITBUCKET_DEFAULT_REDIRECT_URI.to_string())
    }
}

impl AuthProvider for BitbucketAuthProvider {
    fn provider_kind(&self) -> ProviderKind {
        ProviderKind::Bitbucket
    }

    fn default_instance_url(&self) -> &'static str {
        "https://bitbucket.org"
    }

    fn start_oauth(&self, instance_url: &str) -> Result<String, AppError> {
        let clean_url = instance_url.trim_end_matches('/');
        let client_id = self.get_client_id()?;
        let redirect_uri = self.get_redirect_uri();

        let (state, _challenge, _verifier) =
            oauth_pkce::generate_pkce_session("bitbucket", clean_url, &redirect_uri);

        let auth_url = format!(
            "{}/site/oauth2/authorize?client_id={}&response_type=code&state={}&redirect_uri={}",
            clean_url,
            urlencoding::encode(&client_id),
            urlencoding::encode(&state),
            urlencoding::encode(&redirect_uri),
        );

        Ok(auth_url)
    }

    async fn exchange_code(
        &self,
        instance_url: &str,
        code: &str,
        code_verifier: &str,
    ) -> Result<ProviderAccount, AppError> {
        self.exchange_code_with_redirect(instance_url, code, code_verifier, None)
            .await
    }

    async fn refresh_token(
        &self,
        account: &ProviderAccount,
        refresh_token: &str,
    ) -> Result<ProviderAccount, AppError> {
        let clean_url = account.instance_url.trim_end_matches('/');
        let token_url = format!("{}/site/oauth2/access_token", clean_url);

        let client_id = self.get_client_id()?;
        let client_secret = self.get_client_secret()?;

        let mut headers = HeaderMap::new();
        headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
        headers.insert(USER_AGENT, HeaderValue::from_static("git-desktop"));

        let auth_str = format!("{}:{}", client_id, client_secret);
        let encoded = STANDARD.encode(auth_str.as_bytes());
        if let Ok(val) = HeaderValue::from_str(&format!("Basic {}", encoded)) {
            headers.insert(AUTHORIZATION, val);
        }

        let params = [
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
        ];

        let client = reqwest::Client::new();
        let resp = client
            .post(&token_url)
            .headers(headers)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("Bitbucket token refresh failed: {}", e)))?;

        let body_text = resp
            .text()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to read Bitbucket refresh response: {}", e)))?;

        let token_data: BitbucketTokenResponse = serde_json::from_str(&body_text).map_err(|e| {
            AppError::Auth(format!(
                "Failed to parse Bitbucket refresh response ({}): {}",
                e, body_text
            ))
        })?;

        let now = chrono::Utc::now().timestamp();
        let expires_at = token_data.expires_in.map(|exp| now + exp);

        let mut updated = account.clone();
        updated.expires_at = expires_at;
        updated.token_status = TokenStatus::Valid;

        crate::domain::accounts::token_store::save_account(
            updated.clone(),
            &token_data.access_token,
            token_data.refresh_token.as_deref(),
        )?;

        Ok(updated)
    }

    async fn revoke_token(&self, _account: &ProviderAccount) -> Result<(), AppError> {
        Ok(())
    }
}

impl BitbucketAuthProvider {
    pub async fn exchange_code_with_redirect(
        &self,
        instance_url: &str,
        code: &str,
        _code_verifier: &str,
        _redirect_uri_override: Option<&str>,
    ) -> Result<ProviderAccount, AppError> {
        let clean_url = instance_url.trim_end_matches('/');
        let token_url = format!("{}/site/oauth2/access_token", clean_url);

        let client_id = self.get_client_id()?;
        let client_secret = self.get_client_secret()?;

        let mut headers = HeaderMap::new();
        headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
        headers.insert(USER_AGENT, HeaderValue::from_static("git-desktop"));

        let auth_str = format!("{}:{}", client_id, client_secret);
        let encoded = STANDARD.encode(auth_str.as_bytes());
        let basic_auth_val = HeaderValue::from_str(&format!("Basic {}", encoded))
            .map_err(|e| AppError::Auth(format!("Invalid Basic Auth header: {}", e)))?;
        headers.insert(AUTHORIZATION, basic_auth_val);

        let redirect_uri = _redirect_uri_override
            .map(|s| s.to_string())
            .unwrap_or_else(|| self.get_redirect_uri());

        let params = [
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", &redirect_uri),
        ];

        let client = reqwest::Client::new();
        let resp = client
            .post(&token_url)
            .headers(headers)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("Bitbucket token exchange failed: {}", e)))?;

        let status = resp.status();
        let body_text = resp
            .text()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to read Bitbucket token response: {}", e)))?;

        // Check if Bitbucket returned an OAuth error payload
        if !status.is_success() {
            if let Ok(err_json) = serde_json::from_str::<serde_json::Value>(&body_text) {
                if let Some(err_code) = err_json.get("error").and_then(|v| v.as_str()) {
                    let desc = err_json
                        .get("error_description")
                        .and_then(|v| v.as_str())
                        .unwrap_or(err_code);
                    return Err(AppError::Auth(format!("Bitbucket OAuth error: {}", desc)));
                }
            }
            return Err(AppError::Auth(format!(
                "Bitbucket token exchange returned HTTP {}: {}",
                status, body_text
            )));
        }

        let token_data: BitbucketTokenResponse = serde_json::from_str(&body_text).map_err(|e| {
            AppError::Auth(format!(
                "Failed to parse Bitbucket token response ({}): {}",
                e, body_text
            ))
        })?;

        // Fetch user profile from Bitbucket API
        let api_base = "https://api.bitbucket.org/2.0";
        let mut user_headers = HeaderMap::new();
        user_headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", token_data.access_token))
                .map_err(|e| AppError::Auth(e.to_string()))?,
        );
        user_headers.insert(USER_AGENT, HeaderValue::from_static("git-desktop"));

        let user_resp = client
            .get(format!("{}/user", api_base))
            .headers(user_headers.clone())
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to fetch Bitbucket profile: {}", e)))?;

        let user_status = user_resp.status();
        let user_body = user_resp
            .text()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to read Bitbucket user profile: {}", e)))?;

        if !user_status.is_success() {
            return Err(AppError::Auth(format!(
                "Bitbucket user API returned HTTP {}: {}",
                user_status, user_body
            )));
        }

        let user_data: BitbucketUserResponse = serde_json::from_str(&user_body).map_err(|e| {
            AppError::Auth(format!(
                "Failed to parse Bitbucket user profile ({}): {}",
                e, user_body
            ))
        })?;

        // Fetch user primary email
        let mut user_email = String::new();
        if let Ok(emails_resp) = client
            .get(format!("{}/user/emails", api_base))
            .headers(user_headers)
            .send()
            .await
        {
            if let Ok(emails_data) = emails_resp.json::<BitbucketEmailsResponse>().await {
                if let Some(entries) = emails_data.values {
                    if let Some(primary) = entries
                        .iter()
                        .find(|e| e.is_primary == Some(true) && e.is_confirmed == Some(true))
                        .or_else(|| entries.iter().find(|e| e.is_primary == Some(true)))
                        .or_else(|| entries.first())
                    {
                        user_email = primary.email.clone();
                    }
                }
            }
        }

        let raw_handle = user_data
            .username
            .or(user_data.nickname)
            .or_else(|| user_data.account_id.clone())
            .unwrap_or_else(|| {
                let u = user_data.uuid.replace(['{', '}'], "");
                if u.is_empty() {
                    "bitbucket_user".to_string()
                } else {
                    u
                }
            });

        let handle = format!("@{}", raw_handle.trim_start_matches('@'));
        let display_name = user_data.display_name.unwrap_or_else(|| handle.clone());
        let avatar_url = user_data
            .links
            .and_then(|l| l.avatar)
            .and_then(|a| a.href)
            .unwrap_or_default();

        let clean_uuid = if !user_data.uuid.is_empty() {
            user_data.uuid.replace(['{', '}'], "")
        } else {
            raw_handle.clone()
        };
        let account_id = format!("bitbucket:bitbucket.org:{}", clean_uuid);

        let now = chrono::Utc::now().timestamp();
        let expires_at = token_data.expires_in.map(|exp| now + exp);

        let scopes_vec = token_data
            .scopes
            .map(|s| s.split_whitespace().map(|x| x.to_string()).collect())
            .unwrap_or_else(|| vec!["account".to_string(), "repository".to_string()]);

        let account = ProviderAccount {
            id: account_id.clone(),
            provider: ProviderKind::Bitbucket,
            instance_url: clean_url.to_string(),
            handle,
            display_name,
            avatar_url,
            commit_email: user_email,
            is_active: true,
            token_status: TokenStatus::Valid,
            scopes: scopes_vec,
            expires_at,
            refresh_token_expires_at: None,
        };

        crate::domain::accounts::token_store::save_account(
            account.clone(),
            &token_data.access_token,
            token_data.refresh_token.as_deref(),
        )?;

        let _ = crate::domain::accounts::active_account::set_active_and_sync_git(&account.id, None);

        Ok(account)
    }
}
