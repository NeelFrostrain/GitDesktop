use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::Rng;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

static PKCE_STORAGE: OnceLock<Mutex<HashMap<String, PkceSession>>> = OnceLock::new();

fn get_storage() -> &'static Mutex<HashMap<String, PkceSession>> {
    PKCE_STORAGE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Clone, Debug)]
pub struct PkceSession {
    pub state: String,
    pub verifier: String,
    pub provider: String,
    pub instance_url: String,
    pub redirect_uri: String,
    pub created_at: i64,
}

const PKCE_CHARS: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
const PKCE_SESSION_TTL_SECONDS: i64 = 10 * 60;

pub fn generate_pkce_session(
    provider: &str,
    instance_url: &str,
    redirect_uri: &str,
) -> (String, String, String) {
    let mut rng = rand::thread_rng();

    // 1. Generate 64-character RFC 7636 compliant verifier [a-zA-Z0-9_.~-]
    let verifier: String = (0..64)
        .map(|_| {
            let idx = rng.gen_range(0..PKCE_CHARS.len());
            PKCE_CHARS[idx] as char
        })
        .collect();

    // 2. Compute SHA-256 and base64url-encode for challenge
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge_hash = hasher.finalize();
    let challenge = URL_SAFE_NO_PAD.encode(challenge_hash);

    // 3. Generate random state string
    let state: String = (0..32)
        .map(|_| {
            let idx = rng.gen_range(0..PKCE_CHARS.len());
            PKCE_CHARS[idx] as char
        })
        .collect();

    let session = PkceSession {
        state: state.clone(),
        verifier: verifier.clone(),
        provider: provider.to_string(),
        instance_url: instance_url.to_string(),
        redirect_uri: redirect_uri.to_string(),
        created_at: chrono::Utc::now().timestamp(),
    };

    if let Ok(mut storage) = get_storage().lock() {
        storage.insert(state.clone(), session);
    }

    (state, challenge, verifier)
}

pub fn take_pkce_session(state: &str) -> Option<PkceSession> {
    if let Ok(mut storage) = get_storage().lock() {
        storage.remove(state)
    } else {
        None
    }
}

pub fn take_valid_pkce_session(state: &str, provider: &str) -> Option<PkceSession> {
    let session = take_pkce_session(state)?;
    let is_fresh = chrono::Utc::now().timestamp() - session.created_at <= PKCE_SESSION_TTL_SECONDS;
    if is_fresh && session.provider.eq_ignore_ascii_case(provider) {
        Some(session)
    } else {
        None
    }
}
