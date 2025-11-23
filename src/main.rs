mod cli;
mod config;
mod error;
mod github;
mod git;
mod state;
mod tui;

use clap::Parser;
use cli::Cli;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    cli.execute().await?;
    Ok(())
}
