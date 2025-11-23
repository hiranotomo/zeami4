use anyhow::Result;
use clap::Subcommand;

#[derive(Subcommand)]
pub enum IssueAction {
    /// Create a new GitHub issue
    Create,
    /// List issues
    List,
    /// Show issue details
    Show {
        /// Issue number
        number: u64,
    },
    /// Link current branch to an issue
    Link {
        /// Issue number
        number: u64,
    },
}

pub async fn run(action: IssueAction) -> Result<()> {
    match action {
        IssueAction::Create => create_issue().await,
        IssueAction::List => list_issues().await,
        IssueAction::Show { number } => show_issue(number).await,
        IssueAction::Link { number } => link_issue(number).await,
    }
}

async fn create_issue() -> Result<()> {
    println!("📋 Creating new issue...");
    // TODO: Implement issue creation
    Ok(())
}

async fn list_issues() -> Result<()> {
    println!("📋 Listing issues...");
    // TODO: Implement issue listing
    Ok(())
}

async fn show_issue(number: u64) -> Result<()> {
    println!("📋 Showing issue #{}...", number);
    // TODO: Implement issue details display
    Ok(())
}

async fn link_issue(number: u64) -> Result<()> {
    println!("🔗 Linking current branch to issue #{}...", number);
    // TODO: Implement branch-issue linking
    Ok(())
}
