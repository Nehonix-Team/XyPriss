use crate::core::resolver::{PackageJson, Resolver, ResolvedPackage};
use crate::core::installer::Installer;
use std::path::Path;
use std::sync::Arc;
use futures_util::stream::{FuturesUnordered, StreamExt};
use indicatif::{ProgressBar, ProgressStyle};
use colored::Colorize;
use semver::Version;
use std::collections::HashMap;

pub async fn run(packages: Vec<String>, _use_npm: bool, retries: u32, global: bool) -> anyhow::Result<()> {
    let multi = indicatif::MultiProgress::new();
    let current_dir = std::env::current_dir()?;
    let registry = Arc::new(crate::core::registry::RegistryClient::new(None, retries));
    
    let target_dir = if global {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        let global_path = Path::new(&home).join(".xpm_global");
        if !global_path.exists() { std::fs::create_dir_all(&global_path)?; }
        global_path
    } else {
        current_dir.clone()
    };
    
    let cas_path = if global { 
        target_dir.join(".xpm_storage") 
    } else { 
        Path::new(".xpm_storage").to_path_buf() 
    };

    let mut installer = Installer::new(&cas_path, &target_dir, registry.clone())?;
    installer.set_multi(multi.clone());
    
    let mut resolver = Resolver::new(registry.clone());
    resolver.set_multi(multi.clone());

    let mut updates_to_save = HashMap::new();

    if packages.is_empty() {
        // --- CASE: Full Project Installation (e.g. after xyp init) ---
        println!("{} Full installation initiated...", "[INSTALL]".cyan().bold());
        let pkg_json_path = target_dir.join("package.json");

        if !global {
            if !pkg_json_path.exists() {
                 anyhow::bail!("No package.json found in {}.", target_dir.display());
            }

            let pkg = PackageJson::from_file(pkg_json_path.to_str().unwrap())?;
            println!("   {} Project: {} v{}", "[PROJECT]".green().bold(), pkg.name.bold(), pkg.version.cyan());
            
            let root_deps = pkg.all_dependencies();
            let mut final_deps = root_deps.clone();
            
            // Resolve "latest" / "*" to real max versions before resolution
            for (name, req) in &root_deps {
                if req == "latest" || req == "*" {
                    if let Ok(pkg_meta) = registry.fetch_package(name).await {
                        if let Some(real_max) = find_real_latest(&pkg_meta) {
                            final_deps.insert(name.clone(), real_max);
                        }
                    }
                }
            }

            let resolve_pb = multi.add(ProgressBar::new_spinner());
            resolve_pb.set_style(ProgressStyle::default_spinner().template("{spinner:.blue} {msg}").unwrap());
            resolve_pb.set_message("Resolving dependency graph...");
            resolve_pb.enable_steady_tick(std::time::Duration::from_millis(80));
            
            let resolved_tree = Arc::new(resolver.resolve_tree(&final_deps).await?);
            resolve_pb.finish_with_message(format!("Resolution complete. Found {} unique package versions.", resolved_tree.len()));

            println!("\n{} Building virtual store and extracting artifacts...", "[PROCESS]".magenta().bold());
            
            let total_pkgs = resolved_tree.len() as u64;
            let main_pb = multi.add(ProgressBar::new(total_pkgs));
            main_pb.set_style(ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} {msg}")
                .unwrap()
                .progress_chars("#>-"));
            main_pb.set_message("Processing virtual store...");

            let (tx_ready, mut rx_ready) = tokio::sync::mpsc::channel::<ResolvedPackage>(4096);
            let installer_shared = Arc::new(installer);
            let mut tasks = FuturesUnordered::new();
            
            for pkg in resolved_tree.iter() {
                let inst = Arc::clone(&installer_shared);
                let pkg_c = pkg.clone();
                let mpb = main_pb.clone();
                let tx = tx_ready.clone();
                tasks.push(tokio::spawn(async move {
                    let res = inst.ensure_extracted(&pkg_c).await;
                    if res.is_ok() { 
                        mpb.println(format!("   {} Unpacked {}", "✓".dimmed(), pkg_c.name));
                        let _ = tx.send(pkg_c).await;
                        mpb.inc(1);
                    }
                    res
                }));
                if tasks.len() >= 60 { if let Some(res) = tasks.next().await { res??; } }
            }
            drop(tx_ready);
            
            let installer_c = Arc::clone(&installer_shared);
            let final_linking = tokio::spawn(async move {
                 let mut tasks = FuturesUnordered::new();
                 while let Some(pkg) = rx_ready.recv().await {
                     let inst = Arc::clone(&installer_c);
                     tasks.push(tokio::spawn(async move { inst.link_package_deps(&pkg).await }));
                     if tasks.len() >= 80 { if let Some(res) = tasks.next().await { res??; } }
                 }
                 while let Some(res) = tasks.next().await { res??; }
                 Ok::<(), anyhow::Error>(())
            });

            while let Some(res) = tasks.next().await { res??; }
            main_pb.finish_with_message("Storage preparation complete.");
            final_linking.await??;

            println!("{} Finalizing workspace and linking dependencies...", "→".bold().blue());
            for (name, req) in &final_deps {
                if let Some(version) = resolver.find_compatible_version(name, req) {
                    installer_shared.link_to_root(name, &version)?;
                    // Only update json if it was a fuzzy req (check against ORIGINAL root_deps)
                    if root_deps.get(name).map(|r| r == "latest" || r == "*").unwrap_or(false) {
                         updates_to_save.insert(name.clone(), version);
                    }
                }
            }
        }
    } else {
        // --- CASE: Manual Installation (e.g. xyp install xynginc@1.0.11) ---
        let mut deps_to_resolve = HashMap::new();
        let mut installed_summary = Vec::new();
        
        let analyze_pb = multi.add(ProgressBar::new_spinner());
        analyze_pb.set_message("Analysing specific versions...");
        analyze_pb.enable_steady_tick(std::time::Duration::from_millis(80));

        for pkg_arg in packages {
            let (name, req_ver) = parse_package_arg(&pkg_arg);
            let mut target_ver = req_ver.clone();
            
            // Force EXACT version if specified without range characters
            if req_ver != "latest" && !req_ver.is_empty() && 
               !req_ver.contains(|c| c == '^' || c == '~' || c == '>' || c == '<' || c == '*') {
                target_ver = format!("={}", req_ver);
            }

            if req_ver == "latest" {
                 if let Ok(pkg_meta) = registry.fetch_package(&name).await {
                      if let Some(real_max) = find_real_latest(&pkg_meta) {
                           target_ver = real_max;
                      }
                 }
            }
            
            // Logic change: If version is specific (like 1.0.11), we check CAS
            // for EXACTLY that version, otherwise we resolve it as a fixed target.
            deps_to_resolve.insert(name, target_ver);
        }
        analyze_pb.finish_and_clear();

        if !deps_to_resolve.is_empty() {
             println!("{} Installing new packages...", "→".bold().cyan());
             
             let resolved_tree = match resolver.resolve_tree(&deps_to_resolve).await {
                Ok(tree) => Arc::new(tree),
                Err(e) => {
                    println!("{} Resolution failed: {}", "✘".bold().red(), e);
                    return Ok(());
                }
            };

            let total_pkgs = resolved_tree.len() as u64;
            let main_pb = multi.add(ProgressBar::new(total_pkgs));
            main_pb.set_style(ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} {msg}")
                .unwrap().progress_chars("#>-"));

            let installer_shared = Arc::new(installer);
            let mut tasks = FuturesUnordered::new();
            
            for pkg in resolved_tree.iter() {
                let inst = Arc::clone(&installer_shared);
                let pkg_c = pkg.clone();
                let mpb = main_pb.clone();
                tasks.push(tokio::spawn(async move {
                    let res = inst.ensure_extracted(&pkg_c).await;
                     if res.is_ok() { 
                        mpb.inc(1);
                        mpb.println(format!("   {} Unpacked {}", "✓".dimmed(), pkg_c.name));
                        inst.link_package_deps(&pkg_c).await?;
                    }
                    res
                }));
                if tasks.len() >= 40 { if let Some(res) = tasks.next().await { res??; } }
            }
            while let Some(res) = tasks.next().await { res??; }
            main_pb.finish_with_message("Packages installed.");

            println!("{} Finalizing root dependencies...", "→".bold().blue());
            for (name, req) in &deps_to_resolve {
                if let Some(version) = resolver.find_compatible_version(name, req) {
                    installer_shared.link_to_root(name, &version)?;
                    updates_to_save.insert(name.clone(), version.clone());
                    installed_summary.push((name.clone(), version));
                }
            }
        }
        
        for (name, version) in installed_summary {
             if deps_to_resolve.contains_key(&name) {
                 println!("   {} {} v{}", "+".bold().green(), name.bold(), version.cyan());
             }
             if global {
                  if let Err(e) = link_global_binaries(&target_dir, &name, &version) {
                      println!("   {} Failed to link binary: {}", "⚠".bold().yellow(), e);
                  }
             }
        }
    }

    if !global && !updates_to_save.is_empty() {
        update_package_json_batch(&target_dir, &updates_to_save).ok();
    }

    println!();
    println!("{} XyPriss Installation complete", "✓".bold().green());
    if global {
        let bin_path = target_dir.join("bin");
        println!("   {} Global binaries installed to: {}", "ℹ".bold().blue(), bin_path.display());
        crate::utils::shell::ensure_global_path_is_configured(&bin_path);
    }
    println!("{}", "   Powered by Nehonix™ & XyPriss Engine".truecolor(100, 100, 100).italic());
    println!();

    Ok(())
}

/// Force finding the absolute highest stable version from metadata
fn find_real_latest(meta: &crate::core::registry::RegistryPackage) -> Option<String> {
    let mut versions: Vec<Version> = meta.versions.keys()
        .filter_map(|v| Version::parse(v).ok())
        .filter(|v| v.pre.is_empty())
        .collect();
    versions.sort();
    versions.last().map(|v| v.to_string())
}

fn update_package_json_batch(root: &Path, updates: &HashMap<String, String>) -> anyhow::Result<()> {
    let pkg_path = root.join("package.json");
    if !pkg_path.exists() { return Ok(()); } 
    let content = std::fs::read_to_string(&pkg_path)?;
    let mut json: serde_json::Value = serde_json::from_str(&content)?;

    if let Some(obj) = json.as_object_mut() {
        for (name, version) in updates {
            let version_req = format!("^{}", version);
            let mut updated = false;
            if let Some(dev_deps) = obj.get_mut("devDependencies").and_then(|v| v.as_object_mut()) {
                if dev_deps.contains_key(name) {
                    dev_deps.insert(name.clone(), serde_json::Value::String(version_req.clone()));
                    updated = true;
                }
            }
            if !updated {
                if !obj.contains_key("dependencies") { obj.insert("dependencies".to_string(), serde_json::json!({})); }
                if let Some(deps) = obj.get_mut("dependencies").and_then(|v| v.as_object_mut()) {
                    deps.insert(name.clone(), serde_json::Value::String(version_req));
                }
            }
        }
    }
    let new_content = serde_json::to_string_pretty(&json)?;
    std::fs::write(pkg_path, new_content)?;
    Ok(())
}

fn link_global_binaries(global_root: &Path, pkg_name: &str, version: &str) -> anyhow::Result<()> {
    let pkg_path = global_root.join("node_modules").join(pkg_name);
    let pkg_json_path = pkg_path.join("package.json");
    if !pkg_json_path.exists() { return Ok(()); }
    let content = std::fs::read_to_string(&pkg_json_path)?;
    let json: serde_json::Value = serde_json::from_str(&content)?;
    let bin_dir = global_root.join("bin");
    if !bin_dir.exists() { std::fs::create_dir_all(&bin_dir)?; }
    if let Some(bin_field) = json.get("bin") {
        if let Some(bin_map) = bin_field.as_object() {
            for (bin_cmd, bin_rel_path_val) in bin_map {
                if let Some(bin_rel_path) = bin_rel_path_val.as_str() {
                     create_global_symlink(&bin_dir, &pkg_path, bin_cmd, bin_rel_path)?;
                }
            }
        } else if let Some(bin_path_str) = bin_field.as_str() {
             let bin_cmd = pkg_name.split('/').last().unwrap_or(pkg_name);
             create_global_symlink(&bin_dir, &pkg_path, bin_cmd, bin_path_str)?;
        }
    }
    Ok(())
}

fn create_global_symlink(bin_dir: &Path, pkg_path: &Path, bin_name: &str, rel_path: &str) -> anyhow::Result<()> {
    let target = pkg_path.join(rel_path);
    let link_path = bin_dir.join(bin_name);
    if link_path.exists() { std::fs::remove_file(&link_path).ok(); }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(_meta) = std::fs::metadata(&target) {
            let perms = std::fs::Permissions::from_mode(0o755);
            std::fs::set_permissions(&target, perms).ok();
        }
        std::os::unix::fs::symlink(&target, &link_path)?;
    }
    Ok(())
}

fn parse_package_arg(arg: &str) -> (String, String) {
    let last_at = arg.rfind('@');
    match last_at {
        Some(idx) if idx > 0 => (arg[..idx].to_string(), arg[idx+1..].to_string()),
        _ => (arg.to_string(), "latest".to_string())
    }
}
