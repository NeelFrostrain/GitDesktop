use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHookInfo {
    pub name: String,
    pub description: String,
    pub category: String,
    pub enabled: bool,
    pub exists: bool,
    pub is_executable: bool,
    pub script_content: String,
    pub file_path: String,
    pub default_template: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookTestResult {
    pub exit_code: i32,
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
}

struct HookDefinition {
    name: &'static str,
    description: &'static str,
    category: &'static str,
    default_template: &'static str,
}

const KNOWN_HOOKS: &[HookDefinition] = &[
    HookDefinition {
        name: "pre-commit",
        description: "Runs before commit is created. Used to validate staged files, run linters, and format checks.",
        category: "Commit",
        default_template: r#"#!/bin/sh
# GitDesktop Pre-Commit Hook Template
# Run linter and tests before committing changes

echo "🔍 Running pre-commit validation..."

# Example: Check for merge conflict markers
if git diff --cached --name-only | xargs grep -E "^<<<<<<< " > /dev/null 2>&1; then
  echo "❌ Error: Unresolved merge conflict markers detected in staged files!"
  exit 1
fi

# Example: Run lint / typecheck if node project exists
if [ -f "package.json" ]; then
  if command -v bun > /dev/null 2>&1; then
    bun run typecheck || exit 1
  elif command -v npm > /dev/null 2>&1; then
    npm run typecheck || exit 1
  fi
fi

echo "✅ Pre-commit validation passed!"
exit 0
"#,
    },
    HookDefinition {
        name: "commit-msg",
        description: "Validates commit message formatting (e.g. Conventional Commits, JIRA ticket ID prefixes).",
        category: "Commit",
        default_template: r#"#!/bin/sh
# GitDesktop Commit-Msg Hook Template
# Enforce Conventional Commits format: feat|fix|docs|style|refactor|perf|test|chore: message

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Allow merge commits
if echo "$COMMIT_MSG" | grep -qE "^Merge branch"; then
  exit 0
fi

# Validate conventional commit pattern
PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-zA-Z0-9_-]+\))?: .+"

if ! echo "$COMMIT_MSG" | grep -qE "$PATTERN"; then
  echo "❌ Invalid Commit Message format!"
  echo "   Format must follow Conventional Commits:"
  echo "   <type>(<optional scope>): <subject>"
  echo "   Example: feat(auth): add OAuth2 PKCE login"
  echo "   Example: fix(ui): resolve commit diff alignment"
  exit 1
fi

exit 0
"#,
    },
    HookDefinition {
        name: "pre-push",
        description: "Runs before pushing to remote repository. Used to run full test suites and secrets scanners.",
        category: "Remote",
        default_template: r#"#!/bin/sh
# GitDesktop Pre-Push Hook Template
# Prevent pushing to protected branches or pushing secrets

REMOTE="$1"
URL="$2"

echo "🚀 Running pre-push checks for $REMOTE ($URL)..."

# Prevent accidental direct push to main/master if desired
# CURRENT_BRANCH=$(git symbolic-ref --short HEAD)
# if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
#   echo "❌ Direct push to $CURRENT_BRANCH is blocked! Please create a PR/MR instead."
#   exit 1
# fi

# Example: Run unit tests before push
if [ -f "package.json" ]; then
  if command -v bun > /dev/null 2>&1; then
    bun test || exit 1
  elif command -v npm > /dev/null 2>&1; then
    npm test || exit 1
  fi
fi

echo "✅ Pre-push checks passed!"
exit 0
"#,
    },
    HookDefinition {
        name: "prepare-commit-msg",
        description: "Prepares default commit message before editor opens (e.g. prepending branch/ticket name).",
        category: "Commit",
        default_template: r#"#!/bin/sh
# GitDesktop Prepare-Commit-Msg Hook Template
# Automatically prepend current branch name / ticket ID if applicable

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2
SHA1=$3

# Extract branch name
BRANCH_NAME=$(git symbolic-ref --short HEAD 2>/dev/null)

if [ -n "$BRANCH_NAME" ] && [ -z "$COMMIT_SOURCE" ]; then
  # If branch starts with PROJ-1234, prepend to commit msg
  TICKET=$(echo "$BRANCH_NAME" | grep -oE "^[A-Z]+-[0-9]+")
  if [ -n "$TICKET" ]; then
    sed -i.bak -e "1s/^/[$TICKET] /" "$COMMIT_MSG_FILE"
  fi
fi

exit 0
"#,
    },
    HookDefinition {
        name: "post-commit",
        description: "Runs immediately after commit is created. Useful for notifications, telemetry, and logging.",
        category: "Commit",
        default_template: r#"#!/bin/sh
# GitDesktop Post-Commit Hook Template
# Trigger notifications or update stats

LAST_COMMIT=$(git log -1 --oneline)
echo "📦 Commit created: $LAST_COMMIT"

exit 0
"#,
    },
    HookDefinition {
        name: "post-checkout",
        description: "Runs after branch checkout or worktree switch. Useful for syncing dependencies or submodules.",
        category: "Branch",
        default_template: r#"#!/bin/sh
# GitDesktop Post-Checkout Hook Template
# Automatically update dependencies or submodules on branch change

PREV_HEAD=$1
NEW_HEAD=$2
IS_BRANCH_CHECKOUT=$3

if [ "$IS_BRANCH_CHECKOUT" = "1" ]; then
  echo "🌿 Switched branch. Syncing submodules..."
  git submodule update --init --recursive 2>/dev/null
fi

exit 0
"#,
    },
    HookDefinition {
        name: "post-merge",
        description: "Runs after pulling or merging. Useful for running database migrations or package installs.",
        category: "Merge",
        default_template: r#"#!/bin/sh
# GitDesktop Post-Merge Hook Template
# Check if package.json or Cargo.lock changed and remind/install

CHANGED_FILES=$(git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD 2>/dev/null)

if echo "$CHANGED_FILES" | grep -q "package.json"; then
  echo "📦 package.json modified in merge! You may need to run 'bun install' or 'npm install'."
fi

if echo "$CHANGED_FILES" | grep -q "Cargo.lock"; then
  echo "🦀 Cargo.lock modified in merge! You may need to run 'cargo check'."
fi

exit 0
"#,
    },
    HookDefinition {
        name: "pre-rebase",
        description: "Runs before rebase begins. Can prevent rebasing published or protected branches.",
        category: "Rebase",
        default_template: r#"#!/bin/sh
# GitDesktop Pre-Rebase Hook Template

UPSTREAM=$1
BRANCH=$2

# Disallow rebasing if desired
echo "🔄 Starting rebase onto $UPSTREAM..."
exit 0
"#,
    },
];

/// Resolves the Git hooks directory for a given repository.
fn get_hooks_dir(repo_path: &str) -> Result<PathBuf, AppError> {
    let repo_dir = Path::new(repo_path);
    if !repo_dir.exists() {
        return Err(AppError::Validation(format!(
            "Repository path does not exist: {}",
            repo_path
        )));
    }

    let dot_git = repo_dir.join(".git");
    if dot_git.is_file() {
        // Linked worktree: .git is a file containing `gitdir: <path>`
        let content = fs::read_to_string(&dot_git)
            .map_err(|e| AppError::Unknown(format!("Failed to read .git worktree file: {}", e)))?;
        if let Some(gitdir_line) = content.lines().find(|l| l.starts_with("gitdir:")) {
            let actual_gitdir = gitdir_line.trim_start_matches("gitdir:").trim();
            let actual_path = if Path::new(actual_gitdir).is_absolute() {
                PathBuf::from(actual_gitdir)
            } else {
                repo_dir.join(actual_gitdir)
            };
            return Ok(actual_path.join("hooks"));
        }
    }

    Ok(dot_git.join("hooks"))
}

/// Lists all known Git hooks with their status (enabled, disabled, content) in the repository.
pub fn list_git_hooks(repo_path: &str) -> Result<Vec<GitHookInfo>, AppError> {
    let hooks_dir = get_hooks_dir(repo_path)?;
    let mut results = Vec::new();

    for def in KNOWN_HOOKS {
        let active_file = hooks_dir.join(def.name);
        let disabled_file = hooks_dir.join(format!("{}.disabled", def.name));
        let sample_file = hooks_dir.join(format!("{}.sample", def.name));

        let (enabled, exists, target_path) = if active_file.exists() && !active_file.is_dir() {
            (true, true, active_file)
        } else if disabled_file.exists() && !disabled_file.is_dir() {
            (false, true, disabled_file)
        } else if sample_file.exists() && !sample_file.is_dir() {
            (false, false, sample_file)
        } else {
            (false, false, active_file)
        };

        let script_content = if exists {
            fs::read_to_string(&target_path).unwrap_or_default()
        } else if target_path.exists() {
            fs::read_to_string(&target_path).unwrap_or_default()
        } else {
            def.default_template.to_string()
        };

        let is_executable = if exists {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::metadata(&target_path)
                    .map(|m| (m.permissions().mode() & 0o111) != 0)
                    .unwrap_or(false)
            }
            #[cfg(windows)]
            {
                true
            }
        } else {
            false
        };

        results.push(GitHookInfo {
            name: def.name.to_string(),
            description: def.description.to_string(),
            category: def.category.to_string(),
            enabled,
            exists,
            is_executable,
            script_content,
            file_path: target_path.to_string_lossy().to_string(),
            default_template: Some(def.default_template.to_string()),
        });
    }

    Ok(results)
}

/// Saves or updates a Git hook script.
pub fn save_git_hook(
    repo_path: &str,
    hook_name: &str,
    script_content: &str,
    enabled: bool,
) -> Result<(), AppError> {
    let hooks_dir = get_hooks_dir(repo_path)?;
    if !hooks_dir.exists() {
        fs::create_dir_all(&hooks_dir).map_err(|e| {
            AppError::Unknown(format!("Failed to create .git/hooks directory: {}", e))
        })?;
    }

    let active_path = hooks_dir.join(hook_name);
    let disabled_path = hooks_dir.join(format!("{}.disabled", hook_name));

    // Remove any opposite file
    if enabled {
        if disabled_path.exists() {
            let _ = fs::remove_file(&disabled_path);
        }
        // Normalize LF line endings for git hook shell compatibility
        let normalized = script_content.replace("\r\n", "\n");
        fs::write(&active_path, normalized).map_err(|e| {
            AppError::Unknown(format!("Failed to write hook file {}: {}", hook_name, e))
        })?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = fs::metadata(&active_path) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&active_path, perms);
            }
        }
    } else {
        if active_path.exists() {
            let _ = fs::remove_file(&active_path);
        }
        let normalized = script_content.replace("\r\n", "\n");
        fs::write(&disabled_path, normalized).map_err(|e| {
            AppError::Unknown(format!("Failed to write disabled hook {}: {}", hook_name, e))
        })?;
    }

    Ok(())
}

/// Enables or disables an existing Git hook by renaming or creating from template.
pub fn toggle_git_hook(repo_path: &str, hook_name: &str, enabled: bool) -> Result<(), AppError> {
    let hooks_dir = get_hooks_dir(repo_path)?;
    let active_path = hooks_dir.join(hook_name);
    let disabled_path = hooks_dir.join(format!("{}.disabled", hook_name));

    if enabled {
        if disabled_path.exists() {
            fs::rename(&disabled_path, &active_path).map_err(|e| {
                AppError::Unknown(format!("Failed to enable hook {}: {}", hook_name, e))
            })?;
        } else if !active_path.exists() {
            // Create default from template
            let template = KNOWN_HOOKS
                .iter()
                .find(|h| h.name == hook_name)
                .map(|h| h.default_template)
                .unwrap_or("#!/bin/sh\nexit 0\n");
            save_git_hook(repo_path, hook_name, template, true)?;
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = fs::metadata(&active_path) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&active_path, perms);
            }
        }
    } else if active_path.exists() {
        fs::rename(&active_path, &disabled_path).map_err(|e| {
            AppError::Unknown(format!("Failed to disable hook {}: {}", hook_name, e))
        })?;
    }

    Ok(())
}

/// Deletes a Git hook file (both active and disabled).
pub fn delete_git_hook(repo_path: &str, hook_name: &str) -> Result<(), AppError> {
    let hooks_dir = get_hooks_dir(repo_path)?;
    let active_path = hooks_dir.join(hook_name);
    let disabled_path = hooks_dir.join(format!("{}.disabled", hook_name));

    if active_path.exists() {
        let _ = fs::remove_file(&active_path);
    }
    if disabled_path.exists() {
        let _ = fs::remove_file(&disabled_path);
    }

    Ok(())
}

/// Executes a Git hook script in test mode and captures output and timing.
pub fn run_git_hook_test(
    repo_path: &str,
    hook_name: &str,
    sample_args: Vec<String>,
) -> Result<HookTestResult, AppError> {
    let hooks_dir = get_hooks_dir(repo_path)?;
    let active_path = hooks_dir.join(hook_name);
    let disabled_path = hooks_dir.join(format!("{}.disabled", hook_name));

    let script_file = if active_path.exists() {
        active_path
    } else if disabled_path.exists() {
        disabled_path
    } else {
        return Err(AppError::Validation(format!(
            "Hook '{}' does not exist yet. Please save the hook before testing.",
            hook_name
        )));
    };

    let start = Instant::now();

    #[cfg(windows)]
    let mut cmd = {
        // On Windows, try running with git's embedded sh / bash if available, or cmd
        let mingit_dirs = crate::domain::git_runtime::get_mingit_bin_dirs();
        let sh_path = mingit_dirs
            .iter()
            .map(|d| d.join("sh.exe"))
            .find(|p| p.exists())
            .or_else(|| {
                let p = PathBuf::from(r"C:\Program Files\Git\bin\sh.exe");
                if p.exists() {
                    Some(p)
                } else {
                    None
                }
            })
            .or_else(|| {
                let p = PathBuf::from(r"C:\Program Files\Git\usr\bin\sh.exe");
                if p.exists() {
                    Some(p)
                } else {
                    None
                }
            });

        let c = if let Some(sh) = sh_path {
            let mut command = crate::git::command::silent_command(sh);
            command.arg(script_file.to_string_lossy().to_string());
            command
        } else {
            let mut command = crate::git::command::silent_command("cmd.exe");
            command
                .arg("/c")
                .arg(script_file.to_string_lossy().to_string());
            command
        };

        c
    };

    #[cfg(unix)]
    let mut cmd = {
        let mut c = std::process::Command::new("/bin/sh");
        c.arg(script_file);
        c
    };

    for arg in sample_args {
        cmd.arg(arg);
    }

    cmd.current_dir(repo_path);

    let output = cmd
        .output()
        .map_err(|e| AppError::Unknown(format!("Failed to execute test hook: {}", e)))?;

    let duration_ms = start.elapsed().as_millis() as u64;
    let exit_code = output.status.code().unwrap_or(-1);
    let success = output.status.success();
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok(HookTestResult {
        exit_code,
        success,
        stdout,
        stderr,
        duration_ms,
    })
}
