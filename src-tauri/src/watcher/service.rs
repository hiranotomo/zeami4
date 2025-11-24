use super::{
    config::{WatchConfig, WatchTarget},
    events::{WatchEvent, WatchEventBatch, WatchEventKind},
    filter::EventFilter,
};
use anyhow::{Context, Result};
use notify_debouncer_full::{
    new_debouncer,
    notify::{RecursiveMode, Watcher},
    DebounceEventResult, Debouncer, FileIdMap,
};
use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Manager};
use tokio::sync::mpsc;

/// Tauri event name for file system changes
pub const FS_EVENT_NAME: &str = "fs-watch-event";

/// Tauri event name for watcher errors
pub const FS_ERROR_EVENT_NAME: &str = "fs-watch-error";

/// Tauri event name for watcher statistics
pub const FS_STATS_EVENT_NAME: &str = "fs-watch-stats";

/// File watcher service for monitoring file system changes
pub struct WatcherService {
    /// Configuration
    config: WatchConfig,

    /// Event filter
    filter: EventFilter,

    /// Project root directory
    project_root: PathBuf,

    /// Tauri app handle for emitting events
    app_handle: AppHandle,

    /// Whether the watcher is running
    running: Arc<AtomicBool>,

    /// Statistics
    stats: Arc<WatcherStats>,

    /// Event sender channel
    event_tx: Option<mpsc::UnboundedSender<WatchEventBatch>>,

    /// Active debouncer (kept alive)
    #[allow(dead_code)]
    debouncer: Option<Debouncer<notify::RecommendedWatcher, FileIdMap>>,
}

impl WatcherService {
    /// Create a new watcher service
    pub fn new(app_handle: AppHandle, project_root: PathBuf) -> Self {
        Self {
            config: WatchConfig::default(),
            filter: EventFilter::new(),
            project_root,
            app_handle,
            running: Arc::new(AtomicBool::new(false)),
            stats: Arc::new(WatcherStats::default()),
            event_tx: None,
            debouncer: None,
        }
    }

    /// Create with custom configuration
    pub fn with_config(app_handle: AppHandle, project_root: PathBuf, config: WatchConfig) -> Self {
        Self {
            config,
            filter: EventFilter::new(),
            project_root,
            app_handle,
            running: Arc::new(AtomicBool::new(false)),
            stats: Arc::new(WatcherStats::default()),
            event_tx: None,
            debouncer: None,
        }
    }

    /// Set custom event filter
    pub fn with_filter(mut self, filter: EventFilter) -> Self {
        self.filter = filter;
        self
    }

    /// Start watching file system
    pub fn start(&mut self) -> Result<()> {
        if self.running.load(Ordering::SeqCst) {
            return Err(anyhow::anyhow!("Watcher is already running"));
        }

        // Validate configuration
        self.config
            .validate()
            .context("Invalid watcher configuration")?;

        // Create event channel
        let (tx, mut rx) = mpsc::unbounded_channel::<WatchEventBatch>();
        self.event_tx = Some(tx.clone());

        // Clone for closure
        let app_handle = self.app_handle.clone();
        let stats = self.stats.clone();
        let running = self.running.clone();

        // Spawn event handler task
        tokio::spawn(async move {
            while let Some(batch) = rx.recv().await {
                if !batch.is_empty() {
                    // Split by priority
                    let (high_priority, normal_priority) = batch.split_by_priority();

                    // Send high priority events immediately
                    for event in high_priority {
                        if let Err(e) = app_handle.emit_all(FS_EVENT_NAME, event.to_payload()) {
                            eprintln!("[Watcher] Failed to emit high priority event: {}", e);
                        }
                        stats.events_emitted.fetch_add(1, Ordering::Relaxed);
                    }

                    // Batch normal priority events
                    if !normal_priority.is_empty() {
                        for event in normal_priority {
                            if let Err(e) = app_handle.emit_all(FS_EVENT_NAME, event.to_payload())
                            {
                                eprintln!("[Watcher] Failed to emit event: {}", e);
                            }
                            stats.events_emitted.fetch_add(1, Ordering::Relaxed);
                        }
                    }
                }
            }

            running.store(false, Ordering::SeqCst);
        });

        // Create debouncer
        let debounce_duration = self.config.debounce_duration();
        let filter = self.filter.clone();
        let stats_clone = self.stats.clone();
        let project_root = self.project_root.clone();

        let mut debouncer = new_debouncer(
            debounce_duration,
            None,
            move |result: DebounceEventResult| {
                stats_clone.raw_events.fetch_add(1, Ordering::Relaxed);

                match result {
                    Ok(events) => {
                        let mut watch_events = Vec::new();

                        for event in events {
                            stats_clone
                                .processed_events
                                .fetch_add(1, Ordering::Relaxed);

                            // Filter events
                            let paths: Vec<PathBuf> = event
                                .paths
                                .into_iter()
                                .filter(|p| filter.should_watch(p))
                                .collect();

                            if paths.is_empty() {
                                stats_clone.filtered_events.fetch_add(1, Ordering::Relaxed);
                                continue;
                            }

                            // Determine event kind
                            let base_kind = match event.kind {
                                notify::EventKind::Create(_) => WatchEventKind::Created,
                                notify::EventKind::Modify(_) => WatchEventKind::Modified,
                                notify::EventKind::Remove(_) => WatchEventKind::Deleted,
                                notify::EventKind::Access(_) => continue, // Skip access events
                                notify::EventKind::Other => WatchEventKind::Other,
                                _ => WatchEventKind::Other,
                            };

                            // Classify by path
                            let first_path = &paths[0];
                            let kind = WatchEventKind::classify_by_path(base_kind, first_path);

                            // Determine source
                            let source = Self::determine_source(first_path, &project_root);

                            let watch_event = WatchEvent::new(kind, paths, source);
                            watch_events.push(watch_event);
                        }

                        if !watch_events.is_empty() {
                            let batch = WatchEventBatch::new(watch_events);
                            if let Err(e) = tx.send(batch) {
                                eprintln!("[Watcher] Failed to send event batch: {}", e);
                            }
                        }
                    }
                    Err(errors) => {
                        for error in errors {
                            stats_clone.errors.fetch_add(1, Ordering::Relaxed);
                            eprintln!("[Watcher] Error: {:?}", error);
                        }
                    }
                }
            },
        )
        .context("Failed to create debouncer")?;

        // Watch all targets
        for target in &self.config.targets {
            let path = target.resolve_path(&self.project_root);

            if !path.exists() {
                eprintln!("[Watcher] Warning: Path does not exist: {:?}", path);
                continue;
            }

            let mode = if target.recursive {
                RecursiveMode::Recursive
            } else {
                RecursiveMode::NonRecursive
            };

            debouncer
                .watcher()
                .watch(&path, mode)
                .with_context(|| format!("Failed to watch path: {:?}", path))?;

            println!(
                "[Watcher] Watching: {:?} (recursive: {}, priority: {})",
                path, target.recursive, target.priority
            );
        }

        self.debouncer = Some(debouncer);
        self.running.store(true, Ordering::SeqCst);

        println!("[Watcher] Started successfully");
        Ok(())
    }

    /// Stop watching
    pub fn stop(&mut self) -> Result<()> {
        if !self.running.load(Ordering::SeqCst) {
            return Ok(());
        }

        self.running.store(false, Ordering::SeqCst);
        self.debouncer = None;
        self.event_tx = None;

        println!("[Watcher] Stopped");
        Ok(())
    }

    /// Check if watcher is running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Get statistics
    pub fn get_stats(&self) -> WatcherStatsSnapshot {
        self.stats.snapshot()
    }

    /// Emit statistics to frontend
    pub fn emit_stats(&self) -> Result<()> {
        let snapshot = self.get_stats();
        self.app_handle
            .emit_all(FS_STATS_EVENT_NAME, snapshot)
            .context("Failed to emit stats")?;
        Ok(())
    }

    /// Determine source from path
    fn determine_source(path: &Path, project_root: &Path) -> String {
        let path_str = path.to_string_lossy();

        if path_str.contains("/.claude/") {
            "claude".to_string()
        } else if path_str.contains("/.git/") {
            "git".to_string()
        } else if path_str.contains("/src/") {
            "source".to_string()
        } else if path_str.contains("/tests/") {
            "tests".to_string()
        } else {
            "project".to_string()
        }
    }
}

impl Drop for WatcherService {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

/// Statistics for the watcher
#[derive(Debug, Default)]
pub struct WatcherStats {
    /// Total raw events received
    pub raw_events: AtomicU64,

    /// Events processed after debouncing
    pub processed_events: AtomicU64,

    /// Events filtered out
    pub filtered_events: AtomicU64,

    /// Events emitted to frontend
    pub events_emitted: AtomicU64,

    /// Errors encountered
    pub errors: AtomicU64,
}

impl WatcherStats {
    /// Get a snapshot of current stats
    pub fn snapshot(&self) -> WatcherStatsSnapshot {
        WatcherStatsSnapshot {
            raw_events: self.raw_events.load(Ordering::Relaxed),
            processed_events: self.processed_events.load(Ordering::Relaxed),
            filtered_events: self.filtered_events.load(Ordering::Relaxed),
            events_emitted: self.events_emitted.load(Ordering::Relaxed),
            errors: self.errors.load(Ordering::Relaxed),
        }
    }

    /// Reset all statistics
    pub fn reset(&self) {
        self.raw_events.store(0, Ordering::Relaxed);
        self.processed_events.store(0, Ordering::Relaxed);
        self.filtered_events.store(0, Ordering::Relaxed);
        self.events_emitted.store(0, Ordering::Relaxed);
        self.errors.store(0, Ordering::Relaxed);
    }
}

/// Snapshot of watcher statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WatcherStatsSnapshot {
    pub raw_events: u64,
    pub processed_events: u64,
    pub filtered_events: u64,
    pub events_emitted: u64,
    pub errors: u64,
}

impl WatcherStatsSnapshot {
    /// Calculate filter efficiency (percentage of events filtered)
    pub fn filter_efficiency(&self) -> f64 {
        if self.raw_events == 0 {
            0.0
        } else {
            (self.filtered_events as f64 / self.raw_events as f64) * 100.0
        }
    }

    /// Calculate throughput (events emitted / processed)
    pub fn throughput(&self) -> f64 {
        if self.processed_events == 0 {
            0.0
        } else {
            (self.events_emitted as f64 / self.processed_events as f64) * 100.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stats_snapshot() {
        let stats = WatcherStats::default();
        stats.raw_events.store(100, Ordering::Relaxed);
        stats.filtered_events.store(60, Ordering::Relaxed);
        stats.processed_events.store(40, Ordering::Relaxed);
        stats.events_emitted.store(35, Ordering::Relaxed);

        let snapshot = stats.snapshot();
        assert_eq!(snapshot.raw_events, 100);
        assert_eq!(snapshot.filtered_events, 60);

        let efficiency = snapshot.filter_efficiency();
        assert_eq!(efficiency, 60.0);

        let throughput = snapshot.throughput();
        assert_eq!(throughput, 87.5);
    }

    #[test]
    fn test_determine_source() {
        let root = PathBuf::from("/project");

        let path = PathBuf::from("/project/.claude/settings.json");
        assert_eq!(WatcherService::determine_source(&path, &root), "claude");

        let path = PathBuf::from("/project/.git/refs/heads/main");
        assert_eq!(WatcherService::determine_source(&path, &root), "git");

        let path = PathBuf::from("/project/src/main.rs");
        assert_eq!(WatcherService::determine_source(&path, &root), "source");
    }
}
