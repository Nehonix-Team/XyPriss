use std::process::Command;
use colored::Colorize;
use anyhow::{Result, Context};

pub async fn run(command: String, args: Vec<String>) -> Result<()> {
    // 1. Resolve the binary path
    // Priority: 
    // a) node_modules/.bin/<command>
    // b) System PATH (fallback like npx)
    
    let current_dir = std::env::current_dir()?;
    let mut bin_path = None;
    
    // 1. Search for node_modules/.bin in current and parent directories
    let mut check_dir = Some(current_dir.as_path());
    while let Some(dir) = check_dir {
        let local_bin = dir.join("node_modules").join(".bin").join(&command);
        if local_bin.exists() {
            bin_path = Some(local_bin);
            break;
        }
        check_dir = dir.parent();
    }
    
    let bin_path = if let Some(path) = bin_path {
        path
    } else {
        // Fallback to searching in PATH
        match which::which(&command) {
            Ok(path) => path,
            Err(_) => {
                // If not found, try to find it in .xpm_global/bin
                let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
                let global_bin = std::path::Path::new(&home).join(".xpm_global").join("bin").join(&command);
                
                if global_bin.exists() {
                    global_bin
                } else {
                    // 1.c) Auto-install if not found (npx-like behavior)
                    println!("{} Command {} not found. Attempting to install automatically...", "⚙".bold().blue(), command.bold());
                    
                    // Try to install the package (assuming package name == command name)
                    // We install it globally to make it available for future use
                    if let Err(e) = crate::commands::install::run(
                        vec![command.clone()], 
                        false, 
                        3, 
                        true, // global
                        false, 
                        false, 
                        false, 
                        false, 
                        false,
                        false
                    ).await {
                        println!("{} Failed to auto-install package {}: {}", "×".bold().red(), command.bold(), e);
                        return Err(anyhow::anyhow!("Command not found and auto-install failed: {}", command));
                    }

                    // Re-check after installation
                    let global_bin_check = std::path::Path::new(&home).join(".xpm_global").join("bin").join(&command);
                    if global_bin_check.exists() {
                        global_bin_check
                    } else { 
                        // Special case: package installed but doesn't have a binary matching the command name
                        // Check if it's tailwindcss v4 specifically to help the user
                        if command == "tailwindcss" {
                            println!("{} Package {} (v4) installed but it no longer contains a CLI.", "!".bold().yellow(), "tailwindcss".bold());
                            println!("   {} Suggestion: Use {} instead.", "→".dimmed(), "xfpm install -g @tailwindcss/cli".cyan());
                            println!("   {} Then run: {}", "→".dimmed(), "xfpm -- @tailwindcss/cli ...".cyan());
                        }

                        println!("{} Command {} still not found after installing package {}.", "×".bold().red(), command.bold(), command.bold());
                        println!("   {} Note: The package may not contain an executable named {}.", "→".dimmed(), command.cyan());
                        return Err(anyhow::anyhow!("Command not found: {}", command));
                    }
                }
            }
        }
    };

    let pb = indicatif::ProgressBar::new_spinner();
    pb.set_style(indicatif::ProgressStyle::default_spinner().template("{spinner:.magenta} Executing {msg}").unwrap());
    pb.set_message(format!("{}", command.bold().magenta()));
    pb.enable_steady_tick(std::time::Duration::from_millis(80));

    // 2. Execute
    let mut cmd = Command::new(bin_path);
    cmd.args(&args);
    
    // Clear spinner before exec
    pb.finish_and_clear();

    let status = cmd.status().context(format!("Failed to execute {}", command))?;

    if !status.success() {
        let code = status.code().unwrap_or(1);
        std::process::exit(code);
    }

    Ok(())
}
