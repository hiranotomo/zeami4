use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::SystemTime;

/// Represents a file system watch event that will be sent to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchEvent {
    /// Type of event
    pub kind: WatchEventKind,

    /// Affected file paths
    pub paths: Vec<PathBuf>,

    /// Timestamp when the event occurred
    pub timestamp: u64,

    /// Source target that generated this event
    pub source: String,

    /// Additional metadata
    pub metadata: Option<serde_json::Value>,
}

impl WatchEvent {
    /// Create a new watch event
    pub fn new(kind: WatchEventKind, paths: Vec<PathBuf>, source: impl Into<String>) -> Self {
        Self {
            kind,
            paths,
            timestamp: SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            source: source.into(),
            metadata: None,
        }
    }

    /// Add metadata to the event
    pub fn with_metadata(mut self, metadata: serde_json::Value) -> Self {
        self.metadata = Some(metadata);
        self
    }

    /// Check if this event is high priority
    pub fn is_high_priority(&self) -> bool {
        matches!(
            self.kind,
            WatchEventKind::ClaudeStateChanged | WatchEventKind::GitCommit
        )
    }

    /// Convert to Tauri event payload
    pub fn to_payload(&self) -> WatchEventPayload {
        WatchEventPayload {
            event_type: self.kind.to_string(),
            paths: self.paths.iter().map(|p| p.display().to_string()).collect(),
            timestamp: self.timestamp,
            source: self.source.clone(),
            metadata: self.metadata.clone(),
        }
    }
}

/// Types of file system events
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WatchEventKind {
    /// File or directory was created
    Created,

    /// File was modified
    Modified,

    /// File or directory was deleted
    Deleted,

    /// File or directory was renamed
    Renamed,

    /// Claude Code state changed (.claude/ directory)
    ClaudeStateChanged,

    /// Source code changed (requires test re-run)
    SourceChanged,

    /// Configuration file changed (requires reload)
    ConfigChanged,

    /// Git commit detected
    GitCommit,

    /// Metadata changed (permissions, ownership, etc.)
    MetadataChanged,

    /// Any other event
    Other,
}

impl WatchEventKind {
    /// Convert to string representation
    pub fn to_string(&self) -> String {
        match self {
            Self::Created => "created".to_string(),
            Self::Modified => "modified".to_string(),
            Self::Deleted => "deleted".to_string(),
            Self::Renamed => "renamed".to_string(),
            Self::ClaudeStateChanged => "claude_state_changed".to_string(),
            Self::SourceChanged => "source_changed".to_string(),
            Self::ConfigChanged => "config_changed".to_string(),
            Self::GitCommit => "git_commit".to_string(),
            Self::MetadataChanged => "metadata_changed".to_string(),
            Self::Other => "other".to_string(),
        }
    }

    /// Classify event based on path
    pub fn classify_by_path(base_kind: Self, path: &std::path::Path) -> Self {
        let path_str = path.to_string_lossy();

        // Claude Code state
        if path_str.contains("/.claude/") {
            return Self::ClaudeStateChanged;
        }

        // Git commits
        if path_str.contains("/.git/refs/heads/") || path_str.contains("/.git/HEAD") {
            return Self::GitCommit;
        }

        // Configuration files
        if path_str.ends_with(".toml")
            || path_str.ends_with(".json")
            || path_str.ends_with(".yaml")
            || path_str.ends_with(".yml")
            || path_str.ends_with(".env")
        {
            return Self::ConfigChanged;
        }

        // Source code
        if path_str.ends_with(".rs")
            || path_str.ends_with(".ts")
            || path_str.ends_with(".tsx")
            || path_str.ends_with(".js")
            || path_str.ends_with(".jsx")
        {
            return Self::SourceChanged;
        }

        base_kind
    }
}

/// Payload sent to the frontend via Tauri events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchEventPayload {
    pub event_type: String,
    pub paths: Vec<String>,
    pub timestamp: u64,
    pub source: String,
    pub metadata: Option<serde_json::Value>,
}

/// Batch of events for efficient transmission
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchEventBatch {
    pub events: Vec<WatchEvent>,
    pub batch_timestamp: u64,
    pub total_events: usize,
}

impl WatchEventBatch {
    /// Create a new batch from events
    pub fn new(events: Vec<WatchEvent>) -> Self {
        let total_events = events.len();
        Self {
            events,
            batch_timestamp: SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            total_events,
        }
    }

    /// Check if batch is empty
    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }

    /// Split high priority events from normal events
    pub fn split_by_priority(self) -> (Vec<WatchEvent>, Vec<WatchEvent>) {
        self.events
            .into_iter()
            .partition(|e| e.is_high_priority())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_event_creation() {
        let event = WatchEvent::new(
            WatchEventKind::Modified,
            vec![PathBuf::from("/test/file.rs")],
            "test-source",
        );

        assert_eq!(event.kind, WatchEventKind::Modified);
        assert_eq!(event.paths.len(), 1);
        assert_eq!(event.source, "test-source");
    }

    #[test]
    fn test_event_priority() {
        let high_priority = WatchEvent::new(
            WatchEventKind::ClaudeStateChanged,
            vec![PathBuf::from("/.claude/state.json")],
            "claude",
        );
        assert!(high_priority.is_high_priority());

        let normal_priority = WatchEvent::new(
            WatchEventKind::Modified,
            vec![PathBuf::from("/src/main.rs")],
            "src",
        );
        assert!(!normal_priority.is_high_priority());
    }

    #[test]
    fn test_event_classification() {
        let path = std::path::Path::new("/.claude/settings.json");
        let kind = WatchEventKind::classify_by_path(WatchEventKind::Modified, path);
        assert_eq!(kind, WatchEventKind::ClaudeStateChanged);

        let path = std::path::Path::new("/.git/refs/heads/main");
        let kind = WatchEventKind::classify_by_path(WatchEventKind::Modified, path);
        assert_eq!(kind, WatchEventKind::GitCommit);

        let path = std::path::Path::new("/src/main.rs");
        let kind = WatchEventKind::classify_by_path(WatchEventKind::Modified, path);
        assert_eq!(kind, WatchEventKind::SourceChanged);
    }

    #[test]
    fn test_batch_creation() {
        let events = vec![
            WatchEvent::new(
                WatchEventKind::Modified,
                vec![PathBuf::from("/test/1.rs")],
                "test",
            ),
            WatchEvent::new(
                WatchEventKind::Created,
                vec![PathBuf::from("/test/2.rs")],
                "test",
            ),
        ];

        let batch = WatchEventBatch::new(events);
        assert_eq!(batch.total_events, 2);
        assert!(!batch.is_empty());
    }

    #[test]
    fn test_batch_priority_split() {
        let events = vec![
            WatchEvent::new(
                WatchEventKind::ClaudeStateChanged,
                vec![PathBuf::from("/.claude/state.json")],
                "claude",
            ),
            WatchEvent::new(
                WatchEventKind::Modified,
                vec![PathBuf::from("/src/main.rs")],
                "src",
            ),
            WatchEvent::new(
                WatchEventKind::GitCommit,
                vec![PathBuf::from("/.git/refs/heads/main")],
                "git",
            ),
        ];

        let batch = WatchEventBatch::new(events);
        let (high, normal) = batch.split_by_priority();

        assert_eq!(high.len(), 2);
        assert_eq!(normal.len(), 1);
    }
}
