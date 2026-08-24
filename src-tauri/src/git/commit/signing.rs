use crate::error::AppError;
use crate::git::command::{silent_command, silent_git_command};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GpgKeyInfo {
    pub key_id: String,
    pub user_id: String,
    pub email: Option<String>,
    pub created_at: Option<String>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshKeyInfo {
    pub path: String,
    pub public_key: String,
    pub key_type: String,
    pub comment: Option<String>,
    pub is_agent: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SigningConfig {
    pub enabled: bool,
    pub method: String, // "gpg" | "ssh"
    pub key_id: String,
    pub scope: String, // "repo" | "global"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "status", content = "details")]
pub enum VerifyResult {
    Verified {
        signer: String,
        key_id: Option<String>,
    },
    Unverified {
        reason: String,
    },
    NoSignature,
    Error(String),
}

/// List all GPG secret keys installed on the machine
pub fn list_gpg_keys() -> Result<Vec<GpgKeyInfo>, AppError> {
    let output = silent_command("gpg")
        .args([
            "--list-secret-keys",
            "--with-colons",
            "--keyid-format",
            "LONG",
        ])
        .output();

    let output = match output {
        Ok(out) => out,
        Err(_) => return Ok(Vec::new()), // gpg not installed or in PATH
    };

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut keys = Vec::new();
    let mut current_key_id: Option<String> = None;
    let mut current_created: Option<String> = None;
    let mut current_expires: Option<String> = None;

    for line in stdout.lines() {
        let fields: Vec<&str> = line.split(':').collect();
        if fields.is_empty() {
            continue;
        }

        let record_type = fields[0];
        match record_type {
            "sec" | "pub" => {
                if fields.len() > 4 {
                    current_key_id = Some(fields[4].to_string());
                }
                if fields.len() > 5 && !fields[5].is_empty() {
                    current_created = Some(fields[5].to_string());
                }
                if fields.len() > 6 && !fields[6].is_empty() {
                    current_expires = Some(fields[6].to_string());
                }
            }
            "uid" => {
                if let Some(ref kid) = current_key_id {
                    let user_id = if fields.len() > 9 {
                        fields[9].to_string()
                    } else {
                        kid.clone()
                    };

                    let email =
                        if let (Some(start), Some(end)) = (user_id.find('<'), user_id.find('>')) {
                            if start < end {
                                Some(user_id[start + 1..end].to_string())
                            } else {
                                None
                            }
                        } else {
                            None
                        };

                    keys.push(GpgKeyInfo {
                        key_id: kid.clone(),
                        user_id: user_id.clone(),
                        email,
                        created_at: current_created.clone(),
                        expires_at: current_expires.clone(),
                    });
                }
            }
            _ => {}
        }
    }

    Ok(keys)
}

/// List all SSH public keys found in ~/.ssh and via ssh-agent
pub fn list_ssh_keys() -> Result<Vec<SshKeyInfo>, AppError> {
    let mut keys = Vec::new();

    // 1. Check ~/.ssh directory for *.pub files
    let ssh_dir = if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME"))
    {
        Path::new(&home).join(".ssh")
    } else {
        Path::new(".").to_path_buf()
    };

    if ssh_dir.exists() && ssh_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&ssh_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("pub") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        let trimmed = content.trim();
                        let parts: Vec<&str> = trimmed.split_whitespace().collect();
                        if parts.len() >= 2 {
                            let key_type = parts[0].to_string();
                            let public_key = parts[1].to_string();
                            let comment = if parts.len() >= 3 {
                                Some(parts[2..].join(" "))
                            } else {
                                None
                            };

                            let priv_path = path.with_extension("");
                            let actual_path = if priv_path.exists() {
                                priv_path.to_string_lossy().to_string()
                            } else {
                                path.to_string_lossy().to_string()
                            };

                            keys.push(SshKeyInfo {
                                path: actual_path,
                                public_key,
                                key_type,
                                comment,
                                is_agent: false,
                            });
                        }
                    }
                }
            }
        }
    }

    // 2. Query ssh-add -L for loaded keys in agent
    if let Ok(output) = silent_command("ssh-add").arg("-L").output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.trim().split_whitespace().collect();
                if parts.len() >= 2 {
                    let key_type = parts[0].to_string();
                    let public_key = parts[1].to_string();
                    let comment = if parts.len() >= 3 {
                        Some(parts[2..].join(" "))
                    } else {
                        None
                    };

                    // Avoid duplicate if already found on disk
                    if !keys.iter().any(|k| k.public_key == public_key) {
                        keys.push(SshKeyInfo {
                            path: format!("ssh-agent:{}", comment.as_deref().unwrap_or(&key_type)),
                            public_key,
                            key_type,
                            comment,
                            is_agent: true,
                        });
                    }
                }
            }
        }
    }

    Ok(keys)
}

/// Read commit signing configuration for a repository (local or global)
pub fn get_signing_config(repo_path: &str) -> Result<SigningConfig, AppError> {
    // Check local repo config first
    let local_gpgsign = silent_git_command()
        .args(["config", "--local", "--get", "commit.gpgsign"])
        .current_dir(repo_path)
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

    let is_local_set = local_gpgsign
        .as_ref()
        .map(|s| !s.is_empty())
        .unwrap_or(false);

    let (scope, gpgsign_val) = if is_local_set {
        ("repo".to_string(), local_gpgsign.unwrap_or_default())
    } else {
        // Fall back to global config
        let global_val = silent_git_command()
            .args(["config", "--global", "--get", "commit.gpgsign"])
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();
        ("global".to_string(), global_val)
    };

    let enabled = gpgsign_val == "true" || gpgsign_val == "1" || gpgsign_val == "yes";

    let method_val = silent_git_command()
        .args(["config", "--get", "gpg.format"])
        .current_dir(repo_path)
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "openpgp".to_string());

    let method = if method_val == "ssh" {
        "ssh".to_string()
    } else {
        "gpg".to_string()
    };

    let key_id = silent_git_command()
        .args(["config", "--get", "user.signingkey"])
        .current_dir(repo_path)
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    Ok(SigningConfig {
        enabled,
        method,
        key_id,
        scope,
    })
}

/// Set commit signing configuration
pub fn set_signing_config(repo_path: &str, config: SigningConfig) -> Result<(), AppError> {
    let is_global = config.scope == "global";
    let scope_arg = if is_global { "--global" } else { "--local" };

    // 1. Set commit.gpgsign
    let sign_val = if config.enabled { "true" } else { "false" };
    let _ = silent_git_command()
        .args(["config", scope_arg, "commit.gpgsign", sign_val])
        .current_dir(repo_path)
        .output()?;

    // 2. Set gpg.format
    let format_val = if config.method == "ssh" {
        "ssh"
    } else {
        "openpgp"
    };
    let _ = silent_git_command()
        .args(["config", scope_arg, "gpg.format", format_val])
        .current_dir(repo_path)
        .output()?;

    // 3. Set user.signingkey if specified
    if !config.key_id.trim().is_empty() {
        let _ = silent_git_command()
            .args(["config", scope_arg, "user.signingkey", config.key_id.trim()])
            .current_dir(repo_path)
            .output()?;
    }

    Ok(())
}

/// Verify signature of a specific commit SHA using git log %G? format
pub fn verify_commit(repo_path: &str, sha: &str) -> Result<VerifyResult, AppError> {
    let clean_sha = sha.trim();
    if clean_sha.is_empty() {
        return Ok(VerifyResult::NoSignature);
    }

    // %G? = G (good), B (bad), U (good with untrusted cert), X (expired), Y (key expired), R (revoked), E (error), N (no signature)
    // %GK = Key used to sign
    // %GS = Signer name
    // %GF = Primary key fingerprint
    let format_str = "%G?%x00%GK%x00%GS%x00%GF";
    let output = silent_git_command()
        .args(["log", "-1", &format!("--format={}", format_str), clean_sha])
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Ok(VerifyResult::Error(format!(
            "Failed to verify commit: {}",
            stderr.trim()
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parts: Vec<&str> = stdout.trim().split('\0').collect();

    if parts.is_empty() {
        return Ok(VerifyResult::NoSignature);
    }

    let status_code = parts[0].trim();
    let key_id = if parts.len() > 1 && !parts[1].trim().is_empty() {
        Some(parts[1].trim().to_string())
    } else {
        None
    };
    let signer = if parts.len() > 2 && !parts[2].trim().is_empty() {
        parts[2].trim().to_string()
    } else {
        key_id
            .clone()
            .unwrap_or_else(|| "Unknown Signer".to_string())
    };

    match status_code {
        "G" => Ok(VerifyResult::Verified { signer, key_id }),
        "U" => Ok(VerifyResult::Verified {
            signer: format!("{} (untrusted key)", signer),
            key_id,
        }),
        "B" => Ok(VerifyResult::Unverified {
            reason: "Bad / Tampered signature".to_string(),
        }),
        "X" => Ok(VerifyResult::Unverified {
            reason: "Signature has expired".to_string(),
        }),
        "Y" => Ok(VerifyResult::Unverified {
            reason: "Signing key has expired".to_string(),
        }),
        "R" => Ok(VerifyResult::Unverified {
            reason: "Signing key has been revoked".to_string(),
        }),
        "E" => Ok(VerifyResult::Error(
            "Signature cannot be checked (missing key or GPG error)".to_string(),
        )),
        "N" | "" => Ok(VerifyResult::NoSignature),
        other => Ok(VerifyResult::Unverified {
            reason: format!("Signature verification status: {}", other),
        }),
    }
}
