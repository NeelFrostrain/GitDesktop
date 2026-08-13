use git2::{Repository, IndexAddOption, Signature};
use std::path::Path;
use std::process::Command;
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
        let mut index = repo.index()?;
        index.write()?;
    }
    Ok(())
}

pub fn commit_changes(
    repo_path: &str,
    summary: &str,
    description: Option<&str>,
    no_verify: Option<bool>,
    sign_off: Option<bool>,
    allow_empty: Option<bool>,
) -> Result<(), AppError> {
    if summary.trim().is_empty() {
        return Err(AppError::Validation("Commit summary cannot be empty".to_string()));
    }

    let is_no_verify = no_verify.unwrap_or(false);
    let is_allow_empty = allow_empty.unwrap_or(false);
    let is_sign_off = sign_off.unwrap_or(false);

    let repo = Repository::open(repo_path)?;
    let config = repo.config()?;

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

    let mut full_message = match description {
        Some(desc) if !desc.trim().is_empty() => format!("{}\n\n{}", summary.trim(), desc.trim()),
        _ => summary.trim().to_string(),
    };

    if is_sign_off && !full_message.contains("Signed-off-by:") {
        full_message = format!("{}\n\nSigned-off-by: {} <{}>", full_message.trim(), name, email);
    }

    if is_no_verify || is_allow_empty {
        let mut cmd = Command::new("git");
        cmd.arg("commit");
        if is_no_verify {
            cmd.arg("--no-verify");
        }
        if is_allow_empty {
            cmd.arg("--allow-empty");
        }
        if is_sign_off {
            cmd.arg("-s");
        }
        cmd.arg("-m").arg(&full_message);
        cmd.current_dir(repo_path);

        let output = cmd.output()?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Git(format!("Git commit failed: {}", stderr.trim())));
        }
        return Ok(());
    }

    let mut index = repo.index()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    let signature = Signature::now(&name, &email)?;

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

    let mut opts = git2::build::CheckoutBuilder::new();
    opts.safe();
    if let Err(_) = repo.checkout_tree(&object, Some(&mut opts)) {
        let mut force_opts = git2::build::CheckoutBuilder::new();
        force_opts.force();
        repo.checkout_tree(&object, Some(&mut force_opts))?;
    }

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

pub fn rename_branch(repo_path: &str, old_name: &str, new_name: &str) -> Result<(), AppError> {
    let repo = Repository::open(repo_path)?;
    let mut branch = repo.find_branch(old_name, git2::BranchType::Local)?;
    branch.rename(new_name, true)?;
    Ok(())
}

pub fn delete_branch(repo_path: &str, branch_name: &str, force: bool) -> Result<(), AppError> {
    let repo = Repository::open(repo_path)?;
    let mut branch = repo.find_branch(branch_name, git2::BranchType::Local)?;
    if force {
        branch.delete()?;
    } else {
        branch.delete()?;
    }
    Ok(())
}

pub fn push_branch(repo_path: &str, branch_name: &str, set_upstream: bool) -> Result<(), AppError> {
    use std::process::Command;
    use crate::git::remote::{get_git_auth_info, apply_git_auth_args_pub};

    let auth_info = get_git_auth_info(repo_path);
    let mut cmd = Command::new("git");
    cmd.current_dir(repo_path);
    apply_git_auth_args_pub(&mut cmd, &auth_info);

    cmd.arg("push");
    if set_upstream {
        cmd.arg("-u");
    }
    cmd.arg("origin").arg(branch_name);

    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Git(format!("Failed to push branch: {}", stderr.trim())));
    }
    Ok(())
}

pub fn discard_file_changes(repo_path: &str, file_path: &str) -> Result<(), AppError> {
    use std::process::Command;
    let full_path = Path::new(repo_path).join(file_path);

    let mut cmd = Command::new("git");
    cmd.current_dir(repo_path);
    cmd.args(["checkout", "HEAD", "--", file_path]);
    let output = cmd.output()?;

    if !output.status.success() {
        let mut cmd2 = Command::new("git");
        cmd2.current_dir(repo_path);
        cmd2.args(["clean", "-f", "--", file_path]);
        let output2 = cmd2.output()?;
        if !output2.status.success() && full_path.exists() {
            let _ = std::fs::remove_file(&full_path);
        }
    }
    Ok(())
}


