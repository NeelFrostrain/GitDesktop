use crate::error::AppError;
use git2::{DiffOptions, Repository};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

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
    diff_opts.include_untracked(true);
    diff_opts.show_untracked_content(true);
    diff_opts.recurse_untracked_dirs(true);

    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
    let mut patch_text = String::new();

    if staged_only {
        let index = repo
            .index()
            .map_err(|e| AppError::Git(format!("Failed to get index: {}", e)))?;
        if let Ok(diff) = repo.diff_tree_to_index(head_tree.as_ref(), Some(&index), Some(&mut diff_opts)) {
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
    } else {
        // 1. Try diff_tree_to_workdir_with_index
        let diff = repo
            .diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut diff_opts))
            .ok()
            .or_else(|| repo.diff_tree_to_workdir(head_tree.as_ref(), Some(&mut diff_opts)).ok())
            .or_else(|| repo.diff_index_to_workdir(None, Some(&mut diff_opts)).ok());

        if let Some(d) = diff {
            let _ = d.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
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

    // Also include untracked new files if not staged_only
    if !staged_only {
        if let Ok(statuses) = repo.statuses(None) {
            for entry in statuses.iter() {
                let s = entry.status();
                if s.contains(git2::Status::WT_NEW) {
                    if let Some(path) = entry.path() {
                        let full_path = Path::new(repo_path).join(path);
                        if full_path.is_file() {
                            if let Ok(content) = fs::read_to_string(&full_path) {
                                let sample: String =
                                    content.lines().take(40).collect::<Vec<_>>().join("\n");
                                patch_text.push_str(&format!(
                                    "\n--- /dev/null\n+++ b/{}\n@@ -0,0 +1,{} @@\n{}\n",
                                    path,
                                    content.lines().count(),
                                    sample
                                ));
                            }
                        }
                    }
                }
                if patch_text.len() >= MAX_DIFF_CHARS {
                    break;
                }
            }
        }
    }

    // CLI fallback if git2 returns empty text
    if patch_text.trim().is_empty() {
        let mut cmd = crate::git::command::silent_git_command();
        cmd.current_dir(repo_path);
        if staged_only {
            cmd.args(["diff", "--cached", "-U2"]);
        } else {
            cmd.args(["diff", "HEAD", "-U2"]);
        }
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let out_str = String::from_utf8_lossy(&output.stdout);
                if !out_str.trim().is_empty() {
                    patch_text = out_str.chars().take(MAX_DIFF_CHARS).collect();
                }
            }
        }
    }

    if patch_text.trim().is_empty() && !staged_only {
        let mut cmd = crate::git::command::silent_git_command();
        cmd.current_dir(repo_path);
        cmd.args(["diff", "-U2"]);
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let out_str = String::from_utf8_lossy(&output.stdout);
                if !out_str.trim().is_empty() {
                    patch_text = out_str.chars().take(MAX_DIFF_CHARS).collect();
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

fn extract_tag_content(input: &str, tag: &str) -> Option<String> {
    let lower_input = input.to_lowercase();
    let open_tag = format!("<{}>", tag.to_lowercase());
    let close_tag = format!("</{}>", tag.to_lowercase());

    if let Some(start_idx) = lower_input.find(&open_tag) {
        let content_start = start_idx + open_tag.len();
        if let Some(end_idx) = lower_input[content_start..].find(&close_tag) {
            let actual_end = content_start + end_idx;
            return Some(input[content_start..actual_end].trim().to_string());
        } else {
            // No close tag found (e.g. streaming truncated or omission), take from open tag to end
            return Some(input[content_start..].trim().to_string());
        }
    }
    None
}

pub fn parse_multi_response(input: &str) -> (Vec<String>, String) {
    let clean_input = input
        .replace("```xml", "")
        .replace("```markdown", "")
        .replace("```", "")
        .trim()
        .to_string();

    // 1. Extract Options
    let options = if let Some(raw) = extract_tag_content(&clean_input, "options") {
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

    // 2. Extract Report
    let mut report = extract_tag_content(&clean_input, "report")
        .or_else(|| extract_tag_content(&clean_input, "description"))
        .or_else(|| extract_tag_content(&clean_input, "summary"));

    if report.is_none() {
        // Fallback: If </options> is present, everything after </options> is the report
        let lower = clean_input.to_lowercase();
        if let Some(opts_end) = lower.find("</options>") {
            let after = clean_input[opts_end + "</options>".len()..].trim();
            if !after.is_empty() {
                report = Some(after.to_string());
            }
        } else if !options.is_empty() {
            // Remove options lines from input
            let remaining_lines: Vec<&str> = clean_input
                .lines()
                .filter(|l| {
                    let t = l.trim();
                    !t.starts_with("<options>")
                        && !t.starts_with("</options>")
                        && !options.iter().any(|o| t.contains(o))
                })
                .collect();
            let joined = remaining_lines.join("\n").trim().to_string();
            if !joined.is_empty() {
                report = Some(joined);
            }
        } else {
            report = Some(clean_input.clone());
        }
    }

    let final_report = report.unwrap_or_default().trim().to_string();

    let final_report = if final_report.is_empty() {
        "Detailed code changes and technical updates applied.".to_string()
    } else {
        final_report
    };

    let options = if options.is_empty() {
        let first_line = clean_input
            .lines()
            .map(str::trim)
            .find(|l| !l.is_empty())
            .unwrap_or("chore: update project changes");
        vec![first_line.to_string()]
    } else {
        options
    };

    (options, final_report)
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
            "GROQ_API_KEY not found. Please add a Groq API key in Settings -> AI & Commit-AI."
                .to_string(),
        ));
    }

    let diff_text = get_repo_diff_text(repo_path, staged_only)?;
    if diff_text.trim().is_empty() {
        return Err(AppError::Git(
            "No modified, staged, or recent changes found in repository.".to_string(),
        ));
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
                last_error = format!(
                    "Groq API key #{} failed ({}): {}",
                    index + 1,
                    status,
                    err_body
                );

                // Handle 429 (Rate limit reached) or 404 (Model not found)
                if retry_attempt < 2 {
                    if status.as_u16() == 429 {
                        // Rate limit exceeded on heavy model -> fallback to high-capacity model
                        if model_to_try != "llama-3.3-70b-versatile"
                            && model_to_try != "llama-3.1-8b-instant"
                        {
                            model_to_try = "llama-3.3-70b-versatile".to_string();
                            continue;
                        } else if model_to_try != "llama-3.1-8b-instant" {
                            model_to_try = "llama-3.1-8b-instant".to_string();
                            continue;
                        }
                    } else if status.as_u16() == 404
                        || err_body.contains("model_not_found")
                        || err_body.contains("does not exist")
                    {
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
                let summary = title_options
                    .first()
                    .cloned()
                    .unwrap_or_else(|| "chore: update".to_string());

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
