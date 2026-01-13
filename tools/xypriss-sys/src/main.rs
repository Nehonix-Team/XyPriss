/* *****************************************************************************
 * Nehonix XyPriss System CLI
 * 
 * ACCESS RESTRICTIONS:
 * - This software is exclusively for use by Authorized Personnel of NEHONIX
 * - Intended for Internal Use only within NEHONIX operations
 * - No rights granted to unauthorized individuals or entities
 * - All modifications are works made for hire assigned to NEHONIX
 *
 * PROHIBITED ACTIVITIES:
 * - Copying, distributing, or sublicensing without written permission
 * - Reverse engineering, decompiling, or disassembling
 * - Creating derivative works without explicit authorization
 * - External use or commercial distribution outside NEHONIX
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * For questions or permissions, contact:
 * NEHONIX Legal Department
 * Email: legal@nehonix.com
 * Website: www.nehonix.com
 ***************************************************************************** */

mod fs;
mod sys;
mod advanced_watcher;
mod server;

use clap::{Parser, Subcommand, Args};
use std::path::PathBuf;
use anyhow::Result;
use serde_json::json;
use std::time::{Duration, SystemTime};
use colored::*;
use indicatif::{ProgressBar, ProgressStyle};

#[derive(Parser)]
#[command(name = "xsys")]
#[command(disable_help_flag = true)]
#[command(disable_help_subcommand = true)]
#[command(disable_version_flag = true)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Target root
    #[arg(short, long, env = "XYPRISS_ROOT")]
    root: Option<PathBuf>,

    /// JSON Mode
    #[arg(short, long, global = true)]
    json: bool,

    /// Verbosity
    #[arg(short, long, global = true)]
    verbose: bool,

    /// Silence
    #[arg(short, long, global = true)]
    quiet: bool,
}

#[derive(Subcommand, Clone)]
enum Commands {
    /// File system operations
    Fs {
        #[command(subcommand)]
        action: FsAction,
    },
    /// System operations
    Sys {
        #[command(subcommand)]
        action: SysAction,
    },
    /// Search operations
    Search {
        #[command(subcommand)]
        action: SearchAction,
    },
    /// Performance monitoring
    Monitor {
        #[command(subcommand)]
        action: MonitorAction,
    },
    /// Archive operations
    Archive {
        #[command(subcommand)]
        action: ArchiveAction,
    },
    /// Path operations
    Path {
        #[command(subcommand)]
        action: PathAction,
    },
    /// XHSC (XyPriss Hybrid Server Core) operations
    Server {
        #[command(subcommand)]
        action: server::ServerAction,
    },
}

#[derive(Subcommand, Clone)]
enum PathAction {
    /// Resolve path relative to root
    Resolve { paths: Vec<String> },
    /// Join path segments
    Join { paths: Vec<String> },
    /// Get directory name
    Dirname { path: String },
    /// Get base name
    Basename { 
        path: String,
        /// Optional suffix to remove
        suffix: Option<String> 
    },
    /// Get file extension
    Extname { path: String },
    /// Get relative path
    Relative { from: String, to: String },
    /// Normalize path
    Normalize { path: String },
}

#[derive(Subcommand, Clone)]
enum FsAction {
    /// List directory contents
    Ls { 
        path: String,
        /// Show detailed stats
        #[arg(short, long)]
        stats: bool,
        /// List recursively
        #[arg(short, long)]
        recursive: bool,
    },
    /// Read file content
    Read { 
        path: String,
        /// Read as bytes (hex output)
        #[arg(short, long)]
        bytes: bool,
    },
    /// Write data to file
    Write { 
        path: String, 
        data: String,
        /// Append instead of overwrite
        #[arg(short, long)]
        append: bool,
    },
    /// Copy file or directory
    Copy { 
        src: String, 
        dest: String,
        /// Show progress
        #[arg(short, long)]
        progress: bool,
    },
    /// Move/Rename file or directory
    Move { src: String, dest: String },
    /// Remove file or directory
    Rm { 
        path: String,
        /// Force removal without confirmation
        #[arg(short, long)]
        force: bool,
    },
    /// Create directory
    Mkdir { 
        path: String,
        /// Create parent directories
        #[arg(short, long)]
        parents: bool,
    },
    /// Touch file (create or update timestamp)
    Touch { path: String },
    /// Get file/directory statistics
    Stats { path: String },
    /// Calculate file hash (SHA-256)
    Hash { path: String },
    /// Verify file hash
    Verify { 
        path: String, 
        hash: String 
    },
    /// Get file/directory size
    Size { 
        path: String,
        /// Human readable format
        #[arg(short = 'H', long)]
        human: bool,
    },
    /// Create symbolic link
    Link { 
        src: String, 
        dest: String 
    },
    /// Check file permissions
    Check { path: String },
    /// Change file permissions (Unix only)
    #[cfg(unix)]
    Chmod { 
        path: String, 
        mode: String 
    },
    /// Watch file/directory for changes
    Watch { 
        paths: Vec<String>,
        /// Duration to watch (seconds)
        #[arg(short, long, default_value = "60")]
        duration: u64,
    },
    /// Stream file content in chunks
    Stream {
        path: String,
        /// Chunk size in bytes
        #[arg(short, long, default_value = "8192")]
        chunk_size: usize,
        /// Output in hexadecimal format
        #[arg(long)]
        hex: bool,
    },
    /// Calculate directory usage (recursive size)
    Du { path: String },
    /// Sync source to destination
    Sync { src: String, dest: String },
    /// Find duplicate files
    Dedupe { path: String },
    /// Watch file content for changes and show differences
    WatchContent {
        paths: Vec<String>,
        /// Duration to watch (seconds)
        #[arg(short, long, default_value = "60")]
        duration: u64,
        /// Show detailed diff of changes
        #[arg(long)]
        diff: bool,
    },
}

#[derive(Subcommand, Clone)]
enum SearchAction {
    /// Find files by pattern (regex)
    Find { 
        path: String,
        /// Regex pattern
        #[arg(short, long)]
        pattern: String,
    },
    /// Find files by extension
    Ext { 
        path: String,
        /// File extension
        extension: String,
    },
    /// Find files modified since date
    Modified { 
        path: String,
        /// Hours ago
        #[arg(short, long)]
        hours: u64,
    },
    /// Search content in files (grep)
    Grep { 
        path: String,
        /// Search pattern
        pattern: String,
        /// Case insensitive
        #[arg(short, long)]
        ignore_case: bool,
    },
    /// Batch rename files
    Rename {
        path: String,
        /// Regex pattern to match
        pattern: String,
        /// Replacement string
        replacement: String,
        /// Dry run (show changes without applying)
        #[arg(short = 'n', long)]
        dry_run: bool,
    },
}

#[derive(Subcommand, Clone)]
enum SysAction {
    /// Get general system information
    Info {
        /// Show extended info
        #[arg(short, long)]
        extended: bool,
    },
    /// Get CPU information
    Cpu {
        /// Show per-core stats
        #[arg(short, long)]
        cores: bool,
    },
    /// Get memory information
    Memory {
        /// Continuous monitoring
        #[arg(short, long)]
        watch: bool,
    },
    /// Get disk information
    Disks {
        /// Show specific mount point
        #[arg(short, long)]
        mount: Option<String>,
    },
    /// Get network statistics
    Network {
        /// Show specific interface
        #[arg(short, long)]
        interface: Option<String>,
    },
    /// Get process information
    Processes {
        /// Filter by PID
        #[arg(short, long)]
        pid: Option<u32>,
        /// Show top N by CPU
        #[arg(long)]
        top_cpu: Option<usize>,
        /// Show top N by memory
        #[arg(long)]
        top_mem: Option<usize>,
    },
    /// Get temperature information
    Temp,
    /// Get system health score
    Health,
    /// Get environment variables
    Env {
        /// Specific variable name
        var: Option<String>,
    },
    /// Get system paths
    Paths,
    /// Get current user info
    User,
    /// Kill a process
    Kill { pid: u32 },
    /// Quick system stats
    Quick,
    /// Get listening ports
    Ports,
    /// Get battery information
    Battery,
}

#[derive(Subcommand, Clone)]
enum MonitorAction {
    /// Monitor system continuously
    System {
        /// Duration in seconds
        #[arg(short, long, default_value = "60")]
        duration: u64,
        /// Update interval in seconds
        #[arg(short, long, default_value = "1")]
        interval: u64,
    },
    /// Monitor specific process
    Process {
        pid: u32,
        /// Duration in seconds
        #[arg(short, long, default_value = "60")]
        duration: u64,
    },
}

#[derive(Subcommand, Clone)]
enum ArchiveAction {
    /// Compress file with GZIP
    Compress {
        src: String,
        dest: String,
    },
    /// Decompress GZIP file
    Decompress {
        src: String,
        dest: String,
    },
    /// Create TAR archive
    Tar {
        dir: String,
        output: String,
    },
    /// Extract TAR archive
    Untar {
        archive: String,
        dest: String,
    },
}

fn print_restricted_warning() {
    println!("{}", "*******************************************************************************".red().bold());
    println!("{}", "* NEHONIX INTERNAL TOOL - RESTRICTED ACCESS                                     *".red().bold());
    println!("{}", "* This software is the exclusive property of NEHONIX operations.              *".red().bold());
    println!("{}", "* Unauthorized use, distribution, or analysis is strictly prohibited.         *".red().bold());
    println!("{}", "*******************************************************************************\n".red().bold());
}

fn main() -> Result<()> {
    let cli_result = Cli::try_parse();

    match cli_result {
        Ok(cli) => {
            let root = cli.root.clone().unwrap_or_else(|| std::env::current_dir().unwrap());
            
            match &cli.command {
                Commands::Fs { action } => handle_fs_action(action.clone(), root, &cli)?,
                Commands::Sys { action } => handle_sys_action(action.clone(), &cli)?,
                Commands::Search { action } => handle_search_action(action.clone(), root, &cli)?,
                Commands::Monitor { action } => handle_monitor_action(action.clone(), &cli)?,
                Commands::Archive { action } => handle_archive_action(action.clone(), root, &cli)?,
                Commands::Path { action } => {
                    let xfs = fs::XyPrissFS::new(root)?;
                    handle_path_action(action.clone(), &xfs, &cli)?;
                },
                Commands::Server { action } => {
                    server::handle_server_action(action.clone(), root, &cli)?;
                }
            }
        },
        Err(_) => {
            // Replaces ALL help/usage/error output from clap with our warning
            print_restricted_warning();
            std::process::exit(1);
        }
    }

    Ok(())
}

// ============ FILE SYSTEM HANDLERS ============

fn handle_fs_action(action: FsAction, root: PathBuf, cli: &Cli) -> Result<()> {
    let mut xfs = fs::XyPrissFS::new(root)?;

    match action {
        FsAction::Ls { path, stats, recursive } => {
            if recursive {
                let entries = xfs.ls_recursive(&path);
                print_output(&entries, cli.json, "files")?;
            } else if stats {
                let entries = xfs.ls_with_stats(&path)?;
                print_output(&entries, cli.json, "stats")?;
                if !cli.json {
                    for (name, stat) in entries {
                        let size = sys::format_bytes(stat.size);
                        let dt = chrono::DateTime::from_timestamp(stat.modified as i64, 0).unwrap();
                        let modified = chrono::DateTime::<chrono::Local>::from(dt).format("%Y-%m-%d %H:%M:%S").to_string();
                        println!("{:<30} {:>12} {}", name.cyan(), size.yellow(), modified.dimmed());
                    }
                }
            } else {
                let entries = xfs.ls(&path)?;
                print_output(&entries, cli.json, "files")?;
            }
        }
        
        FsAction::Read { path, bytes } => {
            if bytes {
                let data = xfs.read_bytes(&path)?;
                print_output(&data, cli.json, "bytes")?;
                if !cli.json {
                    for chunk in data.chunks(16) {
                        for byte in chunk {
                            print!("{:02x} ", byte);
                        }
                        println!();
                    }
                }
            } else {
                let content = xfs.read_file(&path)?;
                print_output(&content, cli.json, "content")?;
            }
        }
        
        FsAction::Write { path, data, append } => {
            if append {
                xfs.append(&path, &data)?;
            } else {
                xfs.write_file(&path, &data)?;
            }
            success_msg("File written successfully", cli)?;
        }
        
        FsAction::Copy { src, dest, progress } => {
            if progress && !cli.json {
                let pb = create_progress_bar("Copying");
                xfs.copy(&src, &dest)?;
                pb.finish_with_message("✓ Copy complete");
            } else {
                xfs.copy(&src, &dest)?;
                success_msg("File copied successfully", cli)?;
            }
        }
        
        FsAction::Move { src, dest } => {
            xfs.move_item(&src, &dest)?;
            success_msg("File moved successfully", cli)?;
        }
        
        FsAction::Rm { path, force } => {
            if !force && !cli.json {
                print!("{} Remove '{}'? [y/N]: ", "⚠️".yellow(), path);
                use std::io::{self, Write};
                io::stdout().flush()?;
                let mut input = String::new();
                io::stdin().read_line(&mut input)?;
                if !input.trim().eq_ignore_ascii_case("y") {
                    println!("Cancelled");
                    return Ok(());
                }
            }
            xfs.remove(&path)?;
            success_msg("File removed successfully", cli)?;
        }
        
        FsAction::Mkdir { path, parents } => {
            if parents || true { // mkdir -p by default
                xfs.mkdir(&path)?;
            }
            success_msg("Directory created", cli)?;
        }
        
        FsAction::Touch { path } => {
            xfs.touch(&path)?;
            success_msg("File touched", cli)?;
        }
        
        FsAction::Stats { path } => {
            let stats = xfs.stats(&path)?;
            print_output(&stats, cli.json, "stats")?;
            if !cli.json {
                println!("{}", "File Statistics".bold().cyan());
                println!("  Size:        {}", sys::format_bytes(stats.size).yellow());
                println!("  Type:        {}", if stats.is_dir { "Directory" } else { "File" });
                
                let fmt_date = |ts: u64| -> String {
                    let dt = chrono::DateTime::from_timestamp(ts as i64, 0).unwrap();
                    chrono::DateTime::<chrono::Local>::from(dt).format("%Y-%m-%d %H:%M:%S").to_string()
                };

                println!("  Modified:    {}", fmt_date(stats.modified));
                println!("  Created:     {}", fmt_date(stats.created));
                println!("  Accessed:    {}", fmt_date(stats.accessed));
                println!("  Permissions: {:o}", stats.permissions);
                println!("  Symlink:     {}", stats.is_symlink);
            }
        }
        
        FsAction::Hash { path } => {
            if !cli.quiet {
                let pb = create_progress_bar("Hashing");
                let hash = xfs.hash_file(&path)?;
                pb.finish_and_clear();
                print_output(&hash, cli.json, "hash")?;
            } else {
                let hash = xfs.hash_file(&path)?;
                print_output(&hash, cli.json, "hash")?;
            }
        }
        
        FsAction::Verify { path, hash } => {
            let valid = xfs.verify_hash(&path, &hash)?;
            if cli.json {
                println!("{}", json!({ "valid": valid }));
            } else {
                if valid {
                    println!("{} Hash verified!", "✓".green().bold());
                } else {
                    println!("{} Hash mismatch!", "✗".red().bold());
                }
            }
        }
        
        FsAction::Size { path, human } => {
            let size = xfs.size(&path)?;
            if cli.json {
                println!("{}", json!({ "bytes": size, "formatted": sys::format_bytes(size) }));
            } else {
                if human {
                    println!("{}", sys::format_bytes(size).yellow().bold());
                } else {
                    println!("{} bytes", size);
                }
            }
        }
        
        FsAction::Link { src, dest } => {
            xfs.symlink(&src, &dest)?;
            success_msg("Symbolic link created", cli)?;
        }
        
        FsAction::Check { path } => {
            let exists = xfs.exists(&path);
            let readable = xfs.is_readable(&path);
            let writable = xfs.is_writable(&path);
            
            if cli.json {
                print_output(&json!({
                    "exists": exists,
                    "readable": readable,
                    "writable": writable
                }), true, "check")?;
            } else {
                println!("{} Exists:   {}", "•".cyan(), format_bool(exists));
                println!("{} Readable: {}", "•".cyan(), format_bool(readable));
                println!("{} Writable: {}", "•".cyan(), format_bool(writable));
            }
        }
        
        #[cfg(unix)]
        FsAction::Chmod { path, mode } => {
            let mode_num = u32::from_str_radix(&mode, 8)?;
            xfs.chmod(&path, mode_num)?;
            success_msg(&format!("Permissions changed to {}", mode), cli)?;
        }
        
        FsAction::Watch { paths, duration } => {
            let is_json = cli.json;
            if !is_json {
                println!("{} Watching {} paths for {} seconds...", "👁️".cyan(), paths.len(), duration);
            }
            
            let mut watch_ids = Vec::new();
            
            for path in &paths {
                let watch_id = xfs.watch(path, move |event| {
                    if is_json {
                        let (event_type, path_str, old_path) = match event {
                            fs::WatchEventType::Created(p) => ("created", p.to_string_lossy().to_string(), None),
                            fs::WatchEventType::Modified(p) => ("modified", p.to_string_lossy().to_string(), None),
                            fs::WatchEventType::Deleted(p) => ("deleted", p.to_string_lossy().to_string(), None),
                            fs::WatchEventType::Renamed(old, new) => ("renamed", new.to_string_lossy().to_string(), Some(old.to_string_lossy().to_string())),
                        };
                        
                        println!("{}", serde_json::json!({
                            "event": event_type,
                            "path": path_str,
                            "old_path": old_path,
                            "timestamp": chrono::Local::now().to_rfc3339()
                        }));
                    } else {
                        match event {
                            fs::WatchEventType::Created(p) => {
                                println!("{} Created: {}", "✓".green(), p.display());
                            }
                            fs::WatchEventType::Modified(p) => {
                                println!("{} Modified: {}", "~".yellow(), p.display());
                            }
                            fs::WatchEventType::Deleted(p) => {
                                println!("{} Deleted: {}", "✗".red(), p.display());
                            }
                            fs::WatchEventType::Renamed(old, new) => {
                                println!("{} Renamed: {} -> {}", "→".blue(), old.display(), new.display());
                            }
                        }
                    }
                })?;
                watch_ids.push(watch_id);
            }
            
            std::thread::sleep(Duration::from_secs(duration));
            
            for id in watch_ids {
                let _ = xfs.unwatch(&id);
            }
            
            if !cli.json {
                println!("{} Watch ended", "✓".green());
            }
        }
        
        FsAction::WatchContent { paths, duration, diff } => {
            let config = advanced_watcher::WatchConfig {
                duration,
                show_diff: diff,
                is_json: cli.json,
                ..Default::default()
            };
            
            // For now, let's run them in parallel using threads or simple sequential if they block
            // Parallel execution for multiple paths
            let mut handles = Vec::new();
            for path in paths {
                let cfg = config.clone();
                let handle = std::thread::spawn(move || {
                    let _ = advanced_watcher::watch_content(path, cfg);
                });
                handles.push(handle);
            }
            
            for handle in handles {
                let _ = handle.join();
            }
        }
        
        FsAction::Stream { path, chunk_size, hex } => {
            use std::io::Read;
            
            if !cli.quiet {
                println!("{} Streaming '{}' (chunk size: {} bytes)...", 
                    "📡".cyan(), path, chunk_size);
            }
            
            let mut reader = xfs.read_stream(&path)?;
            let mut buffer = vec![0u8; chunk_size];
            let mut total_bytes = 0u64;
            let mut chunk_count = 0usize;
            
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        total_bytes += n as u64;
                        chunk_count += 1;
                        
                        if cli.json {
                            let chunk_data = if hex {
                                buffer[..n].iter()
                                    .map(|b| format!("{:02x}", b))
                                    .collect::<Vec<_>>()
                                    .join(" ")
                            } else {
                                String::from_utf8_lossy(&buffer[..n]).to_string()
                            };
                            
                            println!("{}", serde_json::json!({
                                "chunk": chunk_count,
                                "size": n,
                                "data": chunk_data
                            }));
                        } else {
                            if hex {
                                // Print hex dump format
                                for (i, byte) in buffer[..n].iter().enumerate() {
                                    if i % 16 == 0 && i > 0 {
                                        println!();
                                    }
                                    print!("{:02x} ", byte);
                                }
                                if n % 16 != 0 {
                                    println!();
                                }
                            } else {
                                // Print as text
                                print!("{}", String::from_utf8_lossy(&buffer[..n]));
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("{} Stream error: {}", "✗".red(), e);
                        break;
                    }
                }
            }
            
            if !cli.quiet && !cli.json {
                println!("\n{} Streamed {} bytes in {} chunks", 
                    "✓".green(), total_bytes, chunk_count);
            }
        }
        
        FsAction::Du { path } => {
            let info = xfs.du(&path)?;
            print_output(&info, cli.json, "du")?;
            if !cli.json {
                println!("{} Path: {}", "📂".cyan(), info.path);
                println!("   Size: {}", sys::format_bytes(info.size).yellow());
                println!("   Files: {} | Dirs: {}", info.file_count, info.dir_count);
            }
        }
        
        FsAction::Sync { src, dest } => {
            xfs.mirror(&src, &dest)?;
            success_msg("Sync complete", cli)?;
        }
        
        FsAction::Dedupe { path } => {
            let groups = xfs.find_duplicates(&path)?;
            print_output(&groups, cli.json, "duplicates")?;
            if !cli.json {
                if groups.is_empty() {
                    println!("{} No duplicates found.", "✓".green());
                } else {
                    for group in groups {
                        println!("\n{} Hash: {}", "📝".yellow(), group.hash.dimmed());
                        println!("   Size: {}", sys::format_bytes(group.size));
                        for p in group.paths {
                            println!("   - {}", p);
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

// ============ SEARCH HANDLERS ============

fn handle_search_action(action: SearchAction, root: PathBuf, cli: &Cli) -> Result<()> {
    let xfs = fs::XyPrissFS::new(root)?;

    match action {
        SearchAction::Find { path, pattern } => {
            let results = xfs.find(&path, &pattern)?;
            print_output(&results, cli.json, "results")?;
        }
        
        SearchAction::Ext { path, extension } => {
            let results = xfs.find_by_extension(&path, &extension);
            print_output(&results, cli.json, "results")?;
        }
        
        SearchAction::Modified { path, hours } => {
            let since = SystemTime::now() - Duration::from_secs(hours * 3600);
            let results = xfs.find_modified_since(&path, since);
            print_output(&results, cli.json, "results")?;
        }
        
        SearchAction::Grep { path, pattern, ignore_case } => {
            let pattern = if ignore_case {
                format!("(?i){}", pattern)
            } else {
                pattern
            };
            let results = xfs.grep(&path, &pattern)?;
            print_output(&results, cli.json, "grep")?;
            if !cli.json {
                for (file, lines) in results {
                    println!("\n{}", file.display().to_string().cyan().bold());
                    for line in lines {
                        println!("  {}", line);
                    }
                }
            }
        }
        
        SearchAction::Rename { path, pattern, replacement, dry_run } => {
            if dry_run {
                println!("{} Dry run - no changes will be made", "ℹ".blue());
                let changes = xfs.preview_batch_rename(&path, &pattern, &replacement)?;
                if cli.json {
                    println!("{}", serde_json::to_string_pretty(&changes)?);
                } else {
                    for (old, new) in changes {
                        println!("  {} -> {}", 
                            old.display().to_string().red(), 
                            new.display().to_string().green());
                    }
                }
            } else {
                let pb = create_progress_bar("Renaming files");
                let count = xfs.batch_rename(&path, &pattern, &replacement)?;
                pb.finish_and_clear();
                success_msg(&format!("Successfully renamed {} files", count), cli)?;
            }
        }
    }

    Ok(())
}

// ============ SYSTEM HANDLERS ============

fn handle_sys_action(action: SysAction, cli: &Cli) -> Result<()> {
    let mut sys = sys::XyPrissSys::new();

    match action {
        SysAction::Info { extended } => {
            let info = sys.get_system_info();
            if cli.json {
                println!("{}", serde_json::to_string_pretty(&info)?);
            } else {
                print_system_info(&info, extended);
            }
        }
        
        SysAction::Cpu { cores } => {
            if cores {
                let cpu_info = sys.get_cpu_info();
                print_output(&cpu_info, cli.json, "cpu")?;
            } else {
                let usage = sys.get_cpu_usage();
                print_output(&usage, cli.json, "usage")?;
                if !cli.json {
                    println!("{} Overall: {}%", "CPU".cyan().bold(), format!("{:.1}", usage.overall).yellow());
                    for (i, core_usage) in usage.per_core.iter().enumerate() {
                        print_cpu_bar(i, *core_usage);
                    }
                }
            }
        }
        
        SysAction::Memory { watch } => {
            if watch {
                loop {
                    let mem = sys.get_memory_info();
                    print!("\r{} Used: {} / {} ({:.1}%)  ",
                        "RAM".cyan().bold(),
                        sys::format_bytes(mem.used).yellow(),
                        sys::format_bytes(mem.total),
                        mem.usage_percent
                    );
                    use std::io::Write;
                    std::io::stdout().flush()?;
                    std::thread::sleep(Duration::from_secs(1));
                }
            } else {
                let mem = sys.get_memory_info();
                print_output(&mem, cli.json, "memory")?;
            }
        }
        
        SysAction::Disks { mount } => {
            if let Some(mp) = mount {
                if let Some(disk) = sys.get_disk_by_mount(&mp) {
                    print_output(&disk, cli.json, "disk")?;
                } else {
                    println!("{} Disk not found", "✗".red());
                }
            } else {
                let disks = sys.get_disks_info();
                print_output(&disks, cli.json, "disks")?;
                if !cli.json {
                    for disk in &disks {
                        print_disk_info(&disk);
                    }
                }
            }
        }
        
        SysAction::Network { interface } => {
            if let Some(iface) = interface {
                if let Some(net) = sys.get_network_interface(&iface) {
                    print_output(&net, cli.json, "interface")?;
                }
            } else {
                let stats = sys.get_network_stats();
                print_output(&stats, cli.json, "network")?;
            }
        }
        
        SysAction::Processes { pid, top_cpu, top_mem } => {
            if let Some(p) = pid {
                if let Some(proc) = sys.get_process(p) {
                    print_output(&proc, cli.json, "process")?;
                }
            } else if let Some(n) = top_cpu {
                let procs = sys.get_top_processes_by_cpu(n);
                print_output(&procs, cli.json, "processes")?;
            } else if let Some(n) = top_mem {
                let procs = sys.get_top_processes_by_memory(n);
                print_output(&procs, cli.json, "processes")?;
            } else {
                let stats = sys.get_process_stats();
                print_output(&stats, cli.json, "stats")?;
            }
        }
        
        SysAction::Temp => {
            let temps = sys.get_temperature_stats();
            print_output(&temps, cli.json, "temperatures")?;
        }
        
        SysAction::Health => {
            let score = sys.get_system_health_score();
            print_output(&score, cli.json, "score")?;
            if !cli.json {
                let color = if score > 80 { "green" } else if score > 50 { "yellow" } else { "red" };
                println!("{} System Health: {}%", "♥".red(), format!("{}", score).color(color).bold());
            }
        }
        
        SysAction::Env { var } => {
            if let Some(v) = var {
                if let Some(value) = sys.get_env_var(&v) {
                    print_output(&value, cli.json, "value")?;
                }
            } else {
                let vars = sys.get_env_vars();
                print_output(&vars, cli.json, "env")?;
            }
        }
        
        SysAction::Paths => {
            let paths = sys.get_path_dirs();
            print_output(&paths, cli.json, "paths")?;
        }
        
        SysAction::User => {
            if let Some(user) = sys.get_current_user() {
                print_output(&user, cli.json, "user")?;
            }
        }
        
        SysAction::Kill { pid } => {
            let killed = sys.kill_process(pid)?;
            if killed {
                success_msg(&format!("Process {} killed", pid), cli)?;
            } else {
                println!("{} Failed to kill process {}", "✗".red(), pid);
            }
        }
        
        SysAction::Quick => {
            let stats = sys::get_quick_stats()?;
            println!("{}", stats);
        }

        SysAction::Ports => {
            let ports = sys.get_ports();
            print_output(&ports, cli.json, "ports")?;
            if !cli.json {
                println!("{:<6} {:<25} {:<25} {:<15}", "PROTO", "LOCAL", "REMOTE", "STATE");
                for p in ports {
                    println!("{:<6} {:<25} {:<25} {:<15}", 
                        p.protocol.green(), 
                        format!("{}:{}", p.local_address, p.local_port),
                        format!("{}:{}", p.remote_address, p.remote_port),
                        p.state.yellow()
                    );
                }
            }
        }

        SysAction::Battery => {
            let info = sys.get_battery_info();
            print_output(&info, cli.json, "battery")?;
            if !cli.json {
                if !info.is_present {
                    println!("{} No battery detected", "❌".red());
                } else {
                    println!("{} Battery Status:", "🔋".green());
                    println!("   State:      {:?}", info.state);
                    println!("   Percentage: {:.1}%", info.percentage);
                    println!("   Vendor:     {}", info.vendor);
                    println!("   Model:      {}", info.model);
                }
            }
        }
    }

    Ok(())
}

// ============ MONITOR HANDLERS ============

fn handle_monitor_action(action: MonitorAction, cli: &Cli) -> Result<()> {
    let mut sys = sys::XyPrissSys::new();

    match action {
        MonitorAction::System { duration, interval } => {
            println!("{} Monitoring system for {}s (interval: {}s)", "⚡".yellow(), duration, interval);
            
            sys.monitor(Duration::from_secs(duration), |snapshot| {
                if !cli.json {
                    print!("\r{} CPU: {:.1}%  RAM: {} / {}  Processes: {}  ",
                        "⚡".yellow(),
                        snapshot.cpu_usage,
                        sys::format_bytes(snapshot.memory_used),
                        sys::format_bytes(snapshot.memory_total),
                        snapshot.process_count
                    );
                    use std::io::Write;
                    std::io::stdout().flush().ok();
                }
            });
            println!("\n{} Monitoring complete", "✓".green());
        }
        
        MonitorAction::Process { pid, duration } => {
            println!("{} Monitoring process {} for {}s", "⚡".yellow(), pid, duration);
            
            sys.monitor_process(pid, Duration::from_secs(duration), |info| {
                if !cli.json {
                    print!("\r{} CPU: {:.1}%  RAM: {}  Disk R/W: {} / {}  ",
                        "⚡".yellow(),
                        info.cpu_usage,
                        sys::format_bytes(info.memory),
                        sys::format_bytes(info.disk_read),
                        sys::format_bytes(info.disk_write)
                    );
                    use std::io::Write;
                    std::io::stdout().flush().ok();
                }
            });
            println!("\n{} Monitoring complete", "✓".green());
        }
    }

    Ok(())
}

// ============ ARCHIVE HANDLERS ============

fn handle_archive_action(action: ArchiveAction, root: PathBuf, _cli: &Cli) -> Result<()> {
    let xfs = fs::XyPrissFS::new(root)?;

    match action {
        ArchiveAction::Compress { src, dest } => {
            let pb = create_progress_bar("Compressing");
            xfs.compress_gzip(&src, &dest)?;
            pb.finish_with_message("✓ Compression complete");
        }
        
        ArchiveAction::Decompress { src, dest } => {
            let pb = create_progress_bar("Decompressing");
            xfs.decompress_gzip(&src, &dest)?;
            pb.finish_with_message("✓ Decompression complete");
        }
        
        ArchiveAction::Tar { dir, output } => {
            let pb = create_progress_bar("Creating archive");
            xfs.create_tar(&dir, &output)?;
            pb.finish_with_message("✓ Archive created");
        }
        
        ArchiveAction::Untar { archive, dest } => {
            let pb = create_progress_bar("Extracting");
            xfs.extract_tar(&archive, &dest)?;
            pb.finish_with_message("✓ Extraction complete");
        }
    }

    Ok(())
}


// ============ HELPER FUNCTIONS ============

fn handle_path_action(action: PathAction, xfs: &fs::XyPrissFS, cli: &Cli) -> Result<()> {
    match action {
        PathAction::Resolve { paths } => {
            let mut result = xfs.get_root().clone();
            for p in paths {
                result = result.join(p);
            }
            // Canonicalize if exists, otherwise stay virtual
            let resolved = if result.exists() {
                result.canonicalize().unwrap_or(result)
            } else {
                result
            };
            print_output(&resolved.to_string_lossy(), cli.json, "path")?;
        }
        PathAction::Join { paths } => {
            let mut result = std::path::PathBuf::new();
            for p in paths {
                result.push(p);
            }
            print_output(&result.to_string_lossy(), cli.json, "path")?;
        }
        PathAction::Dirname { path } => {
            let p = std::path::Path::new(&path);
            let result = p.parent().map(|p| p.to_string_lossy()).unwrap_or_default().into_owned();
            print_output(&result, cli.json, "path")?;
        }
        PathAction::Basename { path, suffix } => {
            let p = std::path::Path::new(&path);
            let mut result = p.file_name().map(|s| s.to_string_lossy()).unwrap_or_default().into_owned();
            if let Some(s) = suffix {
                if result.ends_with(&s) {
                    result = result[..result.len() - s.len()].to_string();
                }
            }
            print_output(&result, cli.json, "path")?;
        }
        PathAction::Extname { path } => {
            let p = std::path::Path::new(&path);
            let result = p.extension().map(|s| format!(".{}", s.to_string_lossy())).unwrap_or_default();
            print_output(&result, cli.json, "path")?;
        }
        PathAction::Relative { from, to } => {
            let from_p = xfs.resolve(from);
            let to_p = xfs.resolve(to);
            let result = pathdiff::diff_paths(to_p, from_p).map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
            print_output(&result, cli.json, "path")?;
        }
        PathAction::Normalize { path } => {
            use std::path::Component;
            let p = std::path::Path::new(&path);
            let mut stack = Vec::new();
            for component in p.components() {
                match component {
                    Component::CurDir => {},
                    Component::ParentDir => { stack.pop(); },
                    Component::Normal(c) => { stack.push(c); },
                    _ => { stack.push(component.as_os_str()); }
                }
            }
            let result: std::path::PathBuf = stack.iter().collect();
            print_output(&result.to_string_lossy(), cli.json, "path")?;
        }
    }
    Ok(())
}

fn print_output<T: serde::Serialize>(data: &T, json: bool, _key: &str) -> Result<()> {
    if json {
        println!("{}", serde_json::to_string_pretty(&json!({ "status": "ok", "data": data }))?);
    } else {
        println!("{}", serde_json::to_string_pretty(data)?);
    }
    Ok(())
}

fn success_msg(msg: &str, cli: &Cli) -> Result<()> {
    if cli.json {
        println!("{}", json!({ "status": "ok", "message": msg }));
    } else if !cli.quiet {
        println!("{} {}", "✓".green().bold(), msg);
    }
    Ok(())
}

fn format_bool(b: bool) -> String {
    if b {
        "✓".green().to_string()
    } else {
        "✗".red().to_string()
    }
}

fn create_progress_bar(msg: &str) -> ProgressBar {
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.cyan} {msg}")
            .unwrap()
    );
    pb.set_message(msg.to_string());
    pb.enable_steady_tick(Duration::from_millis(100));
    pb
}

fn print_system_info(info: &sys::SysInfo, extended: bool) {
    println!("\n{}", "System Information".bold().cyan());
    println!("  Hostname:     {}", info.hostname.yellow());
    println!("  OS:           {} {}", info.os_name, info.os_version);
    println!("  Kernel:       {}", info.kernel_version);
    println!("  Architecture: {}", info.architecture);
    println!("  CPU:          {} ({} cores @ {} MHz)", 
        info.cpu_brand, info.cpu_count, info.cpu_frequency);
    println!("  Memory:       {} / {}", 
        sys::format_bytes(info.used_memory).yellow(),
        sys::format_bytes(info.total_memory));
    println!("  Uptime:       {}", sys::format_duration(info.uptime).green());
    
    if extended {
        println!("  Load Avg:     {:.2} {:.2} {:.2}", 
            info.load_average.one, 
            info.load_average.five, 
            info.load_average.fifteen);
    }
}

fn print_disk_info(disk: &sys::DiskInfo) {
    println!("\n{} {}", "💾".cyan(), disk.name.bold());
    println!("  Mount:      {}", disk.mount_point);
    println!("  Type:       {}", disk.file_system);
    println!("  Total:      {}", sys::format_bytes(disk.total_space));
    println!("  Used:       {} ({:.1}%)", 
        sys::format_bytes(disk.used_space).yellow(),
        disk.usage_percent);
    println!("  Available:  {}", sys::format_bytes(disk.available_space).green());
}

fn print_cpu_bar(core: usize, usage: f32) {
    let width = 30;
    let filled = ((usage / 100.0) * width as f32) as usize;
    let bar = "█".repeat(filled) + &"░".repeat(width - filled);
    
    let color = if usage > 80.0 { "red" } else if usage > 50.0 { "yellow" } else { "green" };
    println!("  Core {}: [{}] {:.1}%", core, bar.color(color), usage);
}
