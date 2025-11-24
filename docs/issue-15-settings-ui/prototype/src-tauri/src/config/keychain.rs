/**
 * macOS Keychain Integration
 *
 * Securely stores secrets (GitHub tokens, API keys) in macOS Keychain.
 */

use anyhow::{Context, Result};
use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

use super::KEYCHAIN_SERVICE;

/// Store a secret in the macOS Keychain
pub fn store_secret(account: &str, secret: &str) -> Result<()> {
    set_generic_password(KEYCHAIN_SERVICE, account, secret.as_bytes())
        .with_context(|| format!("Failed to store secret for account: {}", account))?;

    Ok(())
}

/// Retrieve a secret from the macOS Keychain
pub fn retrieve_secret(account: &str) -> Result<String> {
    let password_bytes = get_generic_password(KEYCHAIN_SERVICE, account)
        .with_context(|| format!("Failed to retrieve secret for account: {}", account))?;

    let password = String::from_utf8(password_bytes.to_vec())
        .with_context(|| "Secret is not valid UTF-8")?;

    Ok(password)
}

/// Delete a secret from the macOS Keychain
pub fn delete_secret(account: &str) -> Result<()> {
    delete_generic_password(KEYCHAIN_SERVICE, account)
        .with_context(|| format!("Failed to delete secret for account: {}", account))?;

    Ok(())
}

/// Check if a secret exists in the Keychain
pub fn secret_exists(account: &str) -> bool {
    get_generic_password(KEYCHAIN_SERVICE, account).is_ok()
}

// ============================================================================
// Secret Account Names
// ============================================================================

pub const GITHUB_TOKEN_ACCOUNT: &str = "github.token";
pub const CLAUDE_API_KEY_ACCOUNT: &str = "claude.apiKey";

// ============================================================================
// High-Level Helper Functions
// ============================================================================

/// Store GitHub token in Keychain
pub fn store_github_token(token: &str) -> Result<()> {
    store_secret(GITHUB_TOKEN_ACCOUNT, token)
}

/// Retrieve GitHub token from Keychain
pub fn retrieve_github_token() -> Result<String> {
    retrieve_secret(GITHUB_TOKEN_ACCOUNT)
}

/// Delete GitHub token from Keychain
pub fn delete_github_token() -> Result<()> {
    delete_secret(GITHUB_TOKEN_ACCOUNT)
}

/// Store Claude API key in Keychain
pub fn store_claude_api_key(api_key: &str) -> Result<()> {
    store_secret(CLAUDE_API_KEY_ACCOUNT, api_key)
}

/// Retrieve Claude API key from Keychain
pub fn retrieve_claude_api_key() -> Result<String> {
    retrieve_secret(CLAUDE_API_KEY_ACCOUNT)
}

/// Delete Claude API key from Keychain
pub fn delete_claude_api_key() -> Result<()> {
    delete_secret(CLAUDE_API_KEY_ACCOUNT)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_store_and_retrieve_secret() {
        let account = "test.secret";
        let secret = "test_secret_value_12345";

        // Store secret
        store_secret(account, secret).unwrap();

        // Retrieve secret
        let retrieved = retrieve_secret(account).unwrap();
        assert_eq!(retrieved, secret);

        // Clean up
        delete_secret(account).unwrap();
    }

    #[test]
    fn test_secret_exists() {
        let account = "test.exists";
        let secret = "test_value";

        // Should not exist initially
        assert!(!secret_exists(account));

        // Store secret
        store_secret(account, secret).unwrap();

        // Should exist now
        assert!(secret_exists(account));

        // Clean up
        delete_secret(account).unwrap();

        // Should not exist after deletion
        assert!(!secret_exists(account));
    }

    #[test]
    fn test_github_token_helpers() {
        let token = "ghp_test_token_1234567890";

        // Store token
        store_github_token(token).unwrap();

        // Retrieve token
        let retrieved = retrieve_github_token().unwrap();
        assert_eq!(retrieved, token);

        // Clean up
        delete_github_token().unwrap();
    }

    #[test]
    fn test_claude_api_key_helpers() {
        let api_key = "sk-test-api-key-1234567890";

        // Store API key
        store_claude_api_key(api_key).unwrap();

        // Retrieve API key
        let retrieved = retrieve_claude_api_key().unwrap();
        assert_eq!(retrieved, api_key);

        // Clean up
        delete_claude_api_key().unwrap();
    }
}
