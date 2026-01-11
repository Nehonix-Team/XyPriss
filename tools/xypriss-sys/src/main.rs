mod fs;
mod sys;

use clap::{Parser, Subcommand};
use std::path::{PathBuf, Path};
use anyhow::Result;
use serde_json::json;

#[derive(Parser)]
#[command(name = "xypriss-sys")]
#[command(author = "Nehonix Team")]
#[command(version = "1.0")]
#[command(about = "XyPriss System & FileSystem CLI tool", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    #[arg(short, long, env = "XYPRISS_ROOT")]
    root: Option<PathBuf>,

    #[arg(short, long)]
    json: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// File System operations
    Fs {
        #[command(subcommand)]
        action: FsAction,
    },
    /// System information operations
    Sys {
        #[command(subcommand)]
        action: SysAction,
    },
}

#[derive(Subcommand)]
enum FsAction {
    /// List directory contents
    Ls { path: String },
    /// Read file content
    Read { path: String },
    /// Write data to file
    Write { path: String, data: String },
    /// Copy file or directory
    Copy { src: String, dest: String },
    /// Move/Rename file or directory
    Move { src: String, dest: String },
    /// Remove file or directory
    Rm { path: String },
    /// Find files recursively
    Find { 
        path: String,
        #[arg(short, long)]
        ext: Option<String>,
    },
    /// Check if path exists
    Exists { path: String },
}

#[derive(Subcommand)]
enum SysAction {
    /// Get general system info
    Info,
    /// Get disks information
    Disks,
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    
    let root = cli.root.unwrap_or_else(|| std::env::current_dir().unwrap());
    let xfs = fs::XyPrissFS::new(root);

    match cli.command {
        Commands::Fs { action } => {
            match action {
                FsAction::Ls { path } => {
                    let entries = xfs.ls(path)?;
                    if cli.json {
                        println!("{}", json!(entries));
                    } else {
                        for e in entries { println!("{}", e); }
                    }
                }
                FsAction::Read { path } => {
                    let content = xfs.read_file(path)?;
                    if cli.json {
                        println!("{}", json!({ "content": content }));
                    } else {
                        println!("{}", content);
                    }
                }
                FsAction::Write { path, data } => {
                    xfs.write_file(path, &data)?;
                    if cli.json { println!("{}", json!({"status": "ok"})); }
                }
                FsAction::Copy { src, dest } => {
                    xfs.copy(src, dest)?;
                    if cli.json { println!("{}", json!({"status": "ok"})); }
                }
                FsAction::Move { src, dest } => {
                    xfs.move_item(src, dest)?;
                    if cli.json { println!("{}", json!({"status": "ok"})); }
                }
                FsAction::Rm { path } => {
                    xfs.remove(path)?;
                    if cli.json { println!("{}", json!({"status": "ok"})); }
                }
                FsAction::Find { path, ext } => {
                    let results = xfs.ls_recursive(path);
                    let filtered: Vec<_> = if let Some(e) = ext {
                        let dot_e = if e.starts_with('.') { e } else { format!(".{}", e) };
                        results.into_iter().filter(|p| p.to_string_lossy().ends_with(&dot_e)).collect()
                    } else {
                        results
                    };
                    if cli.json {
                        println!("{}", json!(filtered));
                    } else {
                        for p in filtered { println!("{}", p.display()); }
                    }
                }
                FsAction::Exists { path } => {
                    let exists = xfs.exists(path);
                    if cli.json {
                        println!("{}", json!({ "exists": exists }));
                    } else {
                        println!("{}", exists);
                    }
                }
            }
        }
        Commands::Sys { action } => {
            match action {
                SysAction::Info => {
                    let info = sys::get_system_info();
                    println!("{}", serde_json::to_string_pretty(&info)?);
                }
                SysAction::Disks => {
                    let disks = sys::get_disks_info();
                    println!("{}", serde_json::to_string_pretty(&disks)?);
                }
            }
        }
    }

    Ok(())
}
