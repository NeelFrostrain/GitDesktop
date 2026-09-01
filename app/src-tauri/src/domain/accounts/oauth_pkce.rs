use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::Rng;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

static PKCE_STORAGE: OnceLock<Mutex<HashMap<String, PkceSession>>> = OnceLock::new();
static RECENTLY_USED: OnceLock<Mutex<HashMap<String, (PkceSession, i64)>>> = OnceLock::new();

fn get_storage() -> &'static Mutex<HashMap<String, PkceSession>> {
    PKCE_STORAGE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn get_recently_used() -> &'static Mutex<HashMap<String, (PkceSession, i64)>> {
    RECENTLY_USED.get_or_init(|| Mutex::new(HashMap::new()))
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
const PKCE_SESSION_TTL_SECONDS: i64 = 15 * 60;

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
    let now = chrono::Utc::now().timestamp();
    let clean_state = state.trim();

    // 1. Check active storage
    if let Ok(mut storage) = get_storage().lock() {
        if let Some(session) = storage.remove(clean_state) {
            let is_fresh = now - session.created_at <= PKCE_SESSION_TTL_SECONDS;
            if is_fresh && (provider.is_empty() || session.provider.eq_ignore_ascii_case(provider)) {
                if let Ok(mut rec) = get_recently_used().lock() {
                    rec.insert(clean_state.to_string(), (session.clone(), now));
                }
                return Some(session);
            }
        }
    }

    // 2. Check recently used cache (handles duplicate / race condition between loopback & deep link)
    if let Ok(rec) = get_recently_used().lock() {
        if let Some((session, used_at)) = rec.get(clean_state) {
            if now - used_at <= 60 && (provider.is_empty() || session.provider.eq_ignore_ascii_case(provider)) {
                return Some(session.clone());
            }
        }
    }

    // 3. Resilient fallback: find most recent pending session for this provider
    if let Ok(mut storage) = get_storage().lock() {
        let matching_key = storage
            .iter()
            .filter(|(_, s)| {
                let is_fresh = now - s.created_at <= PKCE_SESSION_TTL_SECONDS;
                is_fresh && (provider.is_empty() || s.provider.eq_ignore_ascii_case(provider))
            })
            .max_by_key(|(_, s)| s.created_at)
            .map(|(k, _)| k.clone());

        if let Some(key) = matching_key {
            if let Some(session) = storage.remove(&key) {
                if let Ok(mut rec) = get_recently_used().lock() {
                    rec.insert(clean_state.to_string(), (session.clone(), now));
                }
                return Some(session);
            }
        }
    }

    None
}
