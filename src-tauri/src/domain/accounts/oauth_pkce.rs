use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::Rng;
use sha2::{Digest, Sha256};
use std::sync::{Mutex, OnceLock};
use std::collections::HashMap;

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
    pub created_at: i64,
}

pub fn generate_pkce_session(provider: &str, instance_url: &str) -> (String, String, String) {
    let mut rng = rand::thread_rng();

    // 1. Generate 64-byte random string for verifier
    let verifier_bytes: Vec<u8> = (0..64)
        .map(|_| rng.gen_range(b'A'..=b'z'))
        .collect();
    let verifier = String::from_utf8_lossy(&verifier_bytes).to_string();

    // 2. Compute SHA-256 and base64url-encode for challenge
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge_hash = hasher.finalize();
    let challenge = URL_SAFE_NO_PAD.encode(challenge_hash);

    // 3. Generate random state string
    let state_bytes: Vec<u8> = (0..32)
        .map(|_| rng.gen_range(b'a'..=b'z'))
        .collect();
    let state = String::from_utf8_lossy(&state_bytes).to_string();

    let session = PkceSession {
        state: state.clone(),
        verifier: verifier.clone(),
        provider: provider.to_string(),
        instance_url: instance_url.to_string(),
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
