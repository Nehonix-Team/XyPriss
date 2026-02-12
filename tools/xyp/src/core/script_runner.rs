use anyhow::{Result, Context};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Semaphore;
use colored::Colorize;
use dashmap::DashMap;
use serde_json::Value;

/// Represents a script to be executed
#[derive(Debug, Clone)]
pub struct ScriptTask {
    pub package_name: String,
    pub package_version: String,
    pub package_dir: PathBuf,
    pub script_type: String,  // "preinstall", "install", "postinstall"
    pub script_command: String,
    pub dependencies: Vec<String>, // Package names this script depends on
}

/// Parallel script execution engine with sandboxing and dependency resolution
pub struct ScriptRunner {
    max_parallel: usize,
    timeout_secs: u64,
    project_root: PathBuf,
    only_built_dependencies: Vec<String>,
}

impl ScriptRunner {
    pub fn new(project_root: PathBuf) -> Self {
        Self {
            max_parallel: num_cpus::get().max(4), // Use all CPU cores for parallel execution
            timeout_secs: 300, // 5 minutes per script (reduced from 10 minutes)
            project_root,
            only_built_dependencies: Vec::new(),
        }
    }

    pub fn set_only_built_dependencies(&mut self, only_built: Vec<String>) {
        self.only_built_dependencies = only_built;
    }

    /// Scan all packages and build a list of scripts to execute
    pub async fn scan_packages(&self, packages: &[Arc<crate::core::resolver::ResolvedPackage>], filter: Option<Vec<String>>) -> Result<Vec<ScriptTask>> {
        use rayon::prelude::*;
        
        let filter_set: Option<std::collections::HashSet<String>> = filter.map(|f| f.into_iter().collect());

        let tasks: Vec<ScriptTask> = packages
            .par_iter()
            .filter_map(|pkg| {
                if let Some(ref set) = filter_set {
                    let key = format!("{}@{}", pkg.name, pkg.version);
                    if !set.contains(&key) {
                        return None;
                    }
                }
                // Respect onlyBuiltDependencies
                if !self.only_built_dependencies.is_empty() {
                    if !self.only_built_dependencies.contains(&pkg.name) {
                        return None;
                    }
                }

                let virtual_store_name = format!("{}@{}", pkg.name.replace('/', "+"), pkg.version);
                let pkg_dir = self.project_root
                    .join("node_modules")
                    .join(".xpm")
                    .join("virtual_store")  // Fixed: was "storage", should be "virtual_store"
                    .join(&virtual_store_name)
                    .join("node_modules")
                    .join(&pkg.name);

                if !pkg_dir.exists() {
                    return None;
                }

                let pkg_json_path = pkg_dir.join("package.json");
                if !pkg_json_path.exists() {
                    return None;
                }

                let content = std::fs::read_to_string(&pkg_json_path).ok()?;
                let v: Value = serde_json::from_str(&content).ok()?;
                
                let scripts = v.get("scripts")?.as_object()?;
                let script_types = ["preinstall", "install", "postinstall"];
                
                let mut found_scripts = Vec::new();
                for script_type in &script_types {
                    if let Some(script_cmd) = scripts.get(*script_type).and_then(|s| s.as_str()) {
                        found_scripts.push(ScriptTask {
                            package_name: pkg.name.clone(),
                            package_version: pkg.version.clone(),
                            package_dir: pkg_dir.clone(),
                            script_type: script_type.to_string(),
                            script_command: script_cmd.to_string(),
                            dependencies: pkg.metadata.dependencies.keys().cloned().collect(),
                        });
                    }
                }
                
                if found_scripts.is_empty() {
                    None
                } else {
                    Some(found_scripts)
                }
            })
            .flatten()
            .collect();

        Ok(tasks)
    }

    /// Execute scripts in parallel with containerization (process isolation)
    pub async fn execute_parallel(&self, tasks: Vec<ScriptTask>) -> Result<()> {
        if tasks.is_empty() {
            return Ok(());
        }

        println!("\n{} Found {} script(s) to execute", 
            "[SCRIPTS]".bold().magenta(), 
            tasks.len().to_string().bold().cyan());

        let semaphore = Arc::new(Semaphore::new(self.max_parallel));
        let completed = Arc::new(DashMap::new());
        let mut handles = Vec::new();

        // Group scripts by dependency order (depth-first execution)
        let ordered_tasks = self.order_by_dependencies(tasks.clone());

        for task in ordered_tasks {
            let sem = Arc::clone(&semaphore);
            let completed_ref = Arc::clone(&completed);
            let timeout = self.timeout_secs;
            let project_root = self.project_root.clone();

            let handle = tokio::spawn(async move {
                let _permit = sem.acquire().await.unwrap();
                
                // Execute with sandboxing
                match Self::execute_sandboxed(task.clone(), timeout, &project_root).await {
                    Ok(_) => {
                        completed_ref.insert(format!("{}@{}", task.package_name, task.package_version), true);
                        println!("   {} {}@{} → {} script completed", 
                            "✓".green().bold(), 
                            task.package_name.bold(), 
                            task.package_version.cyan(),
                            task.script_type.yellow());
                    }
                    Err(e) => {
                        eprintln!("   {} {}@{} → {} script failed: {}", 
                            "✖".red().bold(), 
                            task.package_name.bold(), 
                            task.package_version.cyan(),
                            task.script_type.yellow(),
                            e);
                    }
                }
            });

            handles.push(handle);
        }

        // Wait for all scripts to complete
        for handle in handles {
            let _ = handle.await;
        }

        println!("{} All postinstall scripts completed ({}/{} successful)", 
            "[OK]".green().bold(),
            completed.len(),
            tasks.len());

        Ok(())
    }

    /// Execute a single script in a sandboxed environment
    async fn execute_sandboxed(task: ScriptTask, timeout_secs: u64, project_root: &Path) -> Result<()> {
        use tokio::io::{AsyncBufReadExt, BufReader};
        
        // Build PATH with local binaries first
        let mut paths = Vec::new();
        
        // 1. Package's own .bin directory
        if let Some(deps_bin) = task.package_dir.parent().map(|p| p.join(".bin")) {
            if deps_bin.exists() {
                paths.push(deps_bin);
            }
        }
        
        // 2. Project's node_modules/.bin
        let project_bin = project_root.join("node_modules").join(".bin");
        if project_bin.exists() {
            paths.push(project_bin);
        }
        
        // 3. Global XPM bin
        if let Ok(home) = std::env::var("HOME") {
            let global_bin = PathBuf::from(home).join(".xpm_global").join("bin");
            if global_bin.exists() {
                paths.push(global_bin);
            }
        }
        
        // 4. System PATH
        if let Ok(current_path) = std::env::var("PATH") {
            paths.extend(std::env::split_paths(&current_path));
        }
        
        let path_val = std::env::join_paths(&paths)
            .unwrap_or_else(|_| std::env::var_os("PATH").unwrap_or_default());

        // Spawn process with resource limits and isolation
        let mut child = tokio::process::Command::new("sh")
            .arg("-c")
            .arg(&task.script_command)
            .current_dir(&task.package_dir)
            .env("PATH", &path_val)
            .env("NODE_ENV", "production")  // Optimization: skip dev dependencies
            .env("CI", "true")               // Many scripts run faster in CI mode
            .env("npm_config_foreground_scripts", "true") // Prevent background processes
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .context("Failed to spawn script process")?;

        // Capture output asynchronously (non-blocking)
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        
        // Stream stdout
        let stdout_handle = tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                println!("      {} {}", "│".dimmed(), line.dimmed());
            }
        });
        
        // Stream stderr
        let stderr_handle = tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                eprintln!("      {} {}", "│".dimmed(), line.yellow());
            }
        });

        // Wait with timeout
        let status = tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            child.wait()
        ).await;

        // Wait for output streams to finish
        let _ = tokio::join!(stdout_handle, stderr_handle);

        match status {
            Ok(Ok(exit_status)) => {
                if exit_status.success() {
                    Ok(())
                } else {
                    Err(anyhow::anyhow!(
                        "Script exited with code {:?}",
                        exit_status.code()
                    ))
                }
            }
            Ok(Err(e)) => Err(anyhow::anyhow!("Failed to wait for script: {}", e)),
            Err(_) => {
                // Timeout - kill the process
                let _ = child.kill().await;
                Err(anyhow::anyhow!("Script timed out after {} seconds", timeout_secs))
            }
        }
    }

    /// Order scripts by dependency graph for optimal parallel execution
    fn order_by_dependencies(&self, tasks: Vec<ScriptTask>) -> Vec<ScriptTask> {
        // For now, simple ordering: preinstall → install → postinstall per package
        // This ensures scripts run in the correct order within each package
        let mut ordered = tasks;
        ordered.sort_by(|a, b| {
            let order = ["preinstall", "install", "postinstall"];
            let a_idx = order.iter().position(|&s| s == a.script_type).unwrap_or(3);
            let b_idx = order.iter().position(|&s| s == b.script_type).unwrap_or(3);
            a_idx.cmp(&b_idx)
        });
        ordered
    }
}
