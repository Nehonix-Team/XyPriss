use crate::core::resolver::{PackageJson, Resolver, ResolvedPackage};
use crate::core::installer::Installer;
use std::path::Path;
use std::sync::Arc;
use futures_util::stream::{FuturesUnordered, StreamExt};
use indicatif::{ProgressBar, ProgressStyle, MultiProgress};
use colored::Colorize;
use semver::Version;
use std::collections::HashMap;

pub async fn run(packages: Vec<String>, _use_npm: bool, retries: u32, global: bool) -> anyhow::Result<()> {
    let multi = MultiProgress::new();
    
    // Initial Setup Visual
    let setup_pb = multi.add(ProgressBar::new_spinner());
    setup_pb.set_style(ProgressStyle::default_spinner().template("{spinner:.cyan} {msg}").unwrap());
    setup_pb.set_message("Starting XyPriss engine...");
    setup_pb.enable_steady_tick(std::time::Duration::from_millis(80));

    let current_dir = std::env::current_dir()?;
    let cas_path = if global { 
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        Path::new(&home).join(".xpm_global").join(".xpm_storage") 
    } else { 
        Path::new(".xpm_storage").to_path_buf() 
    };

    let mut registry_client = crate::core::registry::RegistryClient::new(None, retries);
    registry_client.set_cache_dir(cas_path.clone());
    let registry = Arc::new(registry_client);
    
    let target_dir = if global {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        let global_path = Path::new(&home).join(".xpm_global");
        if !global_path.exists() { std::fs::create_dir_all(&global_path)?; }
        global_path
    } else {
        current_dir.clone()
    };
 
    let mut installer = Installer::new(&cas_path, &target_dir, Arc::clone(&registry))?;
    installer.set_multi(multi.clone());
    let installer_shared = Arc::new(installer);

    let mut resolver = Resolver::new(Arc::clone(&registry));
    resolver.set_multi(multi.clone());
    resolver.set_cas(installer_shared.get_cas());
    resolver.set_concurrency(64);

    setup_pb.finish_and_clear();
    multi.println(format!("{} Full installation initiated...", ">".cyan().bold()));

    let mut updates_to_save = HashMap::new();
    let mut skipped_packages = Vec::new();
    let mut installed_summary = Vec::new();

    if packages.is_empty() {
        // --- CASE: Full Project Installation ---
        let pkg_json_path = target_dir.join("package.json");
        if !global && !pkg_json_path.exists() {
             anyhow::bail!("No package.json found in {}.", target_dir.display());
        }

        let pkg = PackageJson::from_file(pkg_json_path.to_str().unwrap())?;
        let root_deps = pkg.all_dependencies();
        
        let _ = multi.println(format!("   {} Project: {} v{}", "-->".green().bold(), pkg.name.bold(), pkg.version.cyan()));
        
        // Ultra-fast parallel dependency analysis with progress bar
        let total_deps = root_deps.len() as u64;
        let analyze_pb = multi.add(ProgressBar::new(total_deps));
        analyze_pb.set_style(ProgressStyle::default_bar()
            .template("{spinner:.cyan} {msg} [{bar:40.cyan/blue}] {pos}/{len}")
            .unwrap()
            .progress_chars("#>-"));
        analyze_pb.set_message(format!("{} Analyzing dependencies", "[*]".cyan()));
        analyze_pb.enable_steady_tick(std::time::Duration::from_millis(80));
        
        // Parallel analysis with FuturesUnordered
        let mut analysis_tasks = FuturesUnordered::new();
        let mut deps_to_resolve = HashMap::new();
        let mut dep_index = 0;
        
        // Removed suspend guard to show output
        
        for (name, req) in &root_deps {
            dep_index += 1;
            let is_last = dep_index == root_deps.len();
            let prefix = if is_last { "└─" } else { "├─" };
            
            let name_c = name.clone();
            let req_c = req.clone();
            let registry_c = Arc::clone(&registry);
            let target_dir_c = target_dir.clone();
            let pb_c = analyze_pb.clone();
            let prefix_c = prefix.to_string();
            
            // Show initial pending state
            pb_c.println(format!("   {} {} {} {}", prefix_c.dimmed(), "[ ]".dimmed(), name_c.bold(), req_c.cyan()));

            analysis_tasks.push(tokio::spawn(async move {
                let mut target_req = req_c.clone();
                if req_c == "latest" || req_c == "*" {
                    if let Ok(pkg_meta) = registry_c.fetch_package(&name_c).await {
                        if let Some(real_max) = find_real_latest(&pkg_meta) {
                            target_req = real_max;
                        }
                    }
                }
                
                let skip = if let Some(local) = get_installed_version(&target_dir_c, &name_c) {
                    local == target_req || (target_req.starts_with('=') && &target_req[1..] == local)
                } else {
                    false
                };
                
                pb_c.inc(1);
                // Update line to done (this is tricky with indicatif in parallel, simpler to just log start/end or keep it simple)
                // For now, let's just log completion if we want matrix style, or just rely on the bar.
                // The user wanted to see WHAT is being analyzed. The println above does that.
                
                (name_c, target_req, skip)
            }));
            
            // Process in batches of 100 for ultra-fast concurrency
            if analysis_tasks.len() >= 100 {
                if let Some(res) = analysis_tasks.next().await {
                    if let Ok((name, target_req, skip)) = res {
                        if !skip {
                            deps_to_resolve.insert(name, target_req);
                        } else {
                            skipped_packages.push((name.clone(), target_req, "Already up to date".to_string()));
                        }
                    }
                }
            }
        }
        
        // Collect remaining results
        while let Some(res) = analysis_tasks.next().await {
            if let Ok((name, target_req, skip)) = res {
                if !skip {
                    deps_to_resolve.insert(name, target_req);
                } else {
                    skipped_packages.push((name.clone(), target_req, "Already up to date".to_string()));
                }
            }
        }
        
        
        analyze_pb.finish_and_clear(); // Clear progress bar AND all tree lines

        if deps_to_resolve.is_empty() {
            multi.println(format!("   {} All dependencies are already up to date.", "✓".green().bold()));
        } else {
            // PIPELINE: Setup eager extraction channel
            let (eager_tx, mut eager_rx) = tokio::sync::mpsc::channel::<ResolvedPackage>(4096);
            resolver.set_eager_tx(eager_tx);

            let installer_eager = Arc::clone(&installer_shared);
            let multi_eager = multi.clone();
            let eager_handle = tokio::spawn(async move {
                let mut tasks = FuturesUnordered::new();
                while let Some(pkg) = eager_rx.recv().await {
                    let inst = Arc::clone(&installer_eager);
                    let mpb = multi_eager.clone();
                    tasks.push(tokio::spawn(async move {
                        let res = inst.ensure_extracted(&pkg).await;
                        if res.is_ok() {
                            if pkg.metadata.dist.unpacked_size > 5 * 1024 * 1024 {
                                mpb.println(format!("   {} Pipeline: Eagerly unpacked heavy package {}", "⚡".yellow().bold(), pkg.name));
                            }
                        }
                        res
                    }));
                    if tasks.len() >= 100 { if let Some(res) = tasks.next().await { res??; } }
                }
                while let Some(res) = tasks.next().await { res??; }
                Ok::<(), anyhow::Error>(())
            });

            let resolve_pb = multi.add(ProgressBar::new_spinner());
            resolve_pb.set_style(ProgressStyle::default_spinner().template("{spinner:.blue} {msg}").unwrap());
            resolve_pb.set_message("Resolving dependency graph...");
            resolve_pb.enable_steady_tick(std::time::Duration::from_millis(80));
            
            let mut resolved_tree = resolver.resolve_tree(&deps_to_resolve).await?;
            resolved_tree.sort_by(|a, b| b.metadata.dist.unpacked_size.cmp(&a.metadata.dist.unpacked_size));
            let resolved_tree_arc = Arc::new(resolved_tree);

            multi.println(format!("\n{} Finalizing storage and artifacts...", "o".magenta().bold()));
            let total_pkgs = resolved_tree_arc.len() as u64;
            let main_pb = multi.add(ProgressBar::new(total_pkgs));
            main_pb.set_style(ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} {msg}")
                .unwrap().progress_chars("=>-"));
            main_pb.set_message("Unpacking remaining...");

            let (tx_ready, mut rx_ready) = tokio::sync::mpsc::channel::<ResolvedPackage>(4096);
            let mut tasks = FuturesUnordered::new();
            
            for pkg in resolved_tree_arc.iter() {
                let inst = Arc::clone(&installer_shared);
                let pkg_c = pkg.clone();
                let mpb = main_pb.clone();
                let tx = tx_ready.clone();
                tasks.push(tokio::spawn(async move {
                    let res = inst.ensure_extracted(&pkg_c).await;
                    if res.is_ok() { 
                        let _ = tx.send(pkg_c).await;
                        mpb.inc(1);
                    }
                    res
                }));
                if tasks.len() >= 100 { if let Some(res) = tasks.next().await { res??; } }
            }
            drop(tx_ready);
            
            let installer_linking = Arc::clone(&installer_shared);
            let final_linking = tokio::spawn(async move {
                 let mut tasks = FuturesUnordered::new();
                 while let Some(pkg) = rx_ready.recv().await {
                     let inst = Arc::clone(&installer_linking);
                     tasks.push(tokio::spawn(async move { inst.link_package_deps(&pkg).await }));
                     if tasks.len() >= 100 { if let Some(res) = tasks.next().await { res??; } }
                 }
                 while let Some(res) = tasks.next().await { res??; }
                 Ok::<(), anyhow::Error>(())
            });

            while let Some(res) = tasks.next().await { res??; }
            main_pb.finish_with_message("Storage preparation complete.");
            final_linking.await??;
            eager_handle.await??;

            multi.println(format!("{} Finalizing workspace...", "->".bold().blue()));
            for (name, req) in &deps_to_resolve {
                if let Some(version) = resolver.find_compatible_version(name, req) {
                    installer_shared.link_to_root(name, &version)?;
                    if root_deps.get(name).map(|r| r == "latest" || r == "*").unwrap_or(false) {
                         updates_to_save.insert(name.clone(), version.clone());
                    }
                    installed_summary.push((name.clone(), version));
                }
            }
        }
    } else {
        // --- CASE: Manual Installation ---
        let mut deps_to_resolve = HashMap::new();
        
        for name in &packages {
            deps_to_resolve.insert(name.clone(), "latest".to_string());
        }

        multi.println(format!("{} Resolving dependency graph...", ":".bold().cyan()));
        let resolved_tree = resolver.resolve_tree(&deps_to_resolve).await?;
        
        multi.println(format!("\n{} Unpacking and linking packages...", "o".magenta().bold()));
        
        // 1. Bulk Unpacking (Download + Extract)
        installer_shared.batch_ensure_extracted(&resolved_tree).await?;
        
        // 2. Parallel Linking (Dependencies)
        let link_tasks = FuturesUnordered::new();
        for pkg in &resolved_tree {
            let inst = Arc::clone(&installer_shared);
            let pkg_c = pkg.clone();
            link_tasks.push(tokio::spawn(async move {
                inst.link_package_deps(&pkg_c).await
            }));
        }
        
        // Await all linking tasks
        link_tasks.collect::<Vec<_>>().await;
        
        // 3. Final Root Linking & Save
        multi.println(format!("{} Finalizing workspace...", "->".bold().blue()));
        for (name, _) in &deps_to_resolve {
             if let Some(version) = resolver.find_compatible_version(name, "*") {
                 installer_shared.link_to_root(name, &version)?;
                 updates_to_save.insert(name.clone(), version.clone());
                 installed_summary.push((name.clone(), version));
             }
        }
    }
    
    for (name, version, reason) in skipped_packages {
        multi.println(format!("   {} {} v{} ({})", "v".green(), name.bold(), version.cyan(), reason.dimmed()));
    }
    for (name, version) in installed_summary {
         multi.println(format!("   {} {} v{}", "+".bold().green(), name.bold(), version.cyan()));
         if global {
              let _ = link_global_binaries(&target_dir, &name, &version);
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

fn link_global_binaries(global_root: &Path, pkg_name: &str, _version: &str) -> anyhow::Result<()> {
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

fn get_installed_version(root: &Path, name: &str) -> Option<String> {
    let pkg_path = root.join("node_modules").join(name).join("package.json");
    if pkg_path.exists() {
        if let Ok(content) = std::fs::read_to_string(pkg_path) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                return v.get("version").and_then(|v| v.as_str()).map(|s| s.to_string());
            }
        }
    }
    None
}

fn parse_package_arg(arg: &str) -> (String, String) {
    let last_at = arg.rfind('@');
    match last_at {
        Some(idx) if idx > 0 => (arg[..idx].to_string(), arg[idx+1..].to_string()),
        _ => (arg.to_string(), "latest".to_string())
    }
}
