use clap::{Parser, Subcommand};


mod commands;
mod core;
mod utils;

#[cfg(feature = "mimalloc")]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[derive(Parser)]
#[command(name = "xfpm")]
#[command(about = "Official XyPriss Fast Package Manager & CLI", long_about = None)]
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
    #[command(alias = "i")]
    #[command(alias = "add")]
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

        /// Save package to devDependencies
        #[arg(short = 'D', long = "save-dev")]
        save_dev: bool,

        /// Save package to optionalDependencies
        #[arg(short = 'O', long = "save-optional")]
        save_optional: bool,

        /// Save package to peerDependencies
        #[arg(short = 'P', long = "save-peer")]
        save_peer: bool,
    },
    /// Start the development server
    #[command(alias = "dev")]
    Start,
    /// Remove dependencies
    #[command(alias = "un")]
    #[command(alias = "rm")]
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
    },
    /// Execute a command from a package (npx style)
    #[command(alias = "--")]
    Exec {
        /// Package/Command to execute
        command: String,
        
        /// Arguments to pass to the command
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        args: Vec<String>,
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut args: Vec<String> = std::env::args().collect();
    
    // HEURISTIC: Default behavior
    if args.len() > 1 {
        let first_arg = &args[1];
        
        // Handle npx style: xfpm -- command
        if first_arg == "--" && args.len() > 2 {
            args.remove(1); // remove "--"
            args.insert(1, "exec".to_string());
        } else {
            // Check if it's a command. If not, and it ends with script ext or is a file that exists
            let is_subcommand = ["init", "install", "i", "add", "start", "dev", "uninstall", "un", "rm", "remove", "run", "exec", "--"].contains(&first_arg.as_str());
            
            if !is_subcommand && !first_arg.starts_with('-') {
                if first_arg.ends_with(".ts") || first_arg.ends_with(".js") || first_arg.ends_with(".json") || std::path::Path::new(first_arg).exists() {
                    // Prepend 'run' to arguments
                    args.insert(1, "run".to_string());
                }
            }
        }
    }

    let cli = Cli::parse_from(args);

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
        Commands::Install { packages, npm, retries, global, save_dev, save_optional, save_peer } => {
            commands::install::run(packages, npm, retries, global, save_dev, save_optional, save_peer).await?;
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
        Commands::Exec { command, args } => {
            commands::exec::run(command, args).await?;
        }
    }

    Ok(())
}
