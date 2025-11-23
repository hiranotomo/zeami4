use crate::pty::PtySession;
use std::sync::Mutex;
use tauri::State;

/// PTY session state managed by Tauri
pub struct PtyState {
    pub session: Mutex<Option<PtySession>>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            session: Mutex::new(None),
        }
    }
}

/// Create a new PTY session
#[tauri::command]
pub async fn create_pty_session(
    state: State<'_, PtyState>,
    shell: Option<String>,
) -> Result<String, String> {
    let mut session_lock = state.session.lock().map_err(|e| e.to_string())?;

    // Close existing session if any
    if session_lock.is_some() {
        *session_lock = None;
    }

    // Create new PTY session
    let session = PtySession::new(shell).map_err(|e| e.to_string())?;
    *session_lock = Some(session);

    Ok("PTY session created successfully".to_string())
}

/// Write data to the PTY
#[tauri::command]
pub async fn write_pty(state: State<'_, PtyState>, data: String) -> Result<(), String> {
    let session_lock = state.session.lock().map_err(|e| e.to_string())?;

    if let Some(session) = session_lock.as_ref() {
        session.write(&data).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("No active PTY session".to_string())
    }
}

/// Close the PTY session
#[tauri::command]
pub async fn close_pty_session(state: State<'_, PtyState>) -> Result<(), String> {
    let mut session_lock = state.session.lock().map_err(|e| e.to_string())?;
    *session_lock = None;
    Ok(())
}
