use clap::{Parser, Subcommand};
use std::path::PathBuf;
use colored::*;
use super::server;

#[derive(Parser, Debug)]
#[command(name = "xsys")]
#[command(disable_help_flag = true)]
#[command(disable_help_subcommand = true)]
#[command(disable_version_flag = true)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    /// Target root
    #[arg(short, long, env = "XYPRISS_ROOT")]
    pub root: Option<PathBuf>,

    /// JSON Mode
    #[arg(short, long, global = true)]
    pub json: bool,

    /// Verbosity
    #[arg(short, long, global = true)]
    pub verbose: bool,

    /// Silence
    #[arg(short, long, global = true)]
    pub quiet: bool,
}

#[derive(Subcommand, Clone, Debug)]
pub enum Commands {
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
    /// XHSC (XyPriss Hyper-System Core) operations
    Server {
        #[command(subcommand)]
        action: server::ServerAction,
    },
}

#[derive(Subcommand, Clone, Debug)]
pub enum PathAction {
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

#[derive(Subcommand, Clone, Debug)]
pub enum FsAction {
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

#[derive(Subcommand, Clone, Debug)]
pub enum SearchAction {
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

#[derive(Subcommand, Clone, Debug)]
pub enum SysAction {
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

#[derive(Subcommand, Clone, Debug)]
pub enum MonitorAction {
    /// Monitor system continuously
    System {
        /// Duration in seconds
        #[arg(short, long, default_value = "60")]
        duration: u64,
        /// Update interval in seconds
        #[arg(short, long, default_value = "1")]
        interval: f64,
    },
    /// Monitor specific process
    Process {
        pid: u32,
        /// Duration in seconds
        #[arg(short, long, default_value = "60")]
        duration: u64,
    },
}

#[derive(Subcommand, Clone, Debug)]
pub enum ArchiveAction {
    /// Compress file with GZIP
    Compress {
        #[arg(short, long)]
        src: String,
        #[arg(short, long)]
        dest: String,
    },
    /// Decompress GZIP file
    Decompress {
        #[arg(short, long)]
        src: String,
        #[arg(short, long)]
        dest: String,
    },
    /// Create TAR archive
    Tar {
        #[arg(short, long)]
        dir: String,
        #[arg(short, long)]
        output: String,
    },
    /// Extract TAR archive
    Untar {
        #[arg(short, long)]
        archive: String,
        #[arg(short, long)]
        dest: String,
    },
}

pub fn print_restricted_warning() {
    println!("{}", "*******************************************************************************".red().bold());
    println!("{}", "* NEHONIX INTERNAL TOOL - RESTRICTED ACCESS                                     *".red().bold());
    println!("{}", "* This software is the exclusive property of NEHONIX operations.              *".red().bold());
    println!("{}", "* Unauthorized use, distribution, or analysis is strictly prohibited.         *".red().bold());
    println!("{}", "*******************************************************************************\n".red().bold());
}
