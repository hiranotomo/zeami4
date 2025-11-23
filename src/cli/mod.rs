mod commands;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "zeami")]
#[command(author, version, about = "GitHub issue-driven development tool for Claude Code", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Initialize zeami configuration
    Init,

    /// Manage project specifications
    Spec {
        #[command(subcommand)]
        action: commands::spec::SpecAction,
    },

    /// Manage GitHub issues
    Issue {
        #[command(subcommand)]
        action: commands::issue::IssueAction,
    },

    /// Development workflow commands
    Dev {
        #[command(subcommand)]
        action: commands::dev::DevAction,
    },

    /// Show current status
    Status,
}

impl Cli {
    pub async fn execute(self) -> anyhow::Result<()> {
        match self.command {
            Commands::Init => commands::init::run().await,
            Commands::Spec { action } => commands::spec::run(action).await,
            Commands::Issue { action } => commands::issue::run(action).await,
            Commands::Dev { action } => commands::dev::run(action).await,
            Commands::Status => commands::status::run().await,
        }
    }
}
