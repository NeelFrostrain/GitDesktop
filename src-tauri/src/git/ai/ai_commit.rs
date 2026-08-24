use serde::{Deserialize, Serialize};
use git2::{Repository, DiffOptions};
use std::path::Path;
use std::fs;
use crate::error::AppError;

const GROQ_API_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
pub const DEFAULT_MODEL: &str = "openai/gpt-oss-120b";
const MAX_DIFF_CHARS: usize = 16000;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiCommitSuggestion {
    pub title_options: Vec<String>,
    pub summary: String,
    pub report: String,
    pub model_used: String,
}

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ResponseMessage,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: String,
}

/// Helper to get diff text for AI analysis
pub fn get_repo_diff_text(repo_path: &str, staged_only: bool) -> Result<String, AppError> {
    let repo = Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;

    let mut diff_opts = DiffOptions::new();
    diff_opts.context_lines(2);
    diff_opts.ignore_whitespace_change(true);

    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

    let mut patch_text = String::new();

    if staged_only {
        let index = repo.index()
            .map_err(|e| AppError::Git(format!("Failed to get index: {}", e)))?;
        let diff = repo.diff_tree_to_index(head_tree.as_ref(), Some(&index), Some(&mut diff_opts))
            .map_err(|e| AppError::Git(format!("Failed to compute staged diff: {}", e)))?;

        let _ = diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            if patch_text.len() < MAX_DIFF_CHARS {
                let origin = line.origin();
                if origin == '+' || origin == '-' || origin == ' ' {
                    patch_text.push(origin);
                }
                if let Ok(content) = std::str::from_utf8(line.content()) {
                    patch_text.push_str(content);
                }
            }
            true
        });
    } else {
        // Combined unstaged + staged
        let diff = repo.diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut diff_opts))
            .map_err(|e| AppError::Git(format!("Failed to compute working tree diff: {}", e)))?;

        let _ = diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
            if patch_text.len() < MAX_DIFF_CHARS {
                let origin = line.origin();
                if origin == '+' || origin == '-' || origin == ' ' {
                    patch_text.push(origin);
                }
                if let Ok(content) = std::str::from_utf8(line.content()) {
                    patch_text.push_str(content);
                }
            }
            true
        });
    }

    // Also include untracked new files if any
    let statuses = repo.statuses(None)
        .map_err(|e| AppError::Git(format!("Failed to get statuses: {}", e)))?;
    for entry in statuses.iter() {
        let s = entry.status();
        if s.contains(git2::Status::WT_NEW) {
            if let Some(path) = entry.path() {
                let full_path = Path::new(repo_path).join(path);
                if full_path.is_file() {
                    if let Ok(content) = fs::read_to_string(&full_path) {
                        let sample: String = content.lines().take(40).collect::<Vec<_>>().join("\n");
                        patch_text.push_str(&format!("\n--- /dev/null\n+++ b/{}\n@@ -0,0 +1,{} @@\n{}\n", path, content.lines().count(), sample));
                    }
                }
            }
        }
        if patch_text.len() >= MAX_DIFF_CHARS {
            break;
        }
    }

    // Fallback: If working tree has no uncommitted changes, analyze latest commit diff
    if patch_text.trim().is_empty() {
        if let Ok(head) = repo.head() {
            if let Ok(commit) = head.peel_to_commit() {
                if let Ok(tree) = commit.tree() {
                    let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());
                    if let Ok(diff) = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut diff_opts)) {
                        let _ = diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
                            if patch_text.len() < MAX_DIFF_CHARS {
                                let origin = line.origin();
                                if origin == '+' || origin == '-' || origin == ' ' {
                                    patch_text.push(origin);
                                }
                                if let Ok(content) = std::str::from_utf8(line.content()) {
                                    patch_text.push_str(content);
                                }
                            }
                            true
                        });
                    }
                }
            }
        }
    }

    Ok(patch_text)
}

/// Collect all configured Groq API keys in priority order
pub fn collect_all_groq_api_keys(repo_path: &str, custom_key: Option<&str>) -> Vec<String> {
    let mut keys: Vec<String> = Vec::new();

    // 1. Explicit custom key passed
    if let Some(k) = custom_key {
        let trimmed = k.trim();
        if !trimmed.is_empty() && !keys.contains(&trimmed.to_string()) {
            keys.push(trimmed.to_string());
        }
    }

    let app_settings = crate::domain::settings::store::get_app_settings();

    // 2. Active API key from app settings
    if let Some(val) = app_settings.get("ai.active_api_key") {
        if let Some(s) = val.as_str() {
            let trimmed = s.trim();
            if !trimmed.is_empty() && !keys.contains(&trimmed.to_string()) {
                keys.push(trimmed.to_string());
            }
        }
    }

    // 3. Multi-keys array from app settings
    if let Some(val) = app_settings.get("ai.groq_api_keys") {
        if let Some(arr) = val.as_array() {
            for item in arr {
                if let Some(s) = item.as_str() {
                    let trimmed = s.trim();
                    if !trimmed.is_empty() && !keys.contains(&trimmed.to_string()) {
                        keys.push(trimmed.to_string());
                    }
                }
            }
        } else if let Some(s) = val.as_str() {
            let trimmed = s.trim();
            if !trimmed.is_empty() && !keys.contains(&trimmed.to_string()) {
                keys.push(trimmed.to_string());
            }
        }
    }

    // 4. Local repo .env
    let local_env = Path::new(repo_path).join(".env");
    if local_env.exists() {
        if let Ok(content) = fs::read_to_string(&local_env) {
            for line in content.lines() {
                let trimmed = line.trim();
                if let Some((k, v)) = trimmed.split_once('=') {
                    if k.trim() == "GROQ_API_KEY" {
                        let val = v.trim().trim_matches('"').trim_matches('\'');
                        if !val.is_empty() && !keys.contains(&val.to_string()) {
                            keys.push(val.to_string());
                        }
                    }
                }
            }
        }
    }

    // 5. Process environment variable
    if let Ok(k) = std::env::var("GROQ_API_KEY") {
        let trimmed = k.trim();
        if !trimmed.is_empty() && !keys.contains(&trimmed.to_string()) {
            keys.push(trimmed.to_string());
        }
    }

    keys
}

/// Build the Principal Engineer analysis prompt (mirrors Commit-AI prompt)
pub fn build_prompt(diff: &str) -> String {
    format!(
        r#"You are a Principal Engineer analyzing git changes. Generate 3 professional commit message titles and a comprehensive technical report.

CRITICAL INSTRUCTIONS:
1. Analyze ACTUAL code changes in the diff - be SPECIFIC
2. Use exact XML-style tags: <options> and <report>
3. DO NOT invent features not in the diff
4. Include specific file names, function names, metrics
5. Provide detailed explanations with technical context

CHANGE TYPES:
- feat: New functionality (new functions, endpoints)
- fix: Bug fixes (fixing logic, errors)
- refactor: Code restructuring (renaming, reorganizing)
- perf: Performance improvements (optimization)
- style: Formatting/whitespace
- docs: Documentation only
- test: Tests
- chore: Build, dependencies, tooling
- build: Build system changes
- ci: CI/CD changes

OUTPUT FORMAT (STRICT):
<options>
1. type(scope): description of ACTUAL change
2. type(scope): alternative description
3. type(scope): different perspective
</options>
<report>
[CATEGORY]:
- Specific change with technical details FROM DIFF
- Implementation specifics with file/function names
- Impact or reasoning based on code

TECHNICAL DETAILS:
- Files changed: X files, Y insertions(+), Z deletions(-)
- Specific files: [list from diff]
- Key changes: [specific functions/variables from diff]
- Metrics: [measurements from diff]

IMPACT:
- Performance improvements (with metrics if evident)
- User/developer experience enhancements
- Code quality improvements
- Security/scalability improvements
</report>

NOW ANALYZE THIS DIFF AND DESCRIBE ONLY WHAT YOU SEE:
{diff}"#
    )
}

fn extract_tag(input: &str, tag: &str) -> Option<String> {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);

    let start = input.find(&open)? + open.len();
    let end = input.find(&close)?;

    if end > start {
        Some(input[start..end].trim().to_string())
    } else {
        None
    }
}

pub fn parse_multi_response(input: &str) -> (Vec<String>, String) {
    let report = extract_tag(input, "report")
        .unwrap_or_else(|| "Changes analyzed.".to_string());

    let options = if let Some(raw) = extract_tag(input, "options") {
        raw.lines()
            .map(str::trim)
            .filter(|l| !l.is_empty())
            .map(|line| {
                let cleaned: String = line
                    .chars()
                    .filter(|&c| c != '*' && c != '"' && c != '`')
                    .collect();
                let cleaned = cleaned.trim().to_string();
                if let Some(dot_pos) = cleaned.find(". ") {
                    if dot_pos < 4 {
                        return cleaned[dot_pos + 2..].to_string();
                    }
                }
                cleaned
            })
            .filter(|s| !s.is_empty())
            .collect()
    } else {
        vec![]
    };

    let options = if options.is_empty() {
        vec!["chore: update project changes".to_string()]
    } else {
        options
    };

    (options, report)
}

/// Execute AI Commit Generation via Groq API with multi-key rotation and automatic model fallback
pub async fn generate_ai_commit_message(
    repo_path: &str,
    staged_only: bool,
    custom_api_key: Option<String>,
    model_override: Option<String>,
) -> Result<AiCommitSuggestion, AppError> {
    let api_keys = collect_all_groq_api_keys(repo_path, custom_api_key.as_deref());
    if api_keys.is_empty() {
        return Err(AppError::Git(
            "GROQ_API_KEY not found. Please add a Groq API key in Settings -> AI & Commit-AI.".to_string()
        ));
    }

    let diff_text = get_repo_diff_text(repo_path, staged_only)?;
    if diff_text.trim().is_empty() {
        return Err(AppError::Git("No modified, staged, or recent changes found in repository.".to_string()));
    }

    let raw_model = model_override
        .filter(|m| !m.trim().is_empty())
        .or_else(|| std::env::var("COMMIT_AI_MODEL").ok())
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());

    let initial_model = if raw_model == "openai/gpt-oss-120" || raw_model.trim().is_empty() {
        "openai/gpt-oss-120b".to_string()
    } else {
        raw_model
    };

    let prompt = build_prompt(&diff_text);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| AppError::Git(format!("Failed to build HTTP client: {}", e)))?;

    let mut last_error = String::new();

    for (index, key) in api_keys.iter().enumerate() {
        let mut model_to_try = initial_model.clone();

        for retry_attempt in 0..2 {
            let request_body = ChatCompletionRequest {
                model: model_to_try.clone(),
                messages: vec![ChatMessage {
                    role: "user".to_string(),
                    content: prompt.clone(),
                }],
                temperature: 0.7,
            };

            let response = match client
                .post(GROQ_API_URL)
                .bearer_auth(key)
                .json(&request_body)
                .send()
                .await
            {
                Ok(resp) => resp,
                Err(e) => {
                    last_error = format!("Network error with key #{}: {}", index + 1, e);
                    break;
                }
            };

            let status = response.status();
            if !status.is_success() {
                let err_body = response.text().await.unwrap_or_default();
                last_error = format!("Groq API key #{} failed ({}): {}", index + 1, status, err_body);

                // Handle 429 (Rate limit reached) or 404 (Model not found)
                if retry_attempt < 2 {
                    if status.as_u16() == 429 {
                        // Rate limit exceeded on heavy model -> fallback to high-capacity model
                        if model_to_try != "llama-3.3-70b-versatile" && model_to_try != "llama-3.1-8b-instant" {
                            model_to_try = "llama-3.3-70b-versatile".to_string();
                            continue;
                        } else if model_to_try != "llama-3.1-8b-instant" {
                            model_to_try = "llama-3.1-8b-instant".to_string();
                            continue;
                        }
                    } else if status.as_u16() == 404 || err_body.contains("model_not_found") || err_body.contains("does not exist") {
                        if model_to_try != "llama-3.1-8b-instant" {
                            model_to_try = "llama-3.1-8b-instant".to_string();
                            continue;
                        }
                    }
                }
                break;
            }

            let chat_res: ChatResponse = match response.json().await {
                Ok(res) => res,
                Err(e) => {
                    last_error = format!("Parse error with key #{}: {}", index + 1, e);
                    break;
                }
            };

            if let Some(first_choice) = chat_res.choices.into_iter().next() {
                let (title_options, report) = parse_multi_response(&first_choice.message.content);
                let summary = title_options.first().cloned().unwrap_or_else(|| "chore: update".to_string());

                return Ok(AiCommitSuggestion {
                    title_options,
                    summary,
                    report,
                    model_used: model_to_try,
                });
            }
        }
    }

    Err(AppError::Git(format!(
        "All configured Groq API keys ({}) failed. Last error: {}",
        api_keys.len(),
        last_error
    )))
}
