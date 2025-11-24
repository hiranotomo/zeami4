/// Tauri commands for controlling the file watcher
///
/// These commands allow the frontend to start, stop, and query
/// the file watcher service.

use super::{
    config::{WatchConfig, WatchTarget},
    service::{WatcherService, WatcherStatsSnapshot},
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, State};

/// Global watcher state managed by Tauri
pub type WatcherState = Mutex<Option<WatcherService>>;

/// Start the file watcher with default configuration
#[tauri::command]
pub async fn start_watcher(
    app_handle: AppHandle,
    state: State<'_, WatcherState>,
) -> Result<String, String> {
    let mut watcher = state.lock().map_err(|e| e.to_string())?;

    if watcher.is_some() {
        return Err("Watcher is already running".to_string());
    }

    // Get project root from current directory
    let project_root = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;

    let mut service = WatcherService::new(app_handle, project_root);

    service
        .start()
        .map_err(|e| format!("Failed to start watcher: {}", e))?;

    *watcher = Some(service);

    Ok("Watcher started successfully".to_string())
}

/// Start the file watcher with custom configuration
#[tauri::command]
pub async fn start_watcher_with_config(
    app_handle: AppHandle,
    config: WatchConfigDto,
    state: State<'_, WatcherState>,
) -> Result<String, String> {
    let mut watcher = state.lock().map_err(|e| e.to_string())?;

    if watcher.is_some() {
        return Err("Watcher is already running".to_string());
    }

    let project_root = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;

    let watch_config = config.into_config();
    let mut service = WatcherService::with_config(app_handle, project_root, watch_config);

    service
        .start()
        .map_err(|e| format!("Failed to start watcher: {}", e))?;

    *watcher = Some(service);

    Ok("Watcher started with custom config".to_string())
}

/// Stop the file watcher
#[tauri::command]
pub async fn stop_watcher(state: State<'_, WatcherState>) -> Result<String, String> {
    let mut watcher = state.lock().map_err(|e| e.to_string())?;

    if let Some(mut service) = watcher.take() {
        service
            .stop()
            .map_err(|e| format!("Failed to stop watcher: {}", e))?;
        Ok("Watcher stopped successfully".to_string())
    } else {
        Err("Watcher is not running".to_string())
    }
}

/// Check if the watcher is running
#[tauri::command]
pub async fn is_watcher_running(state: State<'_, WatcherState>) -> Result<bool, String> {
    let watcher = state.lock().map_err(|e| e.to_string())?;
    Ok(watcher.as_ref().map_or(false, |w| w.is_running()))
}

/// Get watcher statistics
#[tauri::command]
pub async fn get_watcher_stats(
    state: State<'_, WatcherState>,
) -> Result<WatcherStatsSnapshot, String> {
    let watcher = state.lock().map_err(|e| e.to_string())?;

    watcher
        .as_ref()
        .map(|w| w.get_stats())
        .ok_or_else(|| "Watcher is not running".to_string())
}

/// Emit current statistics to the frontend
#[tauri::command]
pub async fn emit_watcher_stats(state: State<'_, WatcherState>) -> Result<String, String> {
    let watcher = state.lock().map_err(|e| e.to_string())?;

    if let Some(service) = watcher.as_ref() {
        service
            .emit_stats()
            .map_err(|e| format!("Failed to emit stats: {}", e))?;
        Ok("Stats emitted successfully".to_string())
    } else {
        Err("Watcher is not running".to_string())
    }
}

/// Data transfer object for watch configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchConfigDto {
    pub targets: Vec<WatchTargetDto>,
    pub debounce_ms: u64,
    pub recursive: bool,
    pub event_buffer_size: usize,
    pub verbose: bool,
}

impl WatchConfigDto {
    fn into_config(self) -> WatchConfig {
        WatchConfig {
            targets: self.targets.into_iter().map(|t| t.into_target()).collect(),
            debounce_ms: self.debounce_ms,
            recursive: self.recursive,
            event_buffer_size: self.event_buffer_size,
            verbose: self.verbose,
        }
    }
}

/// Data transfer object for watch target
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchTargetDto {
    pub path: String,
    pub description: String,
    pub recursive: bool,
    pub priority: u8,
}

impl WatchTargetDto {
    fn into_target(self) -> WatchTarget {
        WatchTarget {
            path: PathBuf::from(self.path),
            description: self.description,
            recursive: self.recursive,
            priority: self.priority,
        }
    }
}

/// Preset configurations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WatcherPreset {
    Default,
    Development,
    Production,
    Testing,
}

/// Get a preset configuration
#[tauri::command]
pub async fn get_watcher_preset(preset: WatcherPreset) -> Result<WatchConfigDto, String> {
    let config = match preset {
        WatcherPreset::Default => WatchConfig::default(),
        WatcherPreset::Development => WatchConfig {
            debounce_ms: 50, // Faster response in dev
            verbose: true,
            ..Default::default()
        },
        WatcherPreset::Production => WatchConfig {
            debounce_ms: 200, // More conservative
            verbose: false,
            ..Default::default()
        },
        WatcherPreset::Testing => WatchConfig {
            targets: vec![WatchTarget::src_dir(), WatchTarget::new("tests", "Test files")],
            debounce_ms: 100,
            ..Default::default()
        },
    };

    Ok(WatchConfigDto {
        targets: config
            .targets
            .into_iter()
            .map(|t| WatchTargetDto {
                path: t.path.to_string_lossy().to_string(),
                description: t.description,
                recursive: t.recursive,
                priority: t.priority,
            })
            .collect(),
        debounce_ms: config.debounce_ms,
        recursive: config.recursive,
        event_buffer_size: config.event_buffer_size,
        verbose: config.verbose,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_watch_config_dto_conversion() {
        let dto = WatchConfigDto {
            targets: vec![WatchTargetDto {
                path: ".claude".to_string(),
                description: "Claude dir".to_string(),
                recursive: true,
                priority: 10,
            }],
            debounce_ms: 100,
            recursive: true,
            event_buffer_size: 1000,
            verbose: false,
        };

        let config = dto.into_config();
        assert_eq!(config.debounce_ms, 100);
        assert_eq!(config.targets.len(), 1);
        assert_eq!(config.targets[0].priority, 10);
    }
}
