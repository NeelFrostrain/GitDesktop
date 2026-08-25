use crate::error::AppError;
use git2::{DiffOptions, Repository};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

const GROQ_API_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
pub const DEFAULT_MODEL: &str = "openai/gpt-oss-120b";
const MAX_DIFF_CHARS: usize = 28000;

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
      .map_err(|e| AppError::Git(format!("Failed to read git index: {}", e)))?;
    let diff = repo
      .diff_tree_to_index(head_tree.as_ref(), Some(&index), Some(&mut diff_opts))
      .map_err(|e| AppError::Git(format!("Failed to diff tree to index: {}", e)))?;

    diff
      .print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let content = std::str::from_utf8(line.content()).unwrap_or("");
        patch_text.push(line.origin());
        patch_text.push_str(content);
        true
      })
      .map_err(|e| AppError::Git(format!("Failed to format diff: {}", e)))?;
  } else {
    // Both staged and unstaged
    let mut total_patch = String::new();

    let index = repo.index().ok();
    if let (Some(tree), Some(idx)) = (head_tree.as_ref(), index.as_ref()) {
      if let Ok(staged_diff) =
        repo.diff_tree_to_index(Some(tree), Some(idx), Some(&mut diff_opts))
      {
        let _ = staged_diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
          let content = std::str::from_utf8(line.content()).unwrap_or("");
          total_patch.push(line.origin());
          total_patch.push_str(content);
          true
        });
      }
    }

    if let Ok(workdir_diff) =
      repo.diff_index_to_workdir(index.as_ref(), Some(&mut diff_opts))
    {
      let _ = workdir_diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let content = std::str::from_utf8(line.content()).unwrap_or("");
        total_patch.push(line.origin());
        total_patch.push_str(content);
        true
      });
    }

    // Fallback if index was empty or head tree not yet initialized
    if total_patch.trim().is_empty() {
      if let Ok(workdir_diff) =
        repo.diff_tree_to_workdir(head_tree.as_ref(), Some(&mut diff_opts))
      {
        let _ = workdir_diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
          let content = std::str::from_utf8(line.content()).unwrap_or("");
          total_patch.push(line.origin());
          total_patch.push_str(content);
          true
        });
      }
    }

    patch_text = total_patch;
  }

  // Include untracked files contents if patch is small
  if patch_text.len() < MAX_DIFF_CHARS {
    if let Ok(statuses) = repo.statuses(None) {
      for entry in statuses.iter() {
        if entry.status().contains(git2::Status::WT_NEW) {
          if let Some(path_str) = entry.path() {
            let full_path = Path::new(repo_path).join(path_str);
            if full_path.is_file() {
              if let Ok(content) = fs::read_to_string(&full_path) {
                let truncated_content = if content.len() > 3000 {
                  &content[..3000]
                } else {
                  &content
                };
                patch_text.push_str(&format!(
                  "\n--- /dev/null\n+++ b/{}\n@@ -0,0 +1,{} @@\n",
                  path_str,
                  truncated_content.lines().count()
                ));
                for line in truncated_content.lines() {
                  patch_text.push('+');
                  patch_text.push_str(line);
                  patch_text.push('\n');
                }
              }
            }
          }
        }
      }
    }
  }

  if patch_text.len() > MAX_DIFF_CHARS {
    patch_text.truncate(MAX_DIFF_CHARS);
    patch_text.push_str("\n... [Diff truncated for AI analysis] ...");
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
  for setting_name in &["ai.groq_api_keys", "ai.gemini_api_keys"] {
    if let Some(val) = app_settings.get(*setting_name) {
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
  }

  // 4. Local repo .env
  let local_env = Path::new(repo_path).join(".env");
  if local_env.exists() {
    if let Ok(content) = fs::read_to_string(&local_env) {
      for line in content.lines() {
        let trimmed = line.trim();
        if let Some((k, v)) = trimmed.split_once('=') {
          let var_name = k.trim();
          if var_name == "GROQ_API_KEY" || var_name == "GEMINI_API_KEY" {
            let val = v.trim().trim_matches('"').trim_matches('\'');
            if !val.is_empty() && !keys.contains(&val.to_string()) {
              keys.push(val.to_string());
            }
          }
        }
      }
    }
  }

  // 5. Process environment variables
  for env_var in &["GROQ_API_KEY", "GEMINI_API_KEY"] {
    if let Ok(k) = std::env::var(env_var) {
      let trimmed = k.trim();
      if !trimmed.is_empty() && !keys.contains(&trimmed.to_string()) {
        keys.push(trimmed.to_string());
      }
    }
  }

  keys
}

/// Build the Principal Engineer analysis prompt
pub fn build_prompt(diff: &str) -> String {
  format!(
    r#"You are a Principal Engineer writing a git commit. Generate 3 professional commit message titles and a clean, bulleted commit description body.

CRITICAL INSTRUCTIONS:
1. Analyze ACTUAL code changes in the diff - be SPECIFIC and concise
2. Use exact XML-style tags: <options> and <report>
3. DO NOT invent features not in the diff
4. Title options MUST follow Conventional Commits format:
   - Format: `<type>(<scope>): <short description>`
   - Types: feat, fix, refactor, docs, chore, test, style, perf, ci, build
   - Scope should be the affected module/component
   - Keep each title under 72 characters, lowercase, imperative mood ("add", not "added")
   - Provide 3 distinct perspectives:
     Option 1: Feature / Behavior focus
     Option 2: Technical / Architecture focus
     Option 3: Concise / Minimal summary

5. Commit Body (<report>) MUST be 3 to 5 clean, concise bullet points (NO markdown headers like ### or Summary of Changes):
   - Start each bullet point with `- ` and an active verb
   - Highlight the specific changes, fixes, or architectural updates
   - Keep each bullet point to 1-2 lines

Format your output EXACTLY as follows:

<options>
feat(scope): title option 1
refactor(scope): title option 2
fix(scope): title option 3
</options>

<report>
- Specific change or feature added in the diff
- Technical refactor or architectural adjustment
- Updated styles, tests, or configuration
</report>

Diff to analyze:
```diff
{}
```"#,
    diff
  )
}

/// Parse the XML-style options and report from LLM response
pub fn parse_multi_response(content: &str) -> (Vec<String>, String) {
  let mut titles: Vec<String> = Vec::new();
  let mut report = String::new();

  // Extract <options>
  if let Some(opt_start) = content.find("<options>") {
    if let Some(opt_end) = content.find("</options>") {
      let options_text = &content[opt_start + 9..opt_end];
      for line in options_text.lines() {
        let trimmed = line.trim();
        let cleaned = trimmed
          .trim_start_matches(|c: char| c.is_ascii_digit() || c == '.' || c == '-' || c == ' ')
          .trim();
        if !cleaned.is_empty() {
          titles.push(cleaned.to_string());
        }
      }
    }
  }

  // Extract <report>
  if let Some(rep_start) = content.find("<report>") {
    if let Some(rep_end) = content.find("</report>") {
      report = content[rep_start + 8..rep_end].trim().to_string();
    }
  }

  // Fallback if tags are missing
  if titles.is_empty() {
    for line in content.lines() {
      let trimmed = line.trim();
      if (trimmed.starts_with("feat")
        || trimmed.starts_with("fix")
        || trimmed.starts_with("refactor")
        || trimmed.starts_with("chore")
        || trimmed.starts_with("docs")
        || trimmed.starts_with("style")
        || trimmed.starts_with("perf"))
        && trimmed.contains(':')
      {
        titles.push(trimmed.to_string());
        if titles.len() >= 3 {
          break;
        }
      }
    }
  }

  if titles.is_empty() {
    let first_line = content
      .lines()
      .find(|l| !l.trim().is_empty())
      .unwrap_or("chore: update codebase")
      .trim()
      .to_string();
    titles.push(first_line);
  }

  if report.is_empty() {
    report = content.to_string();
  }

  (titles, report)
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
      "GROQ_API_KEY not found. Please add your free Groq API key in Settings -> AI & Commit-AI."
        .to_string(),
    ));
  }

  let diff_text = get_repo_diff_text(repo_path, staged_only)?;
  if diff_text.trim().is_empty() {
    return Err(AppError::Git(
      "No file changes or diff found to generate commit message.".to_string(),
    ));
  }

  let raw_model = model_override
    .filter(|m| !m.trim().is_empty())
    .or_else(|| std::env::var("COMMIT_AI_MODEL").ok())
    .unwrap_or_else(|| DEFAULT_MODEL.to_string());

  let initial_model = if raw_model.trim().is_empty() || raw_model.contains("gemini") {
    DEFAULT_MODEL.to_string()
  } else {
    raw_model
  };

  let prompt = build_prompt(&diff_text);

  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(45))
    .build()
    .map_err(|e| AppError::Git(format!("Failed to build HTTP client: {}", e)))?;

  // Verified active Groq & Open-Source production models
  let mut candidate_models = vec![initial_model.clone()];
  for fallback in [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "llama-3.1-70b-versatile",
  ] {
    if !candidate_models.contains(&fallback.to_string()) {
      candidate_models.push(fallback.to_string());
    }
  }

  let mut last_error = String::new();

  for (index, key) in api_keys.iter().enumerate() {
    for model in &candidate_models {
      let request_body = ChatCompletionRequest {
        model: model.clone(),
        messages: vec![ChatMessage {
          role: "user".to_string(),
          content: prompt.clone(),
        }],
        temperature: 0.7,
      };

      let response = client
        .post(GROQ_API_URL)
        .bearer_auth(key)
        .json(&request_body)
        .send()
        .await;

      match response {
        Ok(resp) => {
          let status = resp.status();
          if status.is_success() {
            if let Ok(chat_res) = resp.json::<ChatResponse>().await {
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
                  model_used: model.clone(),
                });
              }
            }
          } else {
            let status_code = status.as_u16();
            let err_body = resp.text().await.unwrap_or_default();
            last_error = format!(
              "Groq API key #{} with model `{}` returned {}: {}",
              index + 1,
              model,
              status,
              err_body
            );

            // If key is invalid (401 Unauthorized), stop testing other models with this invalid key
            if status_code == 401 {
              break;
            }
          }
        }
        Err(e) => {
          last_error = format!("Network error with Groq key #{}: {}", index + 1, e);
          break;
        }
      }
    }
  }

  Err(AppError::Git(format!(
    "All configured Groq API keys ({}) failed. Last error: {}",
    api_keys.len(),
    last_error
  )))
}
