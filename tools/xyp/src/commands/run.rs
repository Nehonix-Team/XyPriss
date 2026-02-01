use std::process::Command;
use colored::Colorize;
use anyhow::{Result, Context};
use which::which;

pub async fn run(scripts: Vec<String>, success_code: i32) -> Result<()> {
    // 1. Check for Bun
    let (bun_path, was_installed) = match which("bun") {
        Ok(path) => (path, false),
        Err(_) => {
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
            let global_bin = std::path::Path::new(&home).join(".xpm_global").join("bin").join("bun");
            
            if global_bin.exists() {
                (global_bin, false)
            } else {
                println!("{} Bun runtime not found. Installing automatically...", "⚙".bold().blue());
                
                println!("   {} Getting bun...", "⬇".bold().cyan());
                crate::commands::install::run(vec!["bun".to_string()], false, 3, true, false, false, false, false, false).await
                    .context("Failed to auto-install bun")?;
                
                // Installation complete path re-check
                let global_bin = std::path::Path::new(&home).join(".xpm_global").join("bin").join("bun");
                if global_bin.exists() {
                     (global_bin, true)
                } else {
                     return Err(anyhow::anyhow!("Failed to locate bun after installation"));
                }
            }
        }
    };
    
    if was_installed {
        // Clear screen to hide installation logs as requested
        print!("\x1B[2J\x1B[1;1H");
    }

    for (i, script_cmd) in scripts.iter().enumerate() {
        // Split command if it contains arguments (e.g. "test --grep foo")
        let parts: Vec<&str> = script_cmd.split_whitespace().collect();
        if parts.is_empty() { continue; }
        
        let script_name = parts[0];
        let script_args = &parts[1..];

        let pb = indicatif::ProgressBar::new_spinner();
        pb.set_style(indicatif::ProgressStyle::default_spinner().template("{spinner:.cyan} [{pos}/{len}] Running {msg}").unwrap());
        pb.set_position((i + 1) as u64);
        pb.set_length(scripts.len() as u64);
        pb.set_message(format!("{}", script_cmd.bold()));
        pb.enable_steady_tick(std::time::Duration::from_millis(80));

        // 2. Execute
        // bun run <script> <args...>
        let mut command = Command::new(&bun_path);
        command.arg("run").arg(script_name).args(script_args);
        
        // Clear spinner before exec to avoid output glitching
        pb.finish_and_clear();

        let status = command.status().context(format!("Failed to execute script: {}", script_cmd))?;

        let exit_code = status.code().unwrap_or(1);
        if exit_code != success_code {
            eprintln!("{} Script {} failed with exit code {}. Expected {}.", 
                "✘".red().bold(), script_cmd.bold(), exit_code, success_code);
            std::process::exit(exit_code);
        }
    }

    Ok(())
}
