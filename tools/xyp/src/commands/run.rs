use std::process::Command;
use colored::Colorize;
use anyhow::{Result, Context};
use which::which;

pub async fn run(scripts: Vec<String>, success_code: i32) -> Result<()> {
    // 1. Detect Bun runtime (only used for .js/.ts files)
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let xpm_global_bun = std::path::Path::new(&home).join(".xpm_global").join("bin").join("bun");
    
    let bun_bin = if let Ok(path) = which("bun") {
        Some(path)
    } else if xpm_global_bun.exists() {
        Some(xpm_global_bun.clone())
    } else {
        None
    };

    // 2. Load package.json if it exists to check for scripts
    let pkg_json_path = std::env::current_dir()?.join("package.json");
    let pkg_json: Option<serde_json::Value> = if pkg_json_path.exists() {
        let content = std::fs::read_to_string(&pkg_json_path).ok();
        content.and_then(|c| serde_json::from_str(&c).ok())
    } else {
        None
    };

    for (i, script_cmd) in scripts.iter().enumerate() {
        let parts: Vec<String> = shell_words::split(script_cmd).unwrap_or_else(|_| vec![script_cmd.clone()]);
        if parts.is_empty() { continue; }
        
        let cmd_name = &parts[0];
        let cmd_args = &parts[1..];

        let pb = indicatif::ProgressBar::new_spinner();
        pb.set_style(indicatif::ProgressStyle::default_spinner().template("{spinner:.cyan} [{pos}/{len}] Running {msg}").unwrap());
        pb.set_position((i + 1) as u64);
        pb.set_length(scripts.len() as u64);
        pb.set_message(format!("{}", script_cmd.bold()));
        pb.enable_steady_tick(std::time::Duration::from_millis(80));

        // 3. Execution Logic
        let mut final_cmd = if let Some(pkg) = &pkg_json {
            if let Some(scripts_obj) = pkg.get("scripts").and_then(|s| s.as_object()) {
                if scripts_obj.contains_key(cmd_name) {
                    // It's a package.json script
                    let mut c = Command::new("sh");
                    c.arg("-c").arg(format!("npm run {} -- {}", cmd_name, cmd_args.join(" ")));
                    Some(c)
                } else { None }
            } else { None }
        } else { None };

        if final_cmd.is_none() {
            // Check if it's a file
            let path = std::path::Path::new(cmd_name);
            if path.exists() {
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                if ext == "ts" || ext == "js" {
                    // Use Bun for TS/JS
                    let bin = if let Some(b) = &bun_bin {
                        b.clone()
                    } else {
                        pb.set_message("Installing bun runtime...");
                        crate::commands::install::run(vec!["bun".to_string()], false, 3, true, false, false, false, false, false).await?;
                        xpm_global_bun.clone()
                    };
                    let mut c = Command::new(bin);
                    c.arg("run").arg(cmd_name).args(cmd_args);
                    final_cmd = Some(c);
                } else {
                    // Other file types (sh, etc) - Execute directly if possible
                    let mut c = Command::new(cmd_name);
                    c.args(cmd_args);
                    final_cmd = Some(c);
                }
            } else {
                // Fallback: try to find in node_modules/.bin or execute as raw shell command
                let mut c = Command::new("sh");
                c.arg("-c").arg(script_cmd);
                final_cmd = Some(c);
            }
        }

        pb.finish_and_clear();

        if let Some(mut command) = final_cmd {
            let status = command.status().context(format!("Failed to execute: {}", script_cmd))?;
            let exit_code = status.code().unwrap_or(1);
            if exit_code != success_code {
                eprintln!("{} Command {} failed with exit code {}.", "✘".red().bold(), script_cmd.bold(), exit_code);
                std::process::exit(exit_code);
            }
        }
    }

    Ok(())
}
