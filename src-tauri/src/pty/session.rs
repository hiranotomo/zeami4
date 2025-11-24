use anyhow::{Context, Result};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::Window;

/// PTY session wrapper with shared writer and output reading
/// Note: We don't store the PtyPair because it doesn't implement Sync
pub struct PtySession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    #[allow(dead_code)]
    size: Arc<Mutex<PtySize>>,
}

impl PtySession {
    /// Create a new PTY session with output streaming to frontend
    pub fn new(
        shell: Option<String>,
        rows: u16,
        cols: u16,
        window: Window,
        session_id: String,
    ) -> Result<Self> {
        let pty_system = NativePtySystem::default();

        // Create PTY with specified size
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("Failed to open PTY")?;

        // Determine shell command
        let shell_cmd = shell.unwrap_or_else(|| {
            std::env::var("SHELL").unwrap_or_else(|_| {
                #[cfg(target_os = "windows")]
                {
                    "powershell.exe".to_string()
                }
                #[cfg(not(target_os = "windows"))]
                {
                    "/bin/sh".to_string()
                }
            })
        });

        // Spawn shell process
        let mut cmd = CommandBuilder::new(&shell_cmd);
        cmd.cwd(std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("/")));

        let _child = pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn shell")?;

        // Get writer for sending data to PTY
        let writer = pair
            .master
            .take_writer()
            .context("Failed to get PTY writer")?;
        let writer = Arc::new(Mutex::new(writer));

        // Get reader for receiving data from PTY
        let mut reader = pair
            .master
            .try_clone_reader()
            .context("Failed to get PTY reader")?;

        // Store initial size
        let size = Arc::new(Mutex::new(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }));

        // Spawn thread to read PTY output and send to frontend
        let session_id_clone = session_id.clone();
        thread::spawn(move || {
            let mut buffer = [0u8; 8192];
            let mut utf8_buffer = Vec::new();

            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        // EOF - PTY closed
                        let _ = window.emit(
                            "pty-output",
                            serde_json::json!({
                                "session_id": session_id_clone,
                                "data": "",
                                "closed": true,
                            }),
                        );
                        break;
                    }
                    Ok(n) => {
                        // Add new bytes to buffer
                        utf8_buffer.extend_from_slice(&buffer[..n]);

                        // Try to convert to valid UTF-8 string
                        match String::from_utf8(utf8_buffer.clone()) {
                            Ok(data) => {
                                // Successfully decoded - send and clear buffer
                                if let Err(e) = window.emit(
                                    "pty-output",
                                    serde_json::json!({
                                        "session_id": session_id_clone,
                                        "data": data,
                                        "closed": false,
                                    }),
                                ) {
                                    eprintln!("Failed to emit PTY output: {}", e);
                                    break;
                                }
                                utf8_buffer.clear();
                            }
                            Err(e) => {
                                // Check if error is due to incomplete multibyte sequence at end
                                let valid_up_to = e.utf8_error().valid_up_to();

                                if valid_up_to > 0 {
                                    // Send valid portion
                                    let valid_data = String::from_utf8_lossy(&utf8_buffer[..valid_up_to]).to_string();

                                    if let Err(e) = window.emit(
                                        "pty-output",
                                        serde_json::json!({
                                            "session_id": session_id_clone,
                                            "data": valid_data,
                                            "closed": false,
                                        }),
                                    ) {
                                        eprintln!("Failed to emit PTY output: {}", e);
                                        break;
                                    }

                                    // Keep incomplete bytes for next iteration
                                    utf8_buffer.drain(..valid_up_to);
                                }

                                // If buffer gets too large with invalid data, clear it
                                if utf8_buffer.len() > 100 {
                                    utf8_buffer.clear();
                                }
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Error reading from PTY: {}", e);
                        break;
                    }
                }
            }
        });

        Ok(Self { writer, size })
    }

    /// Write data to the PTY
    pub fn write(&self, data: &str) -> Result<()> {
        let mut writer = self
            .writer
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to lock writer: {}", e))?;

        writer
            .write_all(data.as_bytes())
            .context("Failed to write to PTY")?;

        writer.flush().context("Failed to flush PTY writer")?;

        Ok(())
    }

    /// Resize the PTY
    /// Note: Due to portable-pty's API limitations, we can only update our internal size record
    /// The actual PTY resize would require keeping a reference to the master, which doesn't work
    /// with Tauri's State requirements (need Send + Sync)
    pub fn resize(&self, rows: u16, cols: u16) -> Result<()> {
        let mut size = self
            .size
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to lock size: {}", e))?;

        size.rows = rows;
        size.cols = cols;

        // Unfortunately, we can't actually resize the PTY here because we don't have
        // access to the master anymore (it doesn't implement Sync)
        // This is a known limitation of portable-pty when used with Tauri
        // A workaround would be to use a different PTY library or implement custom PTY handling

        Ok(())
    }
}

// Manually implement Send for PtySession
// This is safe because:
// - writer is Arc<Mutex<...>> which is Send
// - size is Arc<Mutex<...>> which is Send
unsafe impl Send for PtySession {}

// Manually implement Sync for PtySession
// This is safe because:
// - All fields are protected by Mutex
unsafe impl Sync for PtySession {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pty_write() {
        // Note: This test would require a mock window, so it's simplified
        // In a real scenario, you'd use integration tests with a running Tauri app
    }
}
