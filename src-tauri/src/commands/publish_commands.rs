use base64::{engine::general_purpose::STANDARD, Engine as _};
use crate::domain::accounts::provider::ProviderKind;
use crate::domain::accounts::token_store;
use crate::error::AppError;
use crate::git::command::silent_git_command;
use crate::git::remote::remote::{add_remote, push_to_remote, set_remote_url};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::command;

async fn bitbucket_get(
    client: &reqwest::Client,
    url: &str,
    token: &str,
    clean_handle: &str,
) -> Result<serde_json::Value, AppError> {
    // 1. Try Bearer auth
    let res = client
        .get(url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/json")
        .send()
        .await;

    if let Ok(r) = res {
        if r.status().is_success() {
            if let Ok(val) = r.json::<serde_json::Value>().await {
                return Ok(val);
            }
        }
    }

    // 2. Try Basic auth (for App Passwords)
    let auth_str = format!("{}:{}", clean_handle, token);
    let encoded = STANDARD.encode(auth_str.as_bytes());
    let res_basic = client
        .get(url)
        .header("Authorization", format!("Basic {}", encoded))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;

    if res_basic.status().is_success() {
        let val = res_basic
            .json::<serde_json::Value>()
            .await
            .map_err(|e| AppError::Unknown(e.to_string()))?;
        return Ok(val);
    }

    let err = res_basic.text().await.unwrap_or_default();
    Err(AppError::Auth(format!("Bitbucket request failed: {}", err)))
}

async fn bitbucket_post_repo(
    client: &reqwest::Client,
    url: &str,
    token: &str,
    clean_handle: &str,
    payload: &serde_json::Value,
) -> Result<serde_json::Value, AppError> {
    // 1. Try Bearer auth
    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .json(payload)
        .send()
        .await;

    if let Ok(r) = res {
        if r.status().is_success() {
            return r
                .json::<serde_json::Value>()
                .await
                .map_err(|e| AppError::Unknown(e.to_string()));
        }
        let status = r.status();
        let body = r.text().await.unwrap_or_default();
        if status.as_u16() != 401 {
            let msg = serde_json::from_str::<serde_json::Value>(&body)
                .ok()
                .and_then(|v| {
                    v["error"]["message"]
                        .as_str()
                        .map(|s| s.to_string())
                        .or_else(|| v["message"].as_str().map(|s| s.to_string()))
                })
                .unwrap_or(body);
            return Err(AppError::Git(format!("Bitbucket repository creation failed: {}", msg)));
        }
    }

    // 2. Try Basic auth (App Password)
    let auth_str = format!("{}:{}", clean_handle, token);
    let encoded = STANDARD.encode(auth_str.as_bytes());
    let res_basic = client
        .post(url)
        .header("Authorization", format!("Basic {}", encoded))
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .json(payload)
        .send()
        .await
        .map_err(|e| AppError::Network(format!("Failed to connect to Bitbucket: {}", e)))?;

    if res_basic.status().is_success() {
        return res_basic
            .json::<serde_json::Value>()
            .await
            .map_err(|e| AppError::Unknown(e.to_string()));
    }

    let err = res_basic.text().await.unwrap_or_default();
    let msg = serde_json::from_str::<serde_json::Value>(&err)
        .ok()
        .and_then(|v| {
            v["error"]["message"]
                .as_str()
                .map(|s| s.to_string())
                .or_else(|| v["message"].as_str().map(|s| s.to_string()))
        })
        .unwrap_or(err);
    Err(AppError::Git(format!("Bitbucket repository creation failed: {}", msg)))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NamespaceOption {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub kind: String, // "personal" | "org" | "group" | "workspace"
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PublishResult {
    pub remote_url: String,
    pub web_url: String,
    pub branch: String,
}

#[command]
pub async fn accounts_list_namespaces(account_id: String) -> Result<Vec<NamespaceOption>, AppError> {
    let accounts = token_store::list_accounts();
    let account = accounts
        .into_iter()
        .find(|a| a.id == account_id)
        .ok_or_else(|| AppError::NotFound(format!("Account '{}' not found", account_id)))?;

    let token = token_store::get_valid_token(&account_id)
        .await?
        .ok_or_else(|| AppError::Auth(format!("No token found for account '{}'", account_id)))?;

    let client = reqwest::Client::builder()
        .user_agent("GitDesktop/0.1.0")
        .build()
        .map_err(|e| AppError::Network(e.to_string()))?;

    let clean_handle = account.handle.trim_start_matches('@').to_string();

    match account.provider {
        ProviderKind::Github => {
            let mut namespaces = vec![NamespaceOption {
                id: "personal".to_string(),
                name: format!("None (personal: {})", clean_handle),
                description: Some("Publish to your personal GitHub account".to_string()),
                kind: "personal".to_string(),
                avatar_url: if !account.avatar_url.is_empty() {
                    Some(account.avatar_url.clone())
                } else {
                    None
                },
            }];

            let resp = client
                .get("https://api.github.com/user/orgs")
                .header("Authorization", format!("Bearer {}", token))
                .header("Accept", "application/vnd.github.v3+json")
                .send()
                .await;

            if let Ok(res) = resp {
                if res.status().is_success() {
                    if let Ok(orgs) = res.json::<Vec<serde_json::Value>>().await {
                        for org in orgs {
                            if let Some(login) = org["login"].as_str() {
                                namespaces.push(NamespaceOption {
                                    id: login.to_string(),
                                    name: login.to_string(),
                                    description: org["description"].as_str().map(|s| s.to_string()),
                                    kind: "org".to_string(),
                                    avatar_url: org["avatar_url"].as_str().map(|s| s.to_string()),
                                });
                            }
                        }
                    }
                }
            }

            Ok(namespaces)
        }

        ProviderKind::Gitlab => {
            let mut namespaces = vec![NamespaceOption {
                id: "personal".to_string(),
                name: format!("Personal ({})", clean_handle),
                description: Some("Publish to your personal GitLab namespace".to_string()),
                kind: "personal".to_string(),
                avatar_url: if !account.avatar_url.is_empty() {
                    Some(account.avatar_url.clone())
                } else {
                    None
                },
            }];

            let base = account.instance_url.trim_end_matches('/');
            let groups_url = format!("{}/api/v4/groups?min_access_level=30&per_page=100", base);

            let resp = client
                .get(&groups_url)
                .header("Authorization", format!("Bearer {}", token))
                .send()
                .await;

            if let Ok(res) = resp {
                if res.status().is_success() {
                    if let Ok(groups) = res.json::<Vec<serde_json::Value>>().await {
                        for grp in groups {
                            let gid = if let Some(id_num) = grp["id"].as_i64() {
                                id_num.to_string()
                            } else {
                                continue;
                            };
                            let name = grp["full_name"]
                                .as_str()
                                .or_else(|| grp["name"].as_str())
                                .unwrap_or("Group")
                                .to_string();

                            namespaces.push(NamespaceOption {
                                id: gid,
                                name,
                                description: grp["description"].as_str().map(|s| s.to_string()),
                                kind: "group".to_string(),
                                avatar_url: grp["avatar_url"].as_str().map(|s| s.to_string()),
                            });
                        }
                    }
                }
            }

            Ok(namespaces)
        }

        ProviderKind::Bitbucket => {
            let mut namespaces = Vec::new();

            if let Ok(val) = bitbucket_get(
                &client,
                "https://api.bitbucket.org/2.0/workspaces?pagelen=100",
                &token,
                &clean_handle,
            )
            .await
            {
                if let Some(values) = val["values"].as_array() {
                    for ws in values {
                        if let Some(slug) = ws["slug"].as_str() {
                            let name = ws["name"].as_str().unwrap_or(slug).to_string();
                            let avatar = ws["links"]["avatar"]["href"]
                                .as_str()
                                .map(|s| s.to_string());

                            namespaces.push(NamespaceOption {
                                id: slug.to_string(),
                                name: format!("{} ({})", name, slug),
                                description: None,
                                kind: "workspace".to_string(),
                                avatar_url: avatar,
                            });
                        }
                    }
                }
            }

            if namespaces.is_empty() {
                if let Ok(val) = bitbucket_get(
                    &client,
                    "https://api.bitbucket.org/2.0/user/permissions/workspaces?pagelen=100",
                    &token,
                    &clean_handle,
                )
                .await
                {
                    if let Some(values) = val["values"].as_array() {
                        for item in values {
                            let ws = &item["workspace"];
                            if let Some(slug) = ws["slug"].as_str() {
                                let name = ws["name"].as_str().unwrap_or(slug).to_string();
                                let avatar = ws["links"]["avatar"]["href"]
                                    .as_str()
                                    .map(|s| s.to_string());

                                namespaces.push(NamespaceOption {
                                    id: slug.to_string(),
                                    name: format!("{} ({})", name, slug),
                                    description: None,
                                    kind: "workspace".to_string(),
                                    avatar_url: avatar,
                                });
                            }
                        }
                    }
                }
            }

            if namespaces.is_empty() {
                namespaces.push(NamespaceOption {
                    id: clean_handle.clone(),
                    name: format!("Personal ({})", clean_handle),
                    description: Some("Default workspace".to_string()),
                    kind: "workspace".to_string(),
                    avatar_url: if !account.avatar_url.is_empty() {
                        Some(account.avatar_url.clone())
                    } else {
                        None
                    },
                });
            }

            Ok(namespaces)
        }
    }
}

#[command]
pub async fn repo_publish(
    repo_path: String,
    account_id: String,
    name: String,
    description: Option<String>,
    is_private: bool,
    namespace_id: Option<String>,
) -> Result<PublishResult, AppError> {
    let clean_name = name.trim().to_string();
    if clean_name.is_empty() {
        return Err(AppError::Validation("Repository name cannot be empty".to_string()));
    }

    let accounts = token_store::list_accounts();
    let account = accounts
        .into_iter()
        .find(|a| a.id == account_id)
        .ok_or_else(|| AppError::NotFound(format!("Account '{}' not found", account_id)))?;

    let token = token_store::get_valid_token(&account_id)
        .await?
        .ok_or_else(|| AppError::Auth(format!("No token found for account '{}'", account_id)))?;

    let client = reqwest::Client::builder()
        .user_agent("GitDesktop/0.1.0")
        .build()
        .map_err(|e| AppError::Network(e.to_string()))?;

    let clean_handle = account.handle.trim_start_matches('@').to_string();

    let (clone_url, web_url) = match account.provider {
        ProviderKind::Github => {
            let is_org = namespace_id.as_deref().is_some() && namespace_id.as_deref() != Some("personal");
            let url = if is_org {
                format!(
                    "https://api.github.com/orgs/{}/repos",
                    namespace_id.as_deref().unwrap()
                )
            } else {
                "https://api.github.com/user/repos".to_string()
            };

            let payload = json!({
                "name": clean_name,
                "description": description.clone().unwrap_or_default(),
                "private": is_private,
                "auto_init": false
            });

            let res = client
                .post(&url)
                .header("Authorization", format!("Bearer {}", token))
                .header("Accept", "application/vnd.github.v3+json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| AppError::Network(format!("Failed to connect to GitHub: {}", e)))?;

            if !res.status().is_success() {
                let err_text = res.text().await.unwrap_or_default();
                let msg = serde_json::from_str::<serde_json::Value>(&err_text)
                    .ok()
                    .and_then(|v| v["message"].as_str().map(|s| s.to_string()))
                    .unwrap_or(err_text);
                return Err(AppError::Git(format!("GitHub repository creation failed: {}", msg)));
            }

            let data: serde_json::Value = res
                .json()
                .await
                .map_err(|e| AppError::Unknown(format!("Invalid GitHub response: {}", e)))?;

            let clone_url = data["clone_url"]
                .as_str()
                .or_else(|| data["html_url"].as_str())
                .ok_or_else(|| AppError::Unknown("Missing clone URL in GitHub response".to_string()))?
                .to_string();

            let web_url = data["html_url"].as_str().unwrap_or(&clone_url).to_string();
            (clone_url, web_url)
        }

        ProviderKind::Gitlab => {
            let base = account.instance_url.trim_end_matches('/');
            let url = format!("{}/api/v4/projects", base);

            let is_group = namespace_id.as_deref().is_some() && namespace_id.as_deref() != Some("personal");
            let mut payload = json!({
                "name": clean_name,
                "path": clean_name.to_lowercase().replace(' ', "-"),
                "description": description.clone().unwrap_or_default(),
                "visibility": if is_private { "private" } else { "public" },
                "initialize_with_readme": false
            });

            if is_group {
                if let Some(ns) = namespace_id.as_deref() {
                    if let Ok(ns_id_num) = ns.parse::<i64>() {
                        payload["namespace_id"] = json!(ns_id_num);
                    }
                }
            }

            let res = client
                .post(&url)
                .header("PRIVATE-TOKEN", &token)
                .json(&payload)
                .send()
                .await
                .map_err(|e| AppError::Network(format!("Failed to connect to GitLab: {}", e)))?;

            if !res.status().is_success() {
                let err_text = res.text().await.unwrap_or_default();
                let msg = serde_json::from_str::<serde_json::Value>(&err_text)
                    .ok()
                    .and_then(|v| {
                        v["message"]
                            .as_str()
                            .map(|s| s.to_string())
                            .or_else(|| Some(v["message"].to_string()))
                    })
                    .unwrap_or(err_text);
                return Err(AppError::Git(format!("GitLab project creation failed: {}", msg)));
            }

            let data: serde_json::Value = res
                .json()
                .await
                .map_err(|e| AppError::Unknown(format!("Invalid GitLab response: {}", e)))?;

            let clone_url = data["http_url_to_repo"]
                .as_str()
                .or_else(|| data["web_url"].as_str())
                .ok_or_else(|| AppError::Unknown("Missing clone URL in GitLab response".to_string()))?
                .to_string();

            let web_url = data["web_url"].as_str().unwrap_or(&clone_url).to_string();
            (clone_url, web_url)
        }

        ProviderKind::Bitbucket => {
            let mut resolved_workspace = namespace_id
                .as_deref()
                .filter(|n| *n != "personal" && !n.is_empty())
                .map(|s| s.to_string());

            if resolved_workspace.is_none() {
                if let Ok(val) = bitbucket_get(
                    &client,
                    "https://api.bitbucket.org/2.0/workspaces?pagelen=10",
                    &token,
                    &clean_handle,
                )
                .await
                {
                    if let Some(values) = val["values"].as_array() {
                        if let Some(first_ws) = values.first() {
                            if let Some(slug) = first_ws["slug"].as_str() {
                                resolved_workspace = Some(slug.to_string());
                            }
                        }
                    }
                }
            }

            if resolved_workspace.is_none() {
                if let Ok(val) = bitbucket_get(
                    &client,
                    "https://api.bitbucket.org/2.0/user/permissions/workspaces?pagelen=10",
                    &token,
                    &clean_handle,
                )
                .await
                {
                    if let Some(values) = val["values"].as_array() {
                        if let Some(first_ws) = values.first() {
                            if let Some(slug) = first_ws["workspace"]["slug"]
                                .as_str()
                                .or_else(|| first_ws["slug"].as_str())
                            {
                                resolved_workspace = Some(slug.to_string());
                            }
                        }
                    }
                }
            }

            let workspace = resolved_workspace.unwrap_or_else(|| clean_handle.clone());
            let slug = clean_name.to_lowercase().replace(' ', "-");
            let url = format!(
                "https://api.bitbucket.org/2.0/repositories/{}/{}",
                workspace, slug
            );

            let payload = json!({
                "scm": "git",
                "name": clean_name,
                "description": description.clone().unwrap_or_default(),
                "is_private": is_private
            });

            let data = bitbucket_post_repo(&client, &url, &token, &clean_handle, &payload).await?;

            let mut clone_url = format!("https://bitbucket.org/{}/{}.git", workspace, slug);
            if let Some(links) = data["links"]["clone"].as_array() {
                for l in links {
                    if l["name"].as_str() == Some("https") {
                        if let Some(href) = l["href"].as_str() {
                            clone_url = href.to_string();
                            break;
                        }
                    }
                }
            }

            let web_url = data["links"]["html"]["href"]
                .as_str()
                .unwrap_or(&clone_url)
                .to_string();

            (clone_url, web_url)
        }
    };

    // ── Local Git Operations ────────────────────────────────────────────────
    let rp = repo_path.clone();
    let curl = clone_url.clone();

    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        // 1. Add or update remote "origin"
        let has_origin = silent_git_command()
            .args(["remote", "get-url", "origin"])
            .current_dir(&rp)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        if has_origin {
            let _ = set_remote_url(&rp, "origin", &curl, false);
        } else {
            let _ = add_remote(&rp, "origin", &curl);
        }

        Ok(())
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    // 2. Determine current branch
    let current_branch = silent_git_command()
        .args(["branch", "--show-current"])
        .current_dir(&repo_path)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                let b = String::from_utf8_lossy(&o.stdout).trim().to_string();
                if !b.is_empty() {
                    Some(b)
                } else {
                    None
                }
            } else {
                None
            }
        })
        .unwrap_or_else(|| "main".to_string());

    // 3. Push to remote with upstream tracking
    let rp_push = repo_path.clone();
    let branch_push = current_branch.clone();
    tokio::task::spawn_blocking(move || -> Result<(), AppError> {
        push_to_remote(&rp_push, &branch_push)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))??;

    crate::log_success!(
        crate::core::logging::LogCategory::Remote,
        format!("Published repository to '{}' on branch '{}'", clone_url, current_branch);
        repo_id: Some(repo_path),
        meta: serde_json::json!({ "remote_url": clone_url, "branch": current_branch })
    );

    Ok(PublishResult {
        remote_url: clone_url,
        web_url,
        branch: current_branch,
    })
}
