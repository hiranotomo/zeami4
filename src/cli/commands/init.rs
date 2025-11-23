use anyhow::Result;
use inquire::{Text, Confirm};
use crate::config::Config;

pub async fn run() -> Result<()> {
    println!("🚀 Initializing zeami configuration...\n");

    let repo = Text::new("GitHub repository (owner/repo):")
        .with_help_message("e.g., octocat/hello-world")
        .prompt()?;

    let token = Text::new("GitHub Personal Access Token:")
        .with_help_message("Generate at: https://github.com/settings/tokens")
        .prompt()?;

    let config = Config::new(repo, token);
    config.save()?;

    println!("\n✅ Configuration saved to ~/.zeami/config.toml");
    println!("   You can now use zeami commands!");

    Ok(())
}
