use std::path::{Path, PathBuf};
use anyhow::{Result, Context};
use std::process::Command;
use colored::Colorize;

pub async fn run(command: String, args: Vec<String>) -> Result<()> {
    let current_dir = std::env::current_dir()?;
    
    // 1. Check local node_modules/.bin (Priority 1: Project's existing binaries)
    let local_bin = current_dir.join("node_modules").join(".bin").join(&command);
    if local_bin.exists() {
        return execute_bin(&local_bin, args);
    }
    
    // 2. Check local package.json (Priority 2: Declared but not installed binaries)
    let pkg_json_path = current_dir.join("package.json");
    if pkg_json_path.exists() {
        let pkg = crate::core::resolver::PackageJson::from_file(&pkg_json_path)?;
        if pkg.dependencies.contains_key(&command) || pkg.dev_dependencies.contains_key(&command) {
            println!("{} Command '{}' declared in package.json. Installing locally...", "[*]".cyan(), command);
            crate::commands::install::run(vec![], false, 3, false, false, false, false).await?;
            if local_bin.exists() {
                return execute_bin(&local_bin, args);
            }
        }
    }

    // 3. Execution Cache (Priority 3: External/Transient tools)
    // We isolate versions here to avoid Project A (v8) conflicting with Project Z (v5).
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    
    // Find the latest version available in registry to check or install
    let mut registry = crate::core::registry::RegistryClient::new(None, 3);
    let pkg_meta = registry.fetch_package(&command).await
        .context(format!("Could not find package '{}' in registry", command))?;
    let version = pkg_meta.dist_tags.get("latest").cloned()
        .ok_or_else(|| anyhow::anyhow!("No 'latest' tag for package '{}'", command))?;
    
    let exec_cache_root = Path::new(&home).join(".xpm_global").join("exec_cache");
    let versioned_root = exec_cache_root.join(format!("{}@{}", command.replace('/', "+"), version));
    let cached_bin = versioned_root.join("node_modules").join(".bin").join(&command);

    if cached_bin.exists() {
        return execute_bin(&cached_bin, args);
    }

    println!("{} Command '{}' not found. Fetching {}@{}...", "[!]".yellow(), command, command, version);
    
    // Install the package into the versioned isolated directory
    // We use a trick: we tell the installer the "project_root" is our versioned cache dir
    let cas_path = Path::new(&home).join(".xpm_global").join(".xpm_storage");
    let registry_arc = std::sync::Arc::new(registry);
    let mut installer = crate::core::installer::Installer::new(&cas_path, &versioned_root, registry_arc.clone())?;
    
    // Resolve and install specific version
    let mut resolver = crate::core::resolver::Resolver::new(registry_arc);
    let mut deps = std::collections::HashMap::new();
    deps.insert(command.clone(), version.clone());
    let resolved = resolver.resolve_tree(&deps).await?;
    
    installer.batch_ensure_extracted(&resolved).await?;
    for pkg in &resolved {
        installer.link_package_deps(pkg).await?;
        // Link to root here means linking to our CACHE root (the node_modules we just created)
        installer.link_to_root(&pkg.name, &pkg.version)?;
    }

    if cached_bin.exists() {
        print!("\x1B[2J\x1B[1;1H");
        return execute_bin(&cached_bin, args);
    }

    anyhow::bail!("Command '{}' resolved but binary not found in isolated cache.", command);
}

fn execute_bin(path: &Path, args: Vec<String>) -> Result<()> {
    let mut child = Command::new(path)
        .args(args)
        .spawn()
        .context(format!("Failed to execute '{}'", path.display()))?;
        
    let status = child.wait()?;
    if !status.success() {
        std::process::exit(status.code().unwrap_or(1));
    }
    Ok(())
}
