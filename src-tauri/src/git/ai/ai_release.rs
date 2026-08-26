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
    files: String,
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
        } else if prefix.starts_with("perf") {
            "performance"
        } else if prefix.starts_with("refactor") || prefix.starts_with("style") || prefix.starts_with("chore") || prefix.starts_with("docs") {
            "improvement"
        } else {
            "improvement"
        };
        (cat, desc)
    } else {
        let lower = trimmed.to_lowercase();
        let cat = if lower.starts_with("feat")
            || lower.starts_with("add ")
            || lower.starts_with("introduce ")
            || lower.starts_with("implement ")
            || lower.starts_with("create ")
        {
            "feature"
        } else if lower.starts_with("fix")
            || lower.starts_with("resolve")
            || lower.starts_with("patch")
            || lower.starts_with("bug")
        {
            "fix"
        } else if lower.starts_with("perf") || lower.starts_with("optimi") {
            "performance"
        } else {
            "improvement"
        };
        (cat, trimmed)
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

/// Parses semver tag into numerical tuple (major, minor, patch, remaining)
fn parse_semver_tag(s: &str) -> (u32, u32, u32, &str) {
    let clean = s.trim_start_matches(|c: char| c == 'v' || c == 'V' || c == '@');
    let mut parts = clean.split('.');
    let major = parts.next().and_then(|p| p.parse::<u32>().ok()).unwrap_or(0);
    let minor = parts.next().and_then(|p| p.parse::<u32>().ok()).unwrap_or(0);
    let patch_part = parts.next().unwrap_or("");
    let patch = patch_part
        .split(|c: char| !c.is_numeric())
        .next()
        .and_then(|p| p.parse::<u32>().ok())
        .unwrap_or(0);
    (major, minor, patch, clean)
}

/// Compares two git tags in semver descending order (e.g. v2.6.8 > v2.6.7 > v2.5.1)
fn compare_semver(a: &str, b: &str) -> std::cmp::Ordering {
    let (a_maj, a_min, a_pat, a_raw) = parse_semver_tag(a);
    let (b_maj, b_min, b_pat, b_raw) = parse_semver_tag(b);
    b_maj
        .cmp(&a_maj)
        .then_with(|| b_min.cmp(&a_min))
        .then_with(|| b_pat.cmp(&a_pat))
        .then_with(|| b_raw.cmp(a_raw))
}

/// Collects commits between previous_tag and target_ref
fn get_commits_for_release(
    repo: &Repository,
    target_tag: &str,
    specified_prev_tag: Option<&str>,
    target_branch: Option<&str>,
) -> Result<(Vec<CommitSummaryItem>, Option<String>), AppError> {
    let mut all_tags: Vec<String> = Vec::new();
    if let Ok(tag_names) = repo.tag_names(None) {
        for name_opt in tag_names.iter() {
            if let Some(t_name) = name_opt {
                all_tags.push(t_name.to_string());
            }
        }
    }

    // Sort descending by semver
    all_tags.sort_by(|a, b| compare_semver(a, b));

    // Determine starting (base) point: find immediate previous tag in semver descending order
    let from_tag: Option<String> = if let Some(prev) = specified_prev_tag {
        if !prev.trim().is_empty() {
            Some(prev.to_string())
        } else {
            None
        }
    } else {
        let curr_idx = all_tags.iter().position(|t| t == target_tag);
        if let Some(idx) = curr_idx {
            if idx + 1 < all_tags.len() {
                Some(all_tags[idx + 1].clone())
            } else {
                None
            }
        } else {
            all_tags.into_iter().find(|t| t != target_tag)
        }
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

                let mut files_list = Vec::new();
                if let Ok(parent) = commit.parent(0) {
                    if let (Ok(p_tree), Ok(c_tree)) = (parent.tree(), commit.tree()) {
                        if let Ok(diff) = repo.diff_tree_to_tree(Some(&p_tree), Some(&c_tree), None) {
                            let _ = diff.foreach(
                                &mut |delta, _| {
                                    if let Some(path) = delta.new_file().path() {
                                        if let Some(s) = path.to_str() {
                                            let file_name = s.split(['/', '\\']).last().unwrap_or(s);
                                            files_list.push(file_name.to_string());
                                        }
                                    }
                                    true
                                },
                                None,
                                None,
                                None,
                            );
                        }
                    }
                }

                let files = if !files_list.is_empty() {
                    files_list.dedup();
                    files_list[..files_list.len().min(3)].join(", ")
                } else {
                    String::new()
                };

                commits.push(CommitSummaryItem {
                    sha,
                    short_sha,
                    summary,
                    body,
                    author,
                    files,
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
                                files: String::new(),
                            });
                        }
                    }
                }
            }
        }
    }

    Ok((commits, from_tag))
}

/// Generates a structured Keep-a-Changelog formatted release document
fn build_local_heuristic_changelog(
    target_tag: &str,
    _from_tag: Option<&str>,
    commits: &[CommitSummaryItem],
) -> (String, String) {
    let clean_version = target_tag.trim_start_matches(|c: char| c == 'v' || c == 'V');
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let mut added: Vec<String> = Vec::new();
    let mut fixed: Vec<String> = Vec::new();
    let mut changed: Vec<String> = Vec::new();
    let mut perf: Vec<String> = Vec::new();
    let mut highlights: Vec<String> = Vec::new();

    let mut seen_items = HashSet::new();

    for c in commits {
        if let Some((cat, clean_msg)) = clean_commit_message(&c.summary) {
            let key = clean_msg.to_lowercase();
            if seen_items.contains(&key) {
                continue;
            }
            seen_items.insert(key);

            if highlights.len() < 4 {
                highlights.push(clean_msg.clone());
            }

            let scope = if !c.files.trim().is_empty() {
                c.files.clone()
            } else {
                c.short_sha.clone()
            };

            let detail = if !c.body.trim().is_empty() {
                c.body.trim().lines().next().unwrap_or(&clean_msg).to_string()
            } else {
                let lower = clean_msg.to_lowercase();
                if lower.starts_with("update") {
                    let target = clean_msg.trim_start_matches("Update").trim_start_matches("update").trim();
                    format!("Updated {} configuration with latest parameters and setup defaults.", if target.is_empty() { "configuration" } else { target })
                } else if lower.starts_with("add") {
                    let target = clean_msg.trim_start_matches("Add").trim_start_matches("add").trim();
                    format!("Added {} with component integration.", if target.is_empty() { "new features" } else { target })
                } else if lower.starts_with("fix") {
                    let target = clean_msg.trim_start_matches("Fix").trim_start_matches("fix").trim();
                    format!("Fixed {} to ensure stability and correct behavior.", if target.is_empty() { "issue" } else { target })
                } else if lower.starts_with("enhance") || lower.starts_with("improve") || lower.starts_with("refactor") {
                    format!("Enhanced {} for improved performance and workflow experience.", clean_msg)
                } else {
                    format!("Implemented {} updates across project codebase.", clean_msg)
                }
            };

            match cat.as_str() {
                "feature" => {
                    let title = if clean_msg.to_lowercase().starts_with("add ") {
                        clean_msg.trim_start_matches("Add ").trim_start_matches("add ").to_string()
                    } else {
                        clean_msg.clone()
                    };
                    added.push(format!("- Added **{}** (`{}`): {}", title, scope, detail));
                }
                "fix" => {
                    let title = if clean_msg.to_lowercase().starts_with("fix ") {
                        clean_msg.trim_start_matches("Fix ").trim_start_matches("fix ").to_string()
                    } else {
                        clean_msg.clone()
                    };
                    fixed.push(format!("- Fixed **{}** (`{}`): {}", title, scope, detail));
                }
                "performance" => {
                    perf.push(format!("- **{}** (`{}`): {}", clean_msg, scope, detail));
                }
                _ => {
                    changed.push(format!("- **{}** (`{}`): {}", clean_msg, scope, detail));
                }
            }
        }
    }

    let subtitle = if !highlights.is_empty() {
        highlights.join(" · ")
    } else {
        format!("Release {}", target_tag)
    };

    let title = format!("Release {}", target_tag);
    let mut md = format!("## [{}] - {} — `{}`\n\n", clean_version, today, subtitle);

    if !added.is_empty() {
        md.push_str("### Added\n\n");
        let count = added.len().min(12);
        md.push_str(&added[..count].join("\n"));
        md.push_str("\n\n");
    }

    if !fixed.is_empty() {
        md.push_str("### Fixed\n\n");
        let count = fixed.len().min(8);
        md.push_str(&fixed[..count].join("\n"));
        md.push_str("\n\n");
    }

    if !perf.is_empty() {
        md.push_str("### Performance\n\n");
        let count = perf.len().min(6);
        md.push_str(&perf[..count].join("\n"));
        md.push_str("\n\n");
    }

    if !changed.is_empty() {
        md.push_str("### Changed\n\n");
        let count = changed.len().min(8);
        md.push_str(&changed[..count].join("\n"));
        md.push_str("\n\n");
    }

    (title, md.trim_end().to_string())
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

    let clean_version = target_tag.trim_start_matches(|c: char| c == 'v' || c == 'V');
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let compare_info = resolved_from_tag
        .as_ref()
        .map(|t| format!(" (comparing from `{}`)", t))
        .unwrap_or_default();

    let prompt = format!(
        r#"You are a Lead Release Engineer creating professional, Keep-a-Changelog standard Release Notes for version `{target_tag}`{compare_info}.
Today's Date: {today}
Clean Version: {clean_version}

Analyze the following commit activity and craft a clear, structured changelog.

MANDATORY OUTPUT STRUCTURE:
<title>Release {target_tag}</title>
<notes>
## [{clean_version}] - {today} — `3-5 High-Level Feature Highlights separated by ·`

### Added

- Added **Feature Name** (`primary file/scope`): Insightful, comprehensive description of what was introduced and how it benefits developers or users.
- Added **Another Feature** (`scope`): Concrete explanation of functionality.

### Fixed

- Fixed **Bug Name** (`primary file/scope`): Clear explanation of what was wrong, the root cause resolved, and what error it prevents.

### Changed

- **Refactoring or Update Name** (`primary file/scope`): Clear description of improvements, design system alignments, or architectural updates.

### Performance (Include only if performance improvements exist)

- **Optimization Name** (`scope`): Explanation of speedup or memory efficiency improvement.
</notes>

CRITICAL FORMATTING & STYLE RULES:
1. Header MUST follow: ## [{clean_version}] - {today} — `Highlight 1 · Highlight 2 · Highlight 3`
2. Standard sections ONLY: '### Added', '### Fixed', '### Changed', and optionally '### Performance' or '### Removed'.
3. DO NOT include Executive Summary or Contributors or Full Changelog links.
4. DO NOT USE ANY EMOJIS (No emojis in headers, subtitles, or bullets).
5. Each bullet MUST begin with bold title followed by (`file/component`) and a polished 1-2 sentence explanation.
6. Only output sections that have relevant items.

Commits to analyze ({meaningful_count} commits):
{commit_text}
"#
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
