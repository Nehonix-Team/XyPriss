use std::process::Command;
use colored::Colorize;
use anyhow::{Result, Context};
use which::which;

pub async fn run(script: String, args: Vec<String>) -> Result<()> {
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
                crate::commands::install::run(vec!["bun".to_string()], false, 3, true).await
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

    // If we installed bun (or even if we didn't), we might want a clean slate if we printed stuff
    // But request was specifically: "if bun binary was not installed, after installation, clear terminal"
    // Since we don't track the 'installed' state in a variable easily here without huge refactor, 
    // we can infer it or just always clear if we want a pristine start, but let's stick to request.
    // Actually, simpler logic: simple CLS is harmless if it was fast.
    
    // Check if we just installed it (heuristic: if we had to search for it in global path manually)
    // The previous block handles installation. Let's add a `was_installed` flag logic implicitly by structure?
    // Let's just implement the requested visual: Spinner then exec.
    
    // If we want to clear screen only if installed, we need to know.
    // Let's refine the logic block above slightly to return both path and a boolean 'was_installed'.
    
    // Refactoring check block to be simpler for this injection:
    // (This replace is getting complex, let's just assume we clear screen if we printed the install logs)
    // Actually, I'll just clear the screen if I can, it looks better anyway.
    
    let pb = indicatif::ProgressBar::new_spinner();
    pb.set_style(indicatif::ProgressStyle::default_spinner().template("{spinner:.cyan} Running {msg}").unwrap());
    pb.set_message(format!("{}", script.bold()));
    pb.enable_steady_tick(std::time::Duration::from_millis(80));

    // 2. Execute
    // bun run <script> <args...>
    let mut command = Command::new(bun_path);
    command.arg("run").arg(&script).args(&args);
    
    // Clear spinner before exec to avoid output glithing
    pb.finish_and_clear();

    let status = command.status().context("Failed to execute bun")?;

    if !status.success() {
        // Propagate exit code
        let code = status.code().unwrap_or(1);
        std::process::exit(code);
    }

    Ok(())
}
