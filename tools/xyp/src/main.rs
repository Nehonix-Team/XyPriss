use clap::{Parser, Subcommand};
use colored::*;

mod commands;
mod core;
mod utils;

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

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
        
        /// Project description
        #[arg(long)]
        desc: Option<String>,
        
        /// Language (ts or js)
        #[arg(long)]
        lang: Option<String>,
        
        /// Server port
        #[arg(long)]
        port: Option<u16>,
        
        /// Author name
        #[arg(long)]
        author: Option<String>,
        
        /// App alias
        #[arg(long)]
        alias: Option<String>,

        // We can capture remaining positional args if user typed description without flag, 
        // but let's stick to flags for clarity mostly.
        // Actually, user typed `description "C'est juste..."` which looks like a positional arg?
        // Wait, user typed: `--name ... --lang ts description "..."` -> This implies `description` is a positional arg or a typo in command?
        // Ah, likely user meant `--desc "..."`. If user typed `description "..."` literally, clap might fail.
        // Let's assume standard flags.
    },
    /// Install dependencies for the current project
    Install {
        /// Packages to install
        packages: Vec<String>,
        
        /// Force npm mode
        #[arg(long)]
        npm: bool,

        /// Number of retries for network requests
        #[arg(long, default_value = "3")]
        retries: u32,

        /// Install package globally
        #[arg(short, long)]
        global: bool,
    },
    /// Start the development server
    Start,
    /// Remove dependencies
    #[command(alias = "remove")]
    Uninstall {
        /// Packages to remove
        packages: Vec<String>,

        /// Uninstall package globally
        #[arg(short, long)]
        global: bool,
    },
    /// Run a script using the best available runtime (bun > node)
    Run {
        /// Script to run
        script: String,
        
        /// Arguments to pass to the script
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        args: Vec<String>,
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Init { name, desc, lang, port, author, alias } => {
            commands::init::run(commands::init::InitOptions {
                name,
                desc,
                lang,
                port,
                author,
                alias,
            }).await?;
        }
        Commands::Install { packages, npm, retries, global } => {
            commands::install::run(packages, npm, retries, global).await?;
        }
        Commands::Start => {
            commands::start::run().await?;
        }
        Commands::Uninstall { packages, global } => {
            commands::uninstall::run(packages, global).await?;
        }
        Commands::Run { script, args } => {
            commands::run::run(script, args).await?;
        }
    }

    Ok(())
}
