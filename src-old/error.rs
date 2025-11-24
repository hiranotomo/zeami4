use thiserror::Error;

#[derive(Error, Debug)]
pub enum ZeamiError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("GitHub API error: {0}")]
    GitHub(String),

    #[error("Git operation error: {0}")]
    Git(String),

    #[error("State management error: {0}")]
    State(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}
