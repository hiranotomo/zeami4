/**
 * Configuration Module
 *
 * Handles settings storage, validation, and keychain integration.
 */

pub mod storage;
pub mod keychain;
pub mod migration;
pub mod backup;

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

// ============================================================================
// Settings Structures
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub github: GitHubSettings,
    pub git: GitSettings,
    pub terminal: TerminalSettings,
    pub ui: UISettings,
    pub workflow: WorkflowSettings,
    pub claude: ClaudeSettings,
    pub test: TestSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubSettings {
    pub enabled: bool,
    // Note: token is stored in Keychain, not in this struct when serialized
    #[serde(skip_serializing)]
    pub token: String,
    pub repository: String,
    pub default_branch: String,
    pub api_url: String,
    pub timeout: u32,
    pub auto_link_issues: bool,
    pub auto_create_branch: bool,
    pub branch_prefix: String,
    pub pr_template: Option<String>,
    pub auto_assign_reviewers: bool,
    pub default_reviewers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitSettings {
    pub user_name: String,
    pub user_email: String,
    pub sign_commits: bool,
    pub gpg_key_id: Option<String>,
    pub commit_template: String,
    pub default_branch: String,
    pub auto_fetch: bool,
    pub fetch_interval: u32,
    pub merge_strategy: String,
    pub auto_clean_branches: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSettings {
    pub shell: String,
    pub custom_shell_path: Option<String>,
    pub theme: String,
    pub font_size: u32,
    pub font_family: String,
    pub line_height: f32,
    pub scrollback: u32,
    pub cursor_blink: bool,
    pub cursor_style: String,
    pub enable_bell_sound: bool,
    pub enable_web_links: bool,
    pub enable_copy_on_select: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UISettings {
    pub theme: String,
    pub accent_color: String,
    pub sidebar_position: String,
    pub sidebar_width: u32,
    pub compact_mode: bool,
    pub show_notifications: bool,
    pub notification_sound: bool,
    pub notification_position: String,
    pub show_welcome_screen: bool,
    pub confirm_before_quit: bool,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowSettings {
    pub auto_commit: bool,
    pub auto_commit_interval: u32,
    pub auto_commit_message: String,
    pub auto_run_tests: bool,
    pub auto_run_tests_pattern: String,
    pub test_command: String,
    pub auto_build: bool,
    pub build_command: String,
    pub auto_close_issue_on_pr: bool,
    pub auto_sync_progress: bool,
    pub sync_progress_interval: u32,
    pub run_lint_on_commit: bool,
    pub run_format_on_commit: bool,
    pub run_tests_on_commit: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSettings {
    // Note: api_key is stored in Keychain
    #[serde(skip_serializing)]
    pub api_key: String,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: u32,
    pub system_prompt: String,
    pub custom_instructions: String,
    pub include_project_context: bool,
    pub max_context_files: u32,
    pub exclude_patterns: Vec<String>,
    pub enable_streaming: bool,
    pub enable_caching: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestSettings {
    pub framework: String,
    pub config_path: String,
    pub test_match: Vec<String>,
    pub collect_coverage: bool,
    pub coverage_threshold: u32,
    pub coverage_report_formats: Vec<String>,
    pub max_concurrency: u32,
    pub timeout: u32,
    pub retries: u32,
    pub base_url: String,
    pub headless: bool,
    pub slow_mo: u32,
}

// ============================================================================
// Configuration Metadata
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigMetadata {
    pub schema_version: u32,
    pub last_modified: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigFile {
    pub version: String,
    pub settings: Settings,
    pub metadata: ConfigMetadata,
}

// ============================================================================
// Constants
// ============================================================================

pub const CURRENT_SCHEMA_VERSION: u32 = 1;
pub const CONFIG_DIR: &str = ".zeami";
pub const CONFIG_FILE: &str = "config.json";
pub const KEYCHAIN_SERVICE: &str = "com.zeami.settings";

// ============================================================================
// Default Settings
// ============================================================================

impl Default for Settings {
    fn default() -> Self {
        Self {
            github: GitHubSettings::default(),
            git: GitSettings::default(),
            terminal: TerminalSettings::default(),
            ui: UISettings::default(),
            workflow: WorkflowSettings::default(),
            claude: ClaudeSettings::default(),
            test: TestSettings::default(),
        }
    }
}

impl Default for GitHubSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            token: String::new(),
            repository: String::new(),
            default_branch: "main".to_string(),
            api_url: "https://api.github.com".to_string(),
            timeout: 30000,
            auto_link_issues: true,
            auto_create_branch: true,
            branch_prefix: "issue-".to_string(),
            pr_template: None,
            auto_assign_reviewers: false,
            default_reviewers: Vec::new(),
        }
    }
}

impl Default for GitSettings {
    fn default() -> Self {
        Self {
            user_name: String::new(),
            user_email: String::new(),
            sign_commits: false,
            gpg_key_id: None,
            commit_template: String::new(),
            default_branch: "main".to_string(),
            auto_fetch: true,
            fetch_interval: 300,
            merge_strategy: "merge".to_string(),
            auto_clean_branches: true,
        }
    }
}

impl Default for TerminalSettings {
    fn default() -> Self {
        Self {
            shell: "zsh".to_string(),
            custom_shell_path: None,
            theme: "dark".to_string(),
            font_size: 14,
            font_family: "Monaco, Menlo, Consolas, monospace".to_string(),
            line_height: 1.2,
            scrollback: 10000,
            cursor_blink: true,
            cursor_style: "block".to_string(),
            enable_bell_sound: false,
            enable_web_links: true,
            enable_copy_on_select: false,
        }
    }
}

impl Default for UISettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            accent_color: "#3b82f6".to_string(),
            sidebar_position: "left".to_string(),
            sidebar_width: 300,
            compact_mode: false,
            show_notifications: true,
            notification_sound: false,
            notification_position: "top-right".to_string(),
            show_welcome_screen: true,
            confirm_before_quit: false,
            language: "en".to_string(),
        }
    }
}

impl Default for WorkflowSettings {
    fn default() -> Self {
        Self {
            auto_commit: false,
            auto_commit_interval: 300,
            auto_commit_message: "WIP: Auto-save".to_string(),
            auto_run_tests: false,
            auto_run_tests_pattern: "**/*.test.{ts,tsx,js,jsx}".to_string(),
            test_command: "npm test".to_string(),
            auto_build: false,
            build_command: "npm run build".to_string(),
            auto_close_issue_on_pr: false,
            auto_sync_progress: true,
            sync_progress_interval: 600,
            run_lint_on_commit: true,
            run_format_on_commit: true,
            run_tests_on_commit: false,
        }
    }
}

impl Default for ClaudeSettings {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: "claude-sonnet-4-5-20250929".to_string(),
            temperature: 1.0,
            max_tokens: 8192,
            system_prompt: String::new(),
            custom_instructions: String::new(),
            include_project_context: true,
            max_context_files: 20,
            exclude_patterns: vec![
                "node_modules/**".to_string(),
                "dist/**".to_string(),
                "build/**".to_string(),
                ".git/**".to_string(),
            ],
            enable_streaming: true,
            enable_caching: true,
        }
    }
}

impl Default for TestSettings {
    fn default() -> Self {
        Self {
            framework: "jest".to_string(),
            config_path: String::new(),
            test_match: vec![
                "**/*.test.{ts,tsx,js,jsx}".to_string(),
                "**/*.spec.{ts,tsx,js,jsx}".to_string(),
            ],
            collect_coverage: true,
            coverage_threshold: 80,
            coverage_report_formats: vec!["text".to_string(), "html".to_string()],
            max_concurrency: 4,
            timeout: 30000,
            retries: 0,
            base_url: "http://localhost:3000".to_string(),
            headless: true,
            slow_mo: 0,
        }
    }
}
