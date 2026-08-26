use crate::error::AppError;
use crate::git::ai::ai_commit::{collect_all_gemini_api_keys, DEFAULT_MODEL};
use git2::{Repository, Sort};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

const GEMINI_API_BASE: &str = "https://generativelanguage.googleapis.com/v1beta/models";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiReleaseNotesResult {
    pub title: String,
    pub notes: String,
    pub model_used: String,
    pub commits_analyzed: usize,
    pub from_tag: Option<String>,
}

#[derive(Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Serialize)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiGenerationConfig {
    temperature: f32,
}

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(rename = "generationConfig")]
    generation_config: GeminiGenerationConfig,
}

#[derive(Deserialize)]
struct GeminiResponsePart {
    #[serde(default)]
    text: String,
}

#[derive(Deserialize)]
struct GeminiResponseContent {
    #[serde(default)]
    parts: Vec<GeminiResponsePart>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiResponseContent>,
}

#[derive(Deserialize)]
struct GeminiResponse {
    #[serde(default)]
    candidates: Vec<GeminiCandidate>,
}

#[derive(Debug, Clone)]
struct CommitSummaryItem {
    #[allow(dead_code)]
    sha: String,
    short_sha: String,
    summary: String,
    body: String,
    author: String,
}

/// Formats author name into a valid markdown @username handle without spaces (e.g. "Neel Frostrain" -> "@NeelFrostrain")
fn format_contributor_handle(author: &str) -> String {
    let trimmed = author.trim();
    if trimmed.is_empty() {
        return "@contributor".to_string();
    }
    let without_at = trimmed.trim_start_matches('@');
    let name_part = if let Some(idx) = without_at.find('@') {
        &without_at[..idx]
    } else {
        without_at
    };
    let handle: String = name_part.chars().filter(|c| !c.is_whitespace()).collect();
    if handle.is_empty() {
        "@contributor".to_string()
    } else {
        format!("@{}", handle)
    }
}

/// Clean conventional commit prefixes to yield human-readable feature descriptions
fn clean_commit_message(msg: &str) -> Option<(String, String)> {
    let trimmed = msg.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Filter out merge commits and trivial file update commits
    if trimmed.starts_with("Merge branch")
        || trimmed.starts_with("Merge pull request")
        || trimmed.starts_with("Update README")
    {
        return None;
    }

    let lower = trimmed.to_lowercase();

    // Check if it's a generic "update file.ext" commit with no useful description
    if lower.starts_with("feat: update ")
        || lower.starts_with("fix: update ")
        || lower.starts_with("chore: update ")
        || lower.starts_with("test: update ")
    {
        return None;
    }

    let (category, rest) = if let Some(colon_pos) = trimmed.find(':') {
        let prefix = trimmed[..colon_pos].trim();
        let desc = trimmed[colon_pos + 1..].trim();
        let cat = if prefix.starts_with("feat") {
            "feature"
        } else if prefix.starts_with("fix") {
            "fix"
        } else if prefix.starts_with("refactor") || prefix.starts_with("perf") || prefix.starts_with("style") {
            "improvement"
        } else {
            "maintenance"
        };
        (cat, desc)
    } else {
        ("feature", trimmed)
    };

    if rest.is_empty() {
        return None;
    }

    // Capitalize first character
    let mut chars = rest.chars();
    let capitalized = match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    };

    Some((category.to_string(), capitalized))
}

/// Collects commits between previous_tag and target_ref
fn get_commits_for_release(
    repo: &Repository,
    target_tag: &str,
    specified_prev_tag: Option<&str>,
    target_branch: Option<&str>,
) -> Result<(Vec<CommitSummaryItem>, Option<String>), AppError> {
    let mut all_tags: Vec<(String, git2::Oid)> = Vec::new();
    if let Ok(tag_names) = repo.tag_names(None) {
        for name_opt in tag_names.iter() {
            if let Some(t_name) = name_opt {
                if t_name == target_tag {
                    continue;
                }
                if let Ok(obj) = repo.revparse_single(t_name) {
                    all_tags.push((t_name.to_string(), obj.id()));
                }
            }
        }
    }

    // Determine starting (base) point
    let from_tag: Option<String> = if let Some(prev) = specified_prev_tag {
        if !prev.trim().is_empty() {
            Some(prev.to_string())
        } else {
            None
        }
    } else if let Some((last_tag_name, _)) = all_tags.last() {
        Some(last_tag_name.clone())
    } else {
        None
    };

    let from_oid = from_tag.as_ref().and_then(|t| {
        repo.revparse_single(t).ok().map(|o| o.id())
    });

    // Determine target (HEAD / branch) OID
    let target_oid = if let Some(branch_name) = target_branch {
        repo.revparse_single(branch_name)
            .or_else(|_| repo.revparse_single(&format!("refs/heads/{}", branch_name)))
            .or_else(|_| repo.revparse_single(&format!("origin/{}", branch_name)))
            .ok()
            .map(|o| o.id())
            .or_else(|| repo.head().ok().and_then(|h| h.target()))
    } else {
        repo.revparse_single(target_tag)
            .ok()
            .map(|o| o.id())
            .or_else(|| repo.head().ok().and_then(|h| h.target()))
    };

    let Some(to_oid) = target_oid else {
        return Err(AppError::Git("Could not resolve target commit or HEAD.".to_string()));
    };

    let mut revwalk = repo.revwalk().map_err(|e| AppError::Git(e.to_string()))?;
    revwalk.set_sorting(Sort::TIME).map_err(|e| AppError::Git(e.to_string()))?;
    revwalk.push(to_oid).map_err(|e| AppError::Git(e.to_string()))?;

    if let Some(base_oid) = from_oid {
        let _ = revwalk.hide(base_oid);
    }

    let mut commits = Vec::new();
    let max_commits = 100;

    for oid_res in revwalk {
        if let Ok(oid) = oid_res {
            if let Ok(commit) = repo.find_commit(oid) {
                let sha = oid.to_string();
                let short_sha = if sha.len() >= 7 { sha[..7].to_string() } else { sha.clone() };
                let summary = commit.summary().unwrap_or("").to_string();
                let body = commit.body().unwrap_or("").to_string();
                let author = commit.author().name().unwrap_or("Contributor").to_string();

                commits.push(CommitSummaryItem {
                    sha,
                    short_sha,
                    summary,
                    body,
                    author,
                });

                if commits.len() >= max_commits {
                    break;
                }
            }
        }
    }

    // Fallback if no commits were found between tags, get last 25 from HEAD
    if commits.is_empty() {
        if let Ok(mut fallback_walk) = repo.revwalk() {
            let _ = fallback_walk.set_sorting(Sort::TIME);
            if fallback_walk.push_head().is_ok() {
                for oid_res in fallback_walk.take(25) {
                    if let Ok(oid) = oid_res {
                        if let Ok(commit) = repo.find_commit(oid) {
                            let sha = oid.to_string();
                            let short_sha = if sha.len() >= 7 { sha[..7].to_string() } else { sha.clone() };
                            commits.push(CommitSummaryItem {
                                sha,
                                short_sha,
                                summary: commit.summary().unwrap_or("").to_string(),
                                body: commit.body().unwrap_or("").to_string(),
                                author: commit.author().name().unwrap_or("Contributor").to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    Ok((commits, from_tag))
}

/// Generates an impact-oriented, synthesized local changelog using clean @username syntax
fn build_local_heuristic_changelog(
    target_tag: &str,
    from_tag: Option<&str>,
    commits: &[CommitSummaryItem],
) -> (String, String) {
    let title = format!("Release {} - Performance & Workflow Enhancements", target_tag);
    let mut features: Vec<String> = Vec::new();
    let mut fixes: Vec<String> = Vec::new();
    let mut improvements: Vec<String> = Vec::new();
    let mut authors = HashSet::new();

    // Map feature scopes to consolidate duplicate changes
    let mut seen_items = HashSet::new();

    for c in commits {
        let handle = format_contributor_handle(&c.author);
        authors.insert(handle.clone());

        if let Some((cat, clean_msg)) = clean_commit_message(&c.summary) {
            let key = clean_msg.to_lowercase();
            if seen_items.contains(&key) {
                continue;
            }
            seen_items.insert(key);

            let bullet = format!("- **{}** (`{}`) by {}", clean_msg, c.short_sha, handle);

            match cat.as_str() {
                "feature" => features.push(bullet),
                "fix" => fixes.push(bullet),
                "improvement" => improvements.push(bullet),
                _ => {}
            }
        }
    }

    let mut md = String::new();

    md.push_str("### Executive Summary\n\n");
    md.push_str(&format!(
        "This release (`{}`) introduces key feature enhancements, performance optimizations, and workflow refinements across git operations, UI layouts, and developer tools.\n\n",
        target_tag
    ));

    if !features.is_empty() {
        md.push_str("### Features & Enhancements\n\n");
        let count = features.len().min(14);
        md.push_str(&features[..count].join("\n"));
        md.push_str("\n\n");
    }

    if !fixes.is_empty() {
        md.push_str("### Bug Fixes & Stability\n\n");
        let count = fixes.len().min(8);
        md.push_str(&fixes[..count].join("\n"));
        md.push_str("\n\n");
    }

    if !improvements.is_empty() {
        md.push_str("### Improvements & Refactoring\n\n");
        let count = improvements.len().min(8);
        md.push_str(&improvements[..count].join("\n"));
        md.push_str("\n\n");
    }

    if !authors.is_empty() {
        let mut author_list: Vec<String> = authors.into_iter().collect();
        author_list.sort();
        md.push_str("### Contributors\n\n");
        md.push_str(&author_list.into_iter().map(|a| format!("- {}", a)).collect::<Vec<_>>().join("\n"));
        md.push_str("\n\n");
    }

    if let Some(prev) = from_tag {
        md.push_str(&format!(
            "**Full Changelog**: https://github.com/repository/compare/{}...{}\n",
            prev, target_tag
        ));
    } else {
        md.push_str(&format!(
            "**Full Changelog**: https://github.com/repository/commits/{}\n",
            target_tag
        ));
    }

    (title, md)
}

/// Generates full AI release notes analyzing commits between previous tag and target tag
pub async fn generate_ai_release_notes(
    repo_path: &str,
    target_tag: &str,
    previous_tag: Option<String>,
    target_branch: Option<String>,
    custom_api_key: Option<String>,
    model_override: Option<String>,
) -> Result<AiReleaseNotesResult, AppError> {
    let repo = Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;

    let (commits, resolved_from_tag) = get_commits_for_release(
        &repo,
        target_tag,
        previous_tag.as_deref(),
        target_branch.as_deref(),
    )?;

    if commits.is_empty() {
        return Err(AppError::Git("No commits found to analyze for release notes.".to_string()));
    }

    let api_keys = collect_all_gemini_api_keys(repo_path, custom_api_key.as_deref());

    // If no API key is available, use heuristic synthesiser immediately
    if api_keys.is_empty() {
        let (title, notes) = build_local_heuristic_changelog(
            target_tag,
            resolved_from_tag.as_deref(),
            &commits,
        );
        return Ok(AiReleaseNotesResult {
            title,
            notes,
            model_used: "Local Synthesizer Engine".to_string(),
            commits_analyzed: commits.len(),
            from_tag: resolved_from_tag,
        });
    }

    // Build meaningful commit summary list for LLM (filtering out noise)
    let mut commit_text = String::new();
    let mut meaningful_count = 0;

    for c in &commits {
        if let Some((cat, clean_msg)) = clean_commit_message(&c.summary) {
            let handle = format_contributor_handle(&c.author);
            commit_text.push_str(&format!(
                "[{}] {} ({}) by {}\n",
                cat.to_uppercase(), clean_msg, c.short_sha, handle
            ));
            if !c.body.trim().is_empty() {
                commit_text.push_str(&format!("  Details: {}\n", c.body.trim().lines().take(2).collect::<Vec<_>>().join(" ")));
            }
            meaningful_count += 1;
        }
    }

    if commit_text.is_empty() {
        for c in &commits {
            let handle = format_contributor_handle(&c.author);
            commit_text.push_str(&format!(
                "{} ({}) by {}\n",
                c.summary, c.short_sha, handle
            ));
        }
    }

    let prompt = format!(
        r#"You are a Principal Product Manager and Lead Release Engineer creating professional, impact-driven Release Notes for version `{}`{}.

Analyze the following commit activity and craft a clear, executive-quality release document explaining WHAT features were added, HOW they work, and their REAL IMPACT on users.

CRITICAL QUALITY & STYLE RULES:
1. DO NOT dump raw git commit message lines or repetitive file update lists.
2. DO NOT USE ANY EMOJIS (No emojis in titles, headers, or bullet points).
3. Focus on VALUE & IMPACT: Explain the capabilities added and why they benefit developers/users (e.g. "Release Management Suite: Added comprehensive workflows for creating, editing, and publishing Git releases with binary assets and pre-release markers").
4. CONSOLIDATE & GROUP: Synthesize related changes into 4-8 impactful, cohesive feature descriptions with bold topic headers.
5. Format all contributor credits and mentions strictly as `@username` with NO spaces (e.g. convert "Neel Frostrain" to `@NeelFrostrain`).
6. Structure your output EXACTLY as follows:

<title>Release vX.X.X - Descriptive Title</title>
<notes>
### Executive Summary
A 2-3 sentence overview highlighting the major milestones, capabilities, and overall value of this release.

### Features & Enhancements
- **Feature Name**: Clear explanation of what was added and its practical benefit to the user (`short_sha`) by @username.
- **Another Capability**: Description of functionality and workflow improvements.

### Bug Fixes & Stability
- **Issue Resolved**: Explanation of the fix and what issue it prevents.

### Improvements & Refactoring
- **Performance & Code Quality**: Architectural improvements, UI responsiveness, or layout polish.

### Contributors
- @username

**Full Changelog**: https://github.com/repository/compare/{}...{}
</notes>

Commits to synthesize ({} commits):
{}
"#,
        target_tag,
        resolved_from_tag.as_ref().map(|t| format!(" (comparing from `{}`)", t)).unwrap_or_default(),
        resolved_from_tag.as_deref().unwrap_or("main"),
        target_tag,
        meaningful_count,
        commit_text
    );

    let raw_model = model_override
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| AppError::Git(format!("Failed to build HTTP client: {}", e)))?;

    let candidate_models = vec![
        raw_model,
        "gemini-2.5-flash-lite".to_string(),
        "gemini-2.0-flash".to_string(),
        "gemini-1.5-flash".to_string(),
    ];

    for key in &api_keys {
        for model in &candidate_models {
            let request_body = GeminiRequest {
                contents: vec![GeminiContent {
                    role: "user".to_string(),
                    parts: vec![GeminiPart {
                        text: prompt.clone(),
                    }],
                }],
                generation_config: GeminiGenerationConfig {
                    temperature: 0.35,
                },
            };

            let url = format!("{}/{}:generateContent?key={}", GEMINI_API_BASE, model, key);

            if let Ok(response) = client.post(&url).json(&request_body).send().await {
                if response.status().is_success() {
                    if let Ok(gemini_resp) = response.json::<GeminiResponse>().await {
                        if let Some(candidate) = gemini_resp.candidates.first() {
                            if let Some(content) = &candidate.content {
                                let raw_text: String = content
                                    .parts
                                    .iter()
                                    .map(|p| p.text.as_str())
                                    .collect::<Vec<_>>()
                                    .join("\n");

                                if !raw_text.trim().is_empty() {
                                    let mut title = format!("Release {}", target_tag);
                                    let mut notes = raw_text.clone();

                                    if let Some(t_start) = raw_text.find("<title>") {
                                        if let Some(t_end) = raw_text.find("</title>") {
                                            title = raw_text[t_start + 7..t_end].trim().to_string();
                                        }
                                    }

                                    if let Some(n_start) = raw_text.find("<notes>") {
                                        if let Some(n_end) = raw_text.find("</notes>") {
                                            notes = raw_text[n_start + 7..n_end].trim().to_string();
                                        }
                                    }

                                    return Ok(AiReleaseNotesResult {
                                        title,
                                        notes,
                                        model_used: model.clone(),
                                        commits_analyzed: commits.len(),
                                        from_tag: resolved_from_tag,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Fallback if network/API calls fail
    let (title, notes) = build_local_heuristic_changelog(
        target_tag,
        resolved_from_tag.as_deref(),
        &commits,
    );

    Ok(AiReleaseNotesResult {
        title,
        notes,
        model_used: "Local Synthesizer Engine".to_string(),
        commits_analyzed: commits.len(),
        from_tag: resolved_from_tag,
    })
}
