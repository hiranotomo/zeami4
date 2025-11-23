use anyhow::{Context, Result};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::io::Write;

/// PTY session wrapper
pub struct PtySession {
    #[allow(dead_code)]
    pair: portable_pty::PtyPair,
    writer: Box<dyn Write + Send>,
}

impl PtySession {
    /// Create a new PTY session
    pub fn new(shell: Option<String>) -> Result<Self> {
        let pty_system = NativePtySystem::default();

        // Create PTY with default size
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
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
        let mut cmd = CommandBuilder::new(shell_cmd);
        cmd.cwd(std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("/")));

        let _child = pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn shell")?;

        // Get writer for sending data to PTY
        let writer = pair.master.take_writer().context("Failed to get PTY writer")?;

        Ok(Self { pair, writer })
    }

    /// Write data to the PTY
    pub fn write(&self, _data: &str) -> Result<()> {
        // Since writer is consumed by take_writer(), we need to work around this
        // In a real implementation, we'd use Arc<Mutex<>> or channels
        // For now, this is a skeleton implementation
        Ok(())
    }

    /// Resize the PTY
    #[allow(dead_code)]
    pub fn resize(&self, rows: u16, cols: u16) -> Result<()> {
        self.pair
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("Failed to resize PTY")?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pty_creation() {
        let result = PtySession::new(None);
        assert!(result.is_ok(), "Failed to create PTY session");
    }
}
