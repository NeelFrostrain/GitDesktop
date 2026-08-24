use super::AutocompleteSuggestion;
use crate::error::AppError;
use git2::{BranchType, Repository, StatusOptions};
use std::path::Path;

pub fn autocomplete_suggest(
    repo_path: &str,
    partial_command: &str,
    cursor_pos: u32,
) -> Result<Vec<AutocompleteSuggestion>, AppError> {
    let clean_path = repo_path.trim();
    if clean_path.is_empty() || !Path::new(clean_path).exists() {
        return Ok(Vec::new());
    }

    let repo = Repository::open(clean_path).map_err(|e| AppError::Git(e.to_string()))?;

    // Slice input up to cursor position
    let end_idx = (cursor_pos as usize).min(partial_command.len());
    let input_slice = &partial_command[..end_idx];

    // Simple shell tokenization
    let tokens = tokenize_input(input_slice);
    if tokens.is_empty() {
        return Ok(Vec::new());
    }

    // Determine if we are starting a new token (trailing space) or continuing the last token
    let is_new_token = input_slice.ends_with(' ') || input_slice.ends_with('\t');
    let (current_prefix, preceding_tokens) = if is_new_token {
        ("", tokens.as_slice())
    } else {
        let last = tokens.last().map(|s| s.as_str()).unwrap_or("");
        (last, &tokens[..tokens.len().saturating_sub(1)])
    };

    if preceding_tokens.is_empty() {
        return Ok(Vec::new());
    }

    // Identify main git command and subcommand
    let mut git_idx = None;
    for (i, token) in preceding_tokens.iter().enumerate() {
        if token == "git" {
            git_idx = Some(i);
            break;
        }
    }

    let git_idx = match git_idx {
        Some(idx) => idx,
        None => return Ok(Vec::new()),
    };

    let git_subcmd = preceding_tokens
        .get(git_idx + 1)
        .map(|s| s.as_str())
        .unwrap_or("");
    let git_subsubcmd = preceding_tokens
        .get(git_idx + 2)
        .map(|s| s.as_str())
        .unwrap_or("");

    let mut suggestions = Vec::new();

    match git_subcmd {
        "checkout" | "switch" | "merge" | "rebase" | "branch" => {
            // Branch and Tag completions
            let branches = get_branches(&repo)?;
            for b in branches {
                if current_prefix.is_empty()
                    || b.to_lowercase().contains(&current_prefix.to_lowercase())
                {
                    suggestions.push(AutocompleteSuggestion {
                        text: b.clone(),
                        value: b,
                        description: Some("Branch".to_string()),
                        kind: "branch".to_string(),
                    });
                }
            }

            let tags = get_tags(&repo)?;
            for t in tags {
                if current_prefix.is_empty()
                    || t.to_lowercase().contains(&current_prefix.to_lowercase())
                {
                    suggestions.push(AutocompleteSuggestion {
                        text: t.clone(),
                        value: t,
                        description: Some("Tag".to_string()),
                        kind: "tag".to_string(),
                    });
                }
            }
        }
        "push" | "pull" | "fetch" => {
            // Remotes first, or branches if remote is already specified
            let has_remote = preceding_tokens.len() > git_idx + 2;
            if !has_remote {
                let remotes = get_remotes(&repo)?;
                for r in remotes {
                    if current_prefix.is_empty()
                        || r.to_lowercase().contains(&current_prefix.to_lowercase())
                    {
                        suggestions.push(AutocompleteSuggestion {
                            text: r.clone(),
                            value: r,
                            description: Some("Remote".to_string()),
                            kind: "remote".to_string(),
                        });
                    }
                }
            } else {
                let branches = get_branches(&repo)?;
                for b in branches {
                    if current_prefix.is_empty()
                        || b.to_lowercase().contains(&current_prefix.to_lowercase())
                    {
                        suggestions.push(AutocompleteSuggestion {
                            text: b.clone(),
                            value: b,
                            description: Some("Branch".to_string()),
                            kind: "branch".to_string(),
                        });
                    }
                }
            }
        }
        "remote" => {
            if git_subsubcmd == "remove"
                || git_subsubcmd == "rename"
                || git_subsubcmd == "set-url"
                || git_subsubcmd == "get-url"
                || git_subsubcmd == "show"
            {
                let remotes = get_remotes(&repo)?;
                for r in remotes {
                    if current_prefix.is_empty()
                        || r.to_lowercase().contains(&current_prefix.to_lowercase())
                    {
                        suggestions.push(AutocompleteSuggestion {
                            text: r.clone(),
                            value: r,
                            description: Some("Remote".to_string()),
                            kind: "remote".to_string(),
                        });
                    }
                }
            }
        }
        "stash" => {
            if git_subsubcmd == "apply"
                || git_subsubcmd == "pop"
                || git_subsubcmd == "drop"
                || git_subsubcmd == "show"
                || git_subsubcmd == "branch"
            {
                let stashes = get_stashes(&repo)?;
                for (idx, msg) in stashes {
                    let text = format!("stash@{{{}}}", idx);
                    if current_prefix.is_empty() || text.contains(current_prefix) {
                        suggestions.push(AutocompleteSuggestion {
                            text: text.clone(),
                            value: text,
                            description: Some(msg),
                            kind: "stash".to_string(),
                        });
                    }
                }
            }
        }
        "add" | "diff" | "restore" | "rm" | "reset" | "blame" => {
            // Changed or tracked file paths
            let files = get_changed_and_tracked_files(&repo, clean_path)?;
            for f in files {
                if current_prefix.is_empty()
                    || f.to_lowercase().contains(&current_prefix.to_lowercase())
                {
                    suggestions.push(AutocompleteSuggestion {
                        text: f.clone(),
                        value: f,
                        description: Some("File".to_string()),
                        kind: "file".to_string(),
                    });
                }
            }
        }
        _ => {
            // General file / branch fallback if query looks like a file or branch
            if !current_prefix.is_empty() {
                let files = get_changed_and_tracked_files(&repo, clean_path)?;
                for f in files {
                    if f.to_lowercase().contains(&current_prefix.to_lowercase()) {
                        suggestions.push(AutocompleteSuggestion {
                            text: f.clone(),
                            value: f,
                            description: Some("File".to_string()),
                            kind: "file".to_string(),
                        });
                    }
                }
            }
        }
    }

    // Limit suggestions to top 25
    suggestions.truncate(25);
    Ok(suggestions)
}

fn tokenize_input(input: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut quote_char = ' ';

    for ch in input.chars() {
        if in_quotes {
            if ch == quote_char {
                in_quotes = false;
            } else {
                current.push(ch);
            }
        } else if ch == '"' || ch == '\'' {
            in_quotes = true;
            quote_char = ch;
        } else if ch.is_whitespace() {
            if !current.is_empty() {
                tokens.push(current.clone());
                current.clear();
            }
        } else {
            current.push(ch);
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    tokens
}

fn get_branches(repo: &Repository) -> Result<Vec<String>, AppError> {
    let mut branches = Vec::new();

    // Local branches
    if let Ok(local_branches) = repo.branches(Some(BranchType::Local)) {
        for branch in local_branches.flatten() {
            if let Ok(Some(name)) = branch.0.name() {
                branches.push(name.to_string());
            }
        }
    }

    // Remote branches
    if let Ok(remote_branches) = repo.branches(Some(BranchType::Remote)) {
        for branch in remote_branches.flatten() {
            if let Ok(Some(name)) = branch.0.name() {
                branches.push(name.to_string());
            }
        }
    }

    branches.sort();
    branches.dedup();
    Ok(branches)
}

fn get_tags(repo: &Repository) -> Result<Vec<String>, AppError> {
    let mut tags = Vec::new();
    if let Ok(tag_names) = repo.tag_names(None) {
        for tag in tag_names.iter().flatten() {
            tags.push(tag.to_string());
        }
    }
    tags.sort();
    Ok(tags)
}

fn get_remotes(repo: &Repository) -> Result<Vec<String>, AppError> {
    let mut remotes = Vec::new();
    if let Ok(remote_names) = repo.remotes() {
        for r in remote_names.iter().flatten() {
            remotes.push(r.to_string());
        }
    }
    remotes.sort();
    Ok(remotes)
}

fn get_stashes(repo: &Repository) -> Result<Vec<(usize, String)>, AppError> {
    let mut stashes = Vec::new();
    let mut mut_repo = Repository::open(repo.path()).map_err(|e| AppError::Git(e.to_string()))?;

    let _ = mut_repo.stash_foreach(|idx, name, _| {
        stashes.push((idx, name.to_string()));
        true
    });

    Ok(stashes)
}

fn get_changed_and_tracked_files(
    repo: &Repository,
    repo_path: &str,
) -> Result<Vec<String>, AppError> {
    let mut files = Vec::new();

    // 1. Modified and untracked files
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).include_ignored(false);
    if let Ok(statuses) = repo.statuses(Some(&mut opts)) {
        for entry in statuses.iter() {
            if let Some(path) = entry.path() {
                files.push(path.replace('\\', "/"));
            }
        }
    }

    // 2. Tracked files from git index if changed files count is small
    if files.len() < 30 {
        if let Ok(index) = repo.index() {
            for entry in index.iter() {
                let path = String::from_utf8_lossy(&entry.path)
                    .to_string()
                    .replace('\\', "/");
                if !files.contains(&path) {
                    files.push(path);
                }
                if files.len() >= 100 {
                    break;
                }
            }
        }
    }

    // Fallback: directory listing if index is empty
    if files.is_empty() {
        if let Ok(entries) = std::fs::read_dir(repo_path) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !name.starts_with('.') {
                    files.push(name);
                }
            }
        }
    }

    files.sort();
    files.dedup();
    Ok(files)
}
