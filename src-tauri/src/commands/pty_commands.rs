use crate::pty::PtySession;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{State, Window};
use uuid::Uuid;

/// PTY session state managed by Tauri
/// Maintains multiple sessions identified by UUID
pub struct PtyState {
    pub sessions: Mutex<HashMap<String, PtySession>>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

/// Response for session creation
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSessionResponse {
    pub session_id: String,
}

/// Create a new PTY session
#[tauri::command]
pub async fn create_pty_session(
    state: State<'_, PtyState>,
    window: Window,
    shell: Option<String>,
    rows: u16,
    cols: u16,
) -> Result<CreateSessionResponse, String> {
    // Generate unique session ID
    let session_id = Uuid::new_v4().to_string();

    // Create new PTY session
    let session = PtySession::new(shell, rows, cols, window, session_id.clone())
        .map_err(|e| format!("Failed to create PTY session: {}", e))?;

    // Store session
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Failed to lock sessions: {}", e))?;

    sessions.insert(session_id.clone(), session);

    Ok(CreateSessionResponse { session_id })
}

/// Write data to a PTY session
#[tauri::command]
pub async fn write_to_pty(
    state: State<'_, PtyState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Failed to lock sessions: {}", e))?;

    if let Some(session) = sessions.get(&session_id) {
        session
            .write(&data)
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

/// Resize a PTY session
#[tauri::command]
pub async fn resize_pty(
    state: State<'_, PtyState>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Failed to lock sessions: {}", e))?;

    if let Some(session) = sessions.get(&session_id) {
        session
            .resize(rows, cols)
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}

/// Close a PTY session
#[tauri::command]
pub async fn close_pty_session(
    state: State<'_, PtyState>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| format!("Failed to lock sessions: {}", e))?;

    if sessions.remove(&session_id).is_some() {
        Ok(())
    } else {
        Err(format!("Session not found: {}", session_id))
    }
}
