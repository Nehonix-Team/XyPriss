use clap::{Parser, Subcommand};
use colored::*;

mod commands;
mod core;
mod utils;

#[derive(Parser)]
#[command(name = "xyp")]
#[command(about = "Official XyPriss CLI & Fast Package Manager", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize a new XyPriss project
    Init {
        #[arg(short, long)]
        name: Option<String>,
    },
    /// Install dependencies for the current project
    Install {
        /// Packages to install
        packages: Vec<String>,
        
        /// Force npm mode
        #[arg(long)]
        npm: bool,
    },
    /// Start the development server
    Start,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Init { name } => {
            println!("{} Initializing project: {:?}", "🚀".cyan(), name);
            // TODO: Implement init
        }
        Commands::Install { packages, npm } => {
            commands::install::run(packages, npm).await?;
        }
        Commands::Start => {
            println!("{} Starting development server...", "🏃".green());
            // TODO: Implement start
        }
    }

    Ok(())
}
