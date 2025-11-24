/// File system watcher module for Zeami
///
/// This module provides comprehensive file watching capabilities with:
/// - Multi-path watching (.claude/, src/, .git/)
/// - Intelligent event filtering and debouncing
/// - Tauri event system integration
/// - Performance optimization for large directories
/// - Error recovery and resilience

pub mod commands;
pub mod config;
pub mod events;
pub mod filter;
pub mod service;

pub use commands::{WatcherState, WatchConfigDto, WatchTargetDto, WatcherPreset};
pub use config::{WatchConfig, WatchTarget};
pub use events::{WatchEvent, WatchEventKind, WatchEventPayload};
pub use filter::{EventFilter, FilterRule};
pub use service::{WatcherService, WatcherStatsSnapshot};

#[cfg(test)]
mod tests;
