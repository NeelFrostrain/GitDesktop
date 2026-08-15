use serde::Deserialize;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use crate::error::AppError;
use super::local::{ActivityEvent, ActivityKind};

#[derive(Debug, Deserialize)]
struct GitLabEventRaw {
    id: u64,
    action_name: Option<String>,
    target_type: Option<String>,
    target_title: Option<String>,
    created_at: String,
    author_username: Option<String>,
    push_data: Option<GitLabPushDataRaw>,
    target_iid: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct GitLabPushDataRaw {
    commit_count: Option<u32>,
    action: Option<String>,
    ref_type: Option<String>,
    commit_title: Option<String>,
    #[serde(rename = "ref")]
    ref_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitLabPipelineRaw {
    id: u64,
    status: String,
    #[serde(rename = "ref")]
    ref_name: String,
    web_url: String,
    created_at: String,
}

pub async fn get_gitlab_activity(
    server_url: String,
    token: String,
    project_paths: Vec<String>,
    limit: usize,
) -> Result<Vec<ActivityEvent>, AppError> {
    if project_paths.is_empty() || token.trim().is_empty() {
        return Ok(Vec::new());
    }

    let clean_url = server_url.trim_end_matches('/').to_string();
    let mut headers = HeaderMap::new();
    let auth_val = format!("Bearer {}", token.trim());
    if let Ok(hv) = HeaderValue::from_str(&auth_val) {
        headers.insert(AUTHORIZATION, hv);
    }

    let client = match reqwest::Client::builder().default_headers(headers).build() {
        Ok(c) => c,
        Err(_) => return Ok(Vec::new()),
    };

    let mut events = Vec::new();

    for proj in project_paths {
        let encoded_proj = urlencoding::encode(&proj);
        let repo_name = proj.split('/').last().unwrap_or(&proj).to_string();

        // 1. Fetch recent events
        let events_url = format!("{}/api/v4/projects/{}/events?per_page=10", clean_url, encoded_proj);
        if let Ok(resp) = client.get(&events_url).send().await {
            if resp.status().is_success() {
                if let Ok(raw_events) = resp.json::<Vec<GitLabEventRaw>>().await {
                    for rev in raw_events {
                        let action = rev.action_name.as_deref().unwrap_or("");
                        let author = rev.author_username.unwrap_or_else(|| "gitlab-user".to_string());
                        let at = parse_iso_time(&rev.created_at);
                        let relative_date = format_relative_date(at);

                        if action == "pushed to" || action == "pushed new" {
                            let branch = rev.push_data.as_ref().and_then(|p| p.ref_name.clone()).unwrap_or_else(|| "main".to_string());
                            let count = rev.push_data.as_ref().and_then(|p| p.commit_count).unwrap_or(1);

                            events.push(ActivityEvent {
                                id: format!("gl-push-{}", rev.id),
                                kind: ActivityKind::Push {
                                    remote: "origin".to_string(),
                                    branch,
                                    commit_count: count,
                                },
                                repo_path: proj.clone(),
                                repo_name: repo_name.clone(),
                                at,
                                relative_date,
                            });
                        } else if action.contains("opened") || action.contains("closed") || action.contains("accepted") {
                            let title = rev.target_title.unwrap_or_else(|| "Merge Request".to_string());
                            let state = if action.contains("accepted") { "merged" } else if action.contains("closed") { "closed" } else { "opened" };
                            let iid = rev.target_iid.unwrap_or(1);
                            let mr_url = format!("{}/{}/-/merge_requests/{}", clean_url, proj, iid);

                            events.push(ActivityEvent {
                                id: format!("gl-mr-{}", rev.id),
                                kind: ActivityKind::MergeRequest {
                                    title,
                                    state: state.to_string(),
                                    url: mr_url,
                                    author,
                                    source_branch: "".to_string(),
                                    target_branch: "".to_string(),
                                },
                                repo_path: proj.clone(),
                                repo_name: repo_name.clone(),
                                at,
                                relative_date,
                            });
                        }
                    }
                }
            }
        }

        // 2. Fetch recent pipelines
        let pipelines_url = format!("{}/api/v4/projects/{}/pipelines?per_page=5", clean_url, encoded_proj);
        if let Ok(resp) = client.get(&pipelines_url).send().await {
            if resp.status().is_success() {
                if let Ok(raw_pipelines) = resp.json::<Vec<GitLabPipelineRaw>>().await {
                    for pipe in raw_pipelines {
                        let at = parse_iso_time(&pipe.created_at);
                        let relative_date = format_relative_date(at);

                        events.push(ActivityEvent {
                            id: format!("gl-pipe-{}", pipe.id),
                            kind: ActivityKind::Pipeline {
                                status: pipe.status,
                                branch: pipe.ref_name,
                                url: pipe.web_url,
                            },
                            repo_path: proj.clone(),
                            repo_name: repo_name.clone(),
                            at,
                            relative_date,
                        });
                    }
                }
            }
        }
    }

    events.sort_by(|a, b| b.at.cmp(&a.at));
    if events.len() > limit && limit > 0 {
        events.truncate(limit);
    }

    Ok(events)
}

fn parse_iso_time(iso: &str) -> i64 {
    chrono::DateTime::parse_from_rfc3339(iso)
        .map(|dt| dt.timestamp())
        .unwrap_or_else(|_| chrono::Utc::now().timestamp())
}

fn format_relative_date(timestamp: i64) -> String {
    let now = chrono::Utc::now().timestamp();
    let diff = now - timestamp;

    if diff < 60 {
        "just now".to_string()
    } else if diff < 3600 {
        let mins = diff / 60;
        format!("{} min{} ago", mins, if mins == 1 { "" } else { "s" })
    } else if diff < 86400 {
        let hours = diff / 3600;
        format!("{} hour{} ago", hours, if hours == 1 { "" } else { "s" })
    } else if diff < 604800 {
        let days = diff / 86400;
        format!("{} day{} ago", days, if days == 1 { "" } else { "s" })
    } else {
        let dt = chrono::DateTime::from_timestamp(timestamp, 0)
            .unwrap_or_else(|| chrono::Utc::now());
        dt.format("%b %d, %Y").to_string()
    }
}
