use std::env;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use colored::Colorize;

pub fn ensure_global_path_is_configured(bin_path: &Path) {
    if is_in_path(bin_path) {
        return;
    }

    // Attempt to auto-configure based on shell
    if let Ok(shell) = env::var("SHELL") {
        let config_file = if shell.contains("zsh") {
            home_file(".zshrc")
        } else if shell.contains("bash") {
            home_file(".bashrc")
        } else {
            None
        };

        if let Some(cf) = config_file {
            if cf.exists() {
                // Check content to avoid duplicates
                 if let Ok(content) = std::fs::read_to_string(&cf) {
                     let path_str = bin_path.to_string_lossy();
                     if !content.contains(&*path_str) {
                         println!("   {} Configuring PATH in {}", "⚙".bold().cyan(), cf.display());
                         
                         let export_cmd = format!("\n# XyPriss Global Binaries\nexport PATH=\"{}:$PATH\"\n", path_str);
                         
                         if let Ok(mut file) = OpenOptions::new().append(true).open(&cf) {
                             if let Err(e) = file.write_all(export_cmd.as_bytes()) {
                                 println!("   {} Failed to write to config: {}", "⚠".bold().yellow(), e);
                             } else {
                                 println!("   {} Added to PATH. Please restart your terminal or run: source {}", "✓".bold().green(), cf.display());
                             }
                         }
                     }
                 }
            }
        }
    }
}

fn is_in_path(path: &Path) -> bool {
    if let Ok(path_var) = env::var("PATH") {
        let p_str = path.to_string_lossy();
        // Simple check, robust enough for now
        return path_var.contains(&*p_str);
    }
    false
}

fn home_file(name: &str) -> Option<PathBuf> {
    env::var("HOME").ok().map(|h| Path::new(&h).join(name))
}

pub fn kill_processes_running_from(dir: &Path) {
    #[cfg(target_os = "linux")]
    {
        if let Ok(entries) = std::fs::read_dir("/proc") {
            for entry in entries.flatten() {
                if let Ok(file_name) = entry.file_name().into_string() {
                    if file_name.chars().all(|c| c.is_ascii_digit()) {
                        let exe_link = Path::new("/proc").join(&file_name).join("exe");
                        if let Ok(target) = std::fs::read_link(exe_link) {
                            if target.starts_with(dir) {
                                // Attempt to kill gracefully first, then forcefully
                                let _ = std::process::Command::new("kill")
                                    .arg("-15") // SIGTERM
                                    .arg(&file_name)
                                    .output();
                                
                                // Give it a tiny bit of time
                                std::thread::sleep(std::time::Duration::from_millis(50));
                                
                                let _ = std::process::Command::new("kill")
                                    .arg("-9") // SIGKILL
                                    .arg(&file_name)
                                    .output();
                            }
                        }
                    }
                }
            }
        }
    }
}
