use git2::{Repository, IndexAddOption, Signature};
use std::path::Path;
use crate::error::AppError;
use crate::auth::keyring;

pub fn stage_files(repo_path: &str, files: Vec<String>) -> Result<(), AppError> {
    let repo = Repository::open(repo_path)
        .map_err(|e| AppError::Git(format!("Failed to open repository: {}", e)))?;

    let mut index = repo.index()?;

    if files.is_empty() {
        index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
    } else {
        for file in &files {
            let path = Path::new(file);
            let full_path = Path::new(repo_path).join(path);
            if full_path.exists() {
                index.add_path(path)?;
            } else {
                index.remove_path(path)?;
            }
        }
    }

    index.write()?;
    Ok(())
}

pub fn unstage_files(repo_path: &str, files: Vec<String>) -> Result<(), AppError> {
    let repo = Repository::open(repo_path)?;
    let head = repo.head().and_then(|h| h.peel_to_commit()).ok();

    if let Some(commit) = head {
        repo.reset_default(Some(commit.as_object()), files)?;
    }
    Ok(())
}

pub fn commit_changes(
    repo_path: &str,
    summary: &str,
    description: Option<&str>,
) -> Result<(), AppError> {
    if summary.trim().is_empty() {
        return Err(AppError::Validation("Commit summary cannot be empty".to_string()));
    }

    let repo = Repository::open(repo_path)?;
    let mut index = repo.index()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    let config = repo.config()?;

    // Use the account associated with this repo (or the global active account),
    // falling back to local git config, then to defaults.
    let (name, email) = if let Some(acct) = keyring::get_account_for_repo(repo_path) {
        let name = if acct.name.trim().is_empty() || acct.name == "GitLab User" {
            config.get_string("user.name").unwrap_or_else(|_| acct.username.clone())
        } else {
            acct.name.clone()
        };
        let email = acct.email.unwrap_or_else(|| {
            config.get_string("user.email").unwrap_or_else(|_| format!("{}@git.local", acct.username))
        });
        (name, email)
    } else {
        let name = config.get_string("user.name").unwrap_or_else(|_| "Git Desktop User".to_string());
        let email = config.get_string("user.email").unwrap_or_else(|_| "user@git.local".to_string());
        (name, email)
    };

    let signature = Signature::now(&name, &email)?;

    let full_message = match description {
        Some(desc) if !desc.trim().is_empty() => format!("{}\n\n{}", summary.trim(), desc.trim()),
        _ => summary.trim().to_string(),
    };

    let parent_commit = match repo.head() {
        Ok(head) => match head.peel_to_commit() {
            Ok(c) => Some(c),
            Err(_) => None,
        },
        Err(_) => None,
    };

    let mut parents = Vec::new();
    if let Some(ref parent) = parent_commit {
        parents.push(parent);
    }

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &full_message,
        &tree,
        &parents,
    )?;

    Ok(())
}

pub fn list_branches(repo_path: &str) -> Result<Vec<crate::git::status::BranchInfo>, AppError> {
    let repo = Repository::open(repo_path)?;
    let branches = repo.branches(None)?;

    let mut result = Vec::new();
    let head_branch_name = match repo.head() {
        Ok(h) => h.shorthand().unwrap_or("").to_string(),
        Err(_) => "".to_string(),
    };

    for branch_res in branches {
        let (branch, branch_type) = branch_res?;
        let name = branch.name()?.unwrap_or("").to_string();
        if name.is_empty() {
            continue;
        }

        let is_remote = branch_type == git2::BranchType::Remote;
        let is_current = !is_remote && name == head_branch_name;

        result.push(crate::git::status::BranchInfo {
            name,
            is_current,
            is_remote,
        });
    }

    Ok(result)
}

pub fn checkout_branch(repo_path: &str, branch_name: &str) -> Result<(), AppError> {
    let repo = Repository::open(repo_path)?;
    let (object, reference) = repo.revparse_ext(branch_name)?;

    repo.checkout_tree(&object, None)?;

    match reference {
        Some(gref) => {
            repo.set_head(gref.name().unwrap_or("HEAD"))?;
        }
        None => {
            repo.set_head_detached(object.id())?;
        }
    }

    Ok(())
}

pub fn create_branch(repo_path: &str, branch_name: &str) -> Result<(), AppError> {
    let repo = Repository::open(repo_path)?;
    let head = repo.head()?.peel_to_commit()?;

    repo.branch(branch_name, &head, false)?;

    checkout_branch(repo_path, branch_name)?;
    Ok(())
}
