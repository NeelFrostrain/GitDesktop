use crate::auth::keyring;
use crate::error::AppError;
use crate::git::command::silent_git_command;
use git2::Repository;
use std::path::Path;

pub fn stage_files(repo_path: &str, files: Vec<String>) -> Result<(), AppError> {
    let clean_files: Vec<String> = files
        .into_iter()
        .map(|f| f.trim_end_matches('/').trim_end_matches('\\').to_string())
        .filter(|f| !f.is_empty())
        .collect();

    let repo_root = Path::new(repo_path);

    if clean_files.is_empty() {
        let mut cmd = silent_git_command();
        cmd.arg("add").arg("-A").arg(".");
        cmd.current_dir(repo_path);
        let output = cmd.output()?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Git(format!("Failed to stage all files: {}", stderr.trim())));
        }
    } else {
        let mut existing_files = Vec::new();
        let mut deleted_files = Vec::new();

        for f in clean_files {
            if repo_root.join(&f).exists() {
                existing_files.push(f);
            } else {
                deleted_files.push(f);
            }
        }

        // 1. Stage existing modified/untracked files
        for chunk in existing_files.chunks(100) {
            let mut cmd = silent_git_command();
            cmd.arg("add").arg("-A").arg("--");
            for f in chunk {
                cmd.arg(f);
            }
            cmd.current_dir(repo_path);
            let output = cmd.output()?;
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(AppError::Git(format!("Failed to stage files: {}", stderr.trim())));
            }
        }

        // 2. Stage deleted / renamed files into the index safely with --ignore-unmatch
        for chunk in deleted_files.chunks(100) {
            let mut cmd = silent_git_command();
            cmd.arg("rm").arg("-r").arg("-f").arg("--cached").arg("--ignore-unmatch").arg("--");
            for f in chunk {
                cmd.arg(f);
            }
            cmd.current_dir(repo_path);
            let output = cmd.output()?;
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(AppError::Git(format!("Failed to stage deleted files: {}", stderr.trim())));
            }
        }
    }

    Ok(())
}

pub fn unstage_files(repo_path: &str, files: Vec<String>) -> Result<(), AppError> {
    let clean_files: Vec<String> = files
        .into_iter()
        .map(|f| f.trim_end_matches('/').trim_end_matches('\\').to_string())
        .filter(|f| !f.is_empty())
        .collect();

    let has_head = silent_git_command()
        .args(["rev-parse", "--verify", "HEAD"])
        .current_dir(repo_path)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if clean_files.is_empty() {
        if has_head {
            let mut cmd = silent_git_command();
            cmd.arg("reset").arg("HEAD").arg("--").arg(".");
            cmd.current_dir(repo_path);
            let output = cmd.output()?;
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(AppError::Git(format!("Failed to unstage files: {}", stderr.trim())));
            }
        } else {
            let mut cmd = silent_git_command();
            cmd.arg("rm").arg("-r").arg("--cached").arg("--ignore-unmatch").arg("--").arg(".");
            cmd.current_dir(repo_path);
            let _ = cmd.output();
        }
    } else {
        for chunk in clean_files.chunks(100) {
            if has_head {
                let mut cmd = silent_git_command();
                cmd.arg("reset").arg("HEAD").arg("--");
                for f in chunk {
                    cmd.arg(f);
                }
                cmd.current_dir(repo_path);
                let output = cmd.output()?;
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(AppError::Git(format!("Failed to unstage files: {}", stderr.trim())));
                }
            } else {
                let mut cmd = silent_git_command();
                cmd.arg("rm").arg("-r").arg("--cached").arg("--ignore-unmatch").arg("--");
                for f in chunk {
                    cmd.arg(f);
                }
                cmd.current_dir(repo_path);
                let output = cmd.output()?;
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(AppError::Git(format!("Failed to unstage files: {}", stderr.trim())));
                }
            }
        }
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
        return Err(AppError::Validation(
            "Commit summary cannot be empty".to_string(),
        ));
    }

    let is_no_verify = no_verify.unwrap_or(false);
    let is_allow_empty = allow_empty.unwrap_or(false);
    let is_sign_off = sign_off.unwrap_or(false);

    let (name, email) = if let Some(acct) = keyring::get_account_for_repo(repo_path) {
        let name = if acct.name.trim().is_empty() || acct.name == "GitLab User" {
            let config_name = silent_git_command()
                .args(["config", "user.name"])
                .current_dir(repo_path)
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());
            config_name.unwrap_or_else(|| acct.username.clone())
        } else {
            acct.name.clone()
        };
        let email = acct.email.unwrap_or_else(|| {
            let config_email = silent_git_command()
                .args(["config", "user.email"])
                .current_dir(repo_path)
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());
            config_email.unwrap_or_else(|| format!("{}@git.local", acct.username))
        });
        (name, email)
    } else {
        let config_name = silent_git_command()
            .args(["config", "user.name"])
            .current_dir(repo_path)
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "Git Desktop User".to_string());

        let config_email = silent_git_command()
            .args(["config", "user.email"])
            .current_dir(repo_path)
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "user@git.local".to_string());

        (config_name, config_email)
    };

    let mut full_message = match description {
        Some(desc) if !desc.trim().is_empty() => format!("{}\n\n{}", summary.trim(), desc.trim()),
        _ => summary.trim().to_string(),
    };

    if is_sign_off && !full_message.contains("Signed-off-by:") {
        full_message = format!(
            "{}\n\nSigned-off-by: {} <{}>",
            full_message.trim(),
            name,
            email
        );
    }

    let mut cmd = silent_git_command();
    cmd.arg("commit");
    if is_no_verify {
        cmd.arg("--no-verify");
    }
    if is_allow_empty {
        cmd.arg("--allow-empty");
    }
    cmd.arg("-m").arg(&full_message);
    cmd.env("GIT_AUTHOR_NAME", &name);
    cmd.env("GIT_AUTHOR_EMAIL", &email);
    cmd.env("GIT_COMMITTER_NAME", &name);
    cmd.env("GIT_COMMITTER_EMAIL", &email);
    cmd.current_dir(repo_path);

    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let msg = if !stderr.trim().is_empty() {
            stderr.trim()
        } else {
            stdout.trim()
        };
        return Err(AppError::Git(format!("Git commit failed: {}", msg)));
    }

    Ok(())
}

pub fn list_branches(repo_path: &str) -> Result<Vec<crate::git::status::BranchInfo>, AppError> {
    let repo = Repository::open(repo_path)?;
    let branches = repo.branches(None)?;

    let mut result = Vec::new();
    let mut seen_names = std::collections::HashSet::new();
    let head_branch_name = match repo.head() {
        Ok(h) => h.shorthand().unwrap_or("").to_string(),
        Err(_) => "".to_string(),
    };

    for branch_res in branches {
        let (branch, branch_type) = branch_res?;
        let name = branch.name()?.unwrap_or("").to_string();
        if name.is_empty() || name.ends_with("/HEAD") || name.ends_with("\\HEAD") {
            continue;
        }

        let is_remote = branch_type == git2::BranchType::Remote;
        let key = (name.clone(), is_remote);
        if seen_names.contains(&key) {
            continue;
        }
        seen_names.insert(key);

        let is_current = !is_remote && name == head_branch_name;

        result.push(crate::git::status::BranchInfo {
            name,
            is_current,
            is_remote,
        });
    }

    Ok(result)
}

fn post_checkout_hooks(repo_path: &str) {
    let repo_dir = Path::new(repo_path);
    if repo_dir.join(".gitmodules").exists() {
        let _ = crate::git::remote::submodules::update_submodules(repo_path);
    }
    if repo_dir.join(".gitattributes").exists() {
        let _ = crate::git::remote::lfs::lfs_pull(repo_path);
    }
}

pub fn checkout_branch(repo_path: &str, branch_name: &str) -> Result<(), AppError> {
    let repo = Repository::open(repo_path)?;
    let raw_name = branch_name.trim();

    let local_name = if let Some(stripped) = raw_name.strip_prefix("refs/heads/") {
        stripped
    } else if let Some(stripped) = raw_name.strip_prefix("refs/remotes/origin/") {
        stripped
    } else if let Some(stripped) = raw_name.strip_prefix("origin/") {
        stripped
    } else {
        raw_name
    };

    // 1. Try to find an existing local branch
    if let Ok(mut local_branch) = repo.find_branch(local_name, git2::BranchType::Local) {
        let reference = local_branch.get_mut();
        let commit = reference.peel_to_commit()?;
        let mut opts = git2::build::CheckoutBuilder::new();
        opts.safe();
        if repo.checkout_tree(commit.as_object(), Some(&mut opts)).is_err() {
            let mut force_opts = git2::build::CheckoutBuilder::new();
            force_opts.force();
            repo.checkout_tree(commit.as_object(), Some(&mut force_opts))?;
        }
        let ref_name = reference.name().unwrap_or("HEAD");
        repo.set_head(ref_name)?;
        post_checkout_hooks(repo_path);
        return Ok(());
    }

    // 2. Try to find a remote tracking branch (e.g. origin/<local_name> or raw_name)
    let remote_branch_opt = repo
        .find_branch(&format!("origin/{}", local_name), git2::BranchType::Remote)
        .or_else(|_| repo.find_branch(raw_name, git2::BranchType::Remote))
        .or_else(|_| repo.find_branch(local_name, git2::BranchType::Remote));

    if let Ok(remote_branch) = remote_branch_opt {
        let commit = remote_branch.get().peel_to_commit()?;
        let mut new_local = repo.branch(local_name, &commit, false)?;
        if let Some(remote_ref_name) = remote_branch.get().name() {
            let _ = new_local.set_upstream(Some(remote_ref_name));
        }

        let mut opts = git2::build::CheckoutBuilder::new();
        opts.safe();
        if repo.checkout_tree(commit.as_object(), Some(&mut opts)).is_err() {
            let mut force_opts = git2::build::CheckoutBuilder::new();
            force_opts.force();
            repo.checkout_tree(commit.as_object(), Some(&mut force_opts))?;
        }
        repo.set_head(&format!("refs/heads/{}", local_name))?;
        post_checkout_hooks(repo_path);
        return Ok(());
    }

    // 3. Try standard revparse_ext (e.g. commit SHA, tag, or other revspec)
    if let Ok((object, reference)) = repo.revparse_ext(raw_name) {
        let mut opts = git2::build::CheckoutBuilder::new();
        opts.safe();
        if repo.checkout_tree(&object, Some(&mut opts)).is_err() {
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
        post_checkout_hooks(repo_path);
        return Ok(());
    }

    // 4. Fallback to CLI git checkout
    let mut cmd1 = silent_git_command();
    cmd1.current_dir(repo_path).args(["checkout", local_name]);
    let output = match cmd1.output() {
        Ok(out) if out.status.success() => Ok(out),
        _ => {
            let mut cmd2 = silent_git_command();
            cmd2.current_dir(repo_path).args(["checkout", raw_name]);
            cmd2.output()
        }
    }?;

    if output.status.success() {
        post_checkout_hooks(repo_path);
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(AppError::Git(format!(
        "Failed to checkout '{}': {}",
        raw_name,
        stderr.trim()
    )))
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
    if force {
        // Force delete: use `git branch -D` which deletes even if unmerged
        let output = silent_git_command()
            .args(["branch", "-D", branch_name])
            .current_dir(repo_path)
            .output()?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Git(format!(
                "Failed to force-delete branch '{}': {}",
                branch_name,
                stderr.trim()
            )));
        }
    } else {
        // Safe delete: use `git branch -d` which refuses to delete unmerged branches
        let output = silent_git_command()
            .args(["branch", "-d", branch_name])
            .current_dir(repo_path)
            .output()?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Provide a user-friendly message if the branch is not fully merged
            if stderr.contains("not fully merged") {
                return Err(AppError::Git(format!(
                    "Branch '{}' is not fully merged. Use force delete to remove it anyway.",
                    branch_name
                )));
            }
            return Err(AppError::Git(format!(
                "Failed to delete branch '{}': {}",
                branch_name,
                stderr.trim()
            )));
        }
    }
    Ok(())
}

pub fn push_branch(repo_path: &str, branch_name: &str, _set_upstream: bool) -> Result<(), AppError> {
    crate::git::remote::push_specific_remote(repo_path, "origin", branch_name, false)
}

pub fn discard_file_changes(repo_path: &str, file_path: &str) -> Result<(), AppError> {
    let full_path = Path::new(repo_path).join(file_path);

    // 1. Reset from staging index if staged (handles newly added files and modified staged files)
    let _ = silent_git_command()
        .current_dir(repo_path)
        .args(["reset", "HEAD", "--", file_path])
        .output();

    // 2. Discard tracked modifications from HEAD
    let mut cmd = silent_git_command();
    cmd.current_dir(repo_path);
    cmd.args(["checkout", "HEAD", "--", file_path]);
    let output = cmd.output()?;

    // 3. If file wasn't in HEAD (untracked/newly added), clean it
    if !output.status.success() {
        let mut cmd2 = silent_git_command();
        cmd2.current_dir(repo_path);
        cmd2.args(["clean", "-fd", "--", file_path]);
        let output2 = cmd2.output()?;
        if !output2.status.success() && full_path.exists() {
            if full_path.is_dir() {
                let _ = std::fs::remove_dir_all(&full_path);
            } else {
                let _ = std::fs::remove_file(&full_path);
            }
        }
    }
    Ok(())
}
