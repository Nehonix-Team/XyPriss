use clap::{Parser, Subcommand};


mod commands;
mod core;
mod utils;

#[cfg(feature = "mimalloc")]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[derive(Parser)]
#[command(name = "xfpm")]
#[command(about = "Official XyPriss Fast Package Manager & CLI (v0.1.125)", long_about = None)]
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

        /// Save to devDependencies
        #[arg(short = 'D', long)]
        dev: bool,

        /// Save to optionalDependencies
        #[arg(short = 'O', long)]
        optional: bool,

        /// Save to peerDependencies
        #[arg(short = 'P', long)]
        peer: bool,

        /// Install exact version
        #[arg(short = 'E', long)]
        exact: bool,

        /// Save to dependencies (default)
        #[arg(short = 'S', long)]
        save: bool,

        /// Update packages to their latest versions
        #[arg(short = 'u', long)]
        update: bool,
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
    /// Run a script from package.json or execute a file
    #[command(alias = "r")]
    #[command(alias = "test")]
    #[command(alias = "build")]
    Run {
        /// Success code to expect for continuation (default: 0)
        #[arg(short, long)]
        code: Option<i32>,

        /// Scripts to run sequentially. If a script needs arguments, quote it: "test --grep foo"
        /// or pass them directly if only running one script.
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        scripts: Vec<String>,
    },
    /// Create a new project using a template (equivalent to npx create-<package>)
    Create {
        /// Package name (will be prefixed with create-)
        template: String,
        
        /// Arguments for the creator
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        args: Vec<String>,
    },
    /// Execute a command from node_modules/.bin (npx-like)
    Exec {
        /// Command to execute
        command: String,
        
        /// Arguments to pass to the command
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        args: Vec<String>,
    },
    /// Update dependencies to their latest versions
    #[command(alias = "up")]
    #[command(alias = "upgrade")]
    Update {
        /// Packages to update
        packages: Vec<String>,

        /// Update packages globally
        #[arg(short, long)]
        global: bool,
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut args: Vec<String> = std::env::args().collect();
    
    // HEURISTIC: Default behavior
    if args.len() > 1 {
        let first_arg = &args[1];
        
        // Handle '--' as replacement for 'npx' -> maps to 'exec'
        if first_arg == "--" {
            args.remove(1);
            args.insert(1, "exec".to_string());
        } else {
            // Check if it's a command. If not, and it ends with script ext or is a file that exists
            let is_subcommand = ["init", "install", "i", "add", "start", "dev", "uninstall", "un", "rm", "remove", "run", "exec", "create"].contains(&first_arg.as_str());
            
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
        Commands::Install { packages, npm, retries, global, dev, optional, peer, exact, save, update } => {
            commands::install::run(packages, npm, retries, global, dev, optional, peer, exact, save, update).await?;
        }
        Commands::Start => {
            commands::start::run().await?;
        }
        Commands::Uninstall { packages, global } => {
            commands::uninstall::run(packages, global).await?;
        }
        Commands::Run { scripts, code } => {
            let success_code = code.unwrap_or(0);
            
            if scripts.is_empty() {
                // Default behavior if no scripts provided (e.g. 'xfpm run' alone or via alias)
                let args: Vec<String> = std::env::args().collect();
                let target_script = if args.len() > 1 {
                    match args[1].as_str() {
                        "test" => "test".to_string(),
                        "build" => "build".to_string(),
                        "dev" => "dev".to_string(),
                        "start" => "start".to_string(),
                        _ => "dev".to_string()
                    }
                } else {
                    "dev".to_string()
                };
                commands::run::run(vec![target_script], success_code).await?;
            } else {
                commands::run::run(scripts, success_code).await?;
            }
        }
        Commands::Create { template, args } => {
            let command = if template.starts_with("create-") {
                template
            } else {
                format!("create-{}", template)
            };
            // Note: npm create installs the package temporarily if not found.
            // For now, we assume it's like 'xfpm exec create-<template>'
            // We might need to ensure the package is installed first.
            commands::exec::run(command, args).await?;
        }
        Commands::Exec { command, args } => {
            commands::exec::run(command, args).await?;
        }
        Commands::Update { packages, global } => {
            // Update is just an install with the update flag set to true
            commands::install::run(packages, false, 3, global, false, false, false, false, false, true).await?;
        }
    }

    Ok(())
}
