use crate::core::resolver::{PackageJson, Resolver, ResolvedPackage};
use crate::core::cas::Cas;
use crate::core::installer::Installer;
use std::path::Path;
use std::sync::Arc;
use futures_util::stream::{FuturesUnordered, StreamExt};
use indicatif::{ProgressBar, ProgressStyle, MultiProgress};
use colored::Colorize;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DependencyType {
    Regular,
    Dev,
    Optional,
    Peer,
}

pub async fn run(
    packages: Vec<String>, 
    _use_npm: bool, 
    retries: u32, 
    global: bool,
    dev: bool,
    optional: bool,
    peer: bool,
    exact: bool,
    _save: bool,
    update: bool,
) -> anyhow::Result<()> {
    let dep_type = if dev { DependencyType::Dev }
        else if optional { DependencyType::Optional }
        else if peer { DependencyType::Peer }
        else { DependencyType::Regular };

    let start_time = std::time::Instant::now();
    let multi = MultiProgress::new();
    
    let setup_pb = multi.add(ProgressBar::new_spinner());
    setup_pb.set_style(ProgressStyle::default_spinner().template("{spinner:.cyan} {msg}").unwrap());
    setup_pb.set_message("Starting XyPriss engine...");
    setup_pb.enable_steady_tick(std::time::Duration::from_millis(80));

    let current_dir = std::env::current_dir()?;
    let cas_path = if global { 
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        Path::new(&home).join(".xpm_global").join(".xpm_storage") 
    } else { 
        let new_path = current_dir.join("node_modules").join(".xpm").join("storage");
        migrate_legacy_storage(&current_dir, &new_path);
        new_path
    };

    let mut registry_client = crate::core::registry::RegistryClient::new(None, retries);
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let global_cache_dir = std::path::Path::new(&home).join(".xpm_cache");
    let _ = Cas::create_dir_all_secure(&global_cache_dir);
    registry_client.set_cache_dir(global_cache_dir);
    let registry = Arc::new(registry_client);
    
    let target_dir = if global {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        let global_path = Path::new(&home).join(".xpm_global");
        if !global_path.exists() { Cas::create_dir_all_secure(&global_path)?; }
        global_path
    } else {
        current_dir.clone()
    };
 
    // 1. Determine Dependencies to Resolve & Pnpm Config
    let mut deps_to_resolve = HashMap::new();
    let mut root_overrides = HashMap::new();
    let mut only_built = Vec::new();
    let mut patched_deps = HashMap::new();

    if !global && target_dir.join("package.json").exists() {
        if let Ok(pkg_json) = PackageJson::from_file(target_dir.join("package.json").to_str().unwrap()) {
            let all = pkg_json.all_dependencies();
            for (name, req) in all {
                if req.starts_with("workspace:") {
                    continue;
                }
                deps_to_resolve.insert(name, req);
            }
            if let Some(pnpm) = pkg_json.pnpm {
                root_overrides.extend(pnpm.overrides);
                root_overrides.extend(pnpm.resolutions);
                only_built = pnpm.only_built_dependencies;
                patched_deps = pnpm.patched_dependencies;
            }
            let _ = multi.println(format!("   {} Project: {} v{}", "-->".green().bold(), pkg_json.name.bold(), pkg_json.version.cyan()));
        }
    }

    let mut installer = Installer::new(&cas_path, &target_dir, Arc::clone(&registry))?;
    installer.set_multi(multi.clone());
    installer.set_update(update);
    installer.set_pnpm_config(only_built.clone(), patched_deps);
    let installer_shared = Arc::new(installer);

    let mut resolver = Resolver::new(Arc::clone(&registry));
    resolver.set_multi(multi.clone());
    resolver.set_cas(installer_shared.get_cas());
    resolver.set_concurrency(128); 
    resolver.set_update(update && packages.is_empty());
    if !packages.is_empty() && update {
        resolver.set_force_update_packages(packages.iter().map(|p| parse_package_arg(p).0).collect());
    }
    resolver.load_catalogs(&target_dir);
    resolver.set_overrides(root_overrides);
    let resolver_shared = Arc::new(resolver);

    setup_pb.finish_and_clear();

    if !global {
        let _ = Cas::create_dir_all_secure(target_dir.join("node_modules").join(".xpm"));
    }

    let _ = multi.println(format!("{} Full installation initiated...", "[>>]".cyan().bold()));
    let _ = multi.println(format!("{} Scanning neural gateway...", "[*]".dimmed()));

    // Merge with command-line packages
    let mut direct_pkgs_to_link = HashMap::new();
    for pkg_req in &packages {
        let (name, ver) = parse_package_arg(pkg_req);
        deps_to_resolve.insert(name.clone(), ver.clone());
        direct_pkgs_to_link.insert(name, ver);
    }

    // If it's a "Full Install" (no packages provided), all current dependencies are "direct" for linking priority
    if packages.is_empty() {
        direct_pkgs_to_link = deps_to_resolve.clone();
    }

    if deps_to_resolve.is_empty() {
        anyhow::bail!("No packages specified and no package.json found.");
    }

    // 2. Resolve Tree
    let unpacking_pb = multi.add(ProgressBar::new(deps_to_resolve.len() as u64));
    unpacking_pb.set_style(ProgressStyle::default_bar()
        .template("{spinner:.green} [MATRIX_CORE] Unpacking: [{bar:40.green/black}] {pos}/{len} ({percent}%) -> {msg}")
        .unwrap().progress_chars("10"));
    unpacking_pb.set_message("Initializing neural stream...");
    unpacking_pb.enable_steady_tick(std::time::Duration::from_millis(50));
    installer_shared.set_main_pb(unpacking_pb.clone());

    let (eager_tx, mut eager_rx) = tokio::sync::mpsc::channel::<Arc<ResolvedPackage>>(4096);
    resolver_shared.set_eager_tx(eager_tx);

    let installer_eager = Arc::clone(&installer_shared);
    let upb = unpacking_pb.clone();
    let is_update = update;
    let eager_handle = tokio::spawn(async move {
        let mut tasks = FuturesUnordered::new();
        let depacking_semaphore = Arc::new(tokio::sync::Semaphore::new(128)); 
        
        while let Some(pkg) = eager_rx.recv().await {
            // Dynamically grow the progress bar as we discover transitive dependencies
            let current_pos = upb.position();
            let current_len = upb.length().unwrap_or(0);
            if current_pos >= current_len {
                upb.set_length(current_len + 50); 
            }

            if installer_eager.is_package_extracted(&pkg.name, &pkg.version) && !is_update {
                upb.inc(1);
                continue;
            }

            let inst = Arc::clone(&installer_eager);
            let upb_c = upb.clone();
            let sem = Arc::clone(&depacking_semaphore);
            let pkg_c = Arc::clone(&pkg);
            
            tasks.push(tokio::spawn(async move {
                let _permit = sem.acquire().await;
                let res = inst.ensure_extracted(&pkg_c).await;
                upb_c.inc(1);
                res
            }));
            if tasks.len() > 128 { if let Some(res) = tasks.next().await { res??; } }
        }
        while let Some(res) = tasks.next().await { res??; }
        Ok::<(), anyhow::Error>(())
    });

    let resolved_tree = Arc::clone(&resolver_shared).resolve_tree(&deps_to_resolve).await?;
    multi.println(format!("{} Graph stable. Neural sequence unlocked.", "[OK]".green().bold())).unwrap();
    
    // Synchronize progress bar with actual final count
    unpacking_pb.set_length(resolved_tree.len() as u64);
    if unpacking_pb.position() > resolved_tree.len() as u64 {
        unpacking_pb.set_length(unpacking_pb.position());
    }

    let resolved_tree_arc = Arc::new(resolved_tree);
    resolver_shared.clear_eager_tx(); 
    eager_handle.await??;
    unpacking_pb.finish_and_clear();

    multi.println(format!("\n{} Finalizing storage and artifacts...", "[*]".magenta().bold())).unwrap();

    // 3. Link Package Internals (within the virtual store)
    let (tx_ready, mut rx_ready) = tokio::sync::mpsc::channel::<Arc<ResolvedPackage>>(4096);
    let installer_linking = Arc::clone(&installer_shared);
    
    let linking_handle = tokio::spawn(async move {
         let mut tasks = FuturesUnordered::new();
         while let Some(pkg) = rx_ready.recv().await {
             let inst = Arc::clone(&installer_linking);
             tasks.push(tokio::spawn(async move { inst.link_package_deps(&pkg).await }));
             if tasks.len() >= 128 { if let Some(res) = tasks.next().await { res??; } }
         }
         while let Some(res) = tasks.next().await { res??; }
         Ok::<(), anyhow::Error>(())
    });

    for pkg in resolved_tree_arc.iter() {
        let _ = tx_ready.send(pkg.clone()).await;
    }
    drop(tx_ready);
    
    // 4. Finalize Project (Hoisting & Priority Linking)
    let mut updates_to_save = HashMap::new();
    let mut installed_summary = Vec::new();
    finalize_installation(&installer_shared, &multi, &resolved_tree_arc, &direct_pkgs_to_link, &resolver_shared, &mut updates_to_save, &mut installed_summary).await?;
    linking_handle.await??;

    // 5. Post-installation scripts
    multi.println(format!("{} Executing post-installation sequence...", "[>>]".bold().green())).unwrap();
    let mut script_runner = crate::core::script_runner::ScriptRunner::new(target_dir.clone());
    script_runner.set_only_built_dependencies(only_built);
    
    // Only run scripts for packages that were actually changed/installed in this run
    let changed = installer_shared.get_changed_packages();
    let script_tasks = script_runner.scan_packages(&resolved_tree_arc, Some(changed)).await?;
    script_runner.execute_parallel(script_tasks).await?;

    
    // 6. Global Binary Export
    if global && !installed_summary.is_empty() {
        let bin_dir = target_dir.join("bin");
        if !bin_dir.exists() { Cas::create_dir_all_secure(&bin_dir)?; }
        for (name, version) in &installed_summary {
             let pkg_name_clean = name.split('@').next().unwrap_or(name);
             let pkg_dir_real = installer_shared.get_virtual_store_root(name, version).join("node_modules").join(pkg_name_clean);
             let virtual_store_name = format!("{}@{}", name.replace('/', "+"), version);
             let _ = installer_shared.link_binaries(&pkg_dir_real, &bin_dir, &virtual_store_name);
        }
        multi.println(format!("{} Global binaries exported to: {}", "[OK]".cyan().bold(), bin_dir.display())).unwrap();
    }

    // 7. Save Updates to package.json
    if !global && !updates_to_save.is_empty() {
        update_package_json_batch(&target_dir, &updates_to_save, dep_type, exact).ok();
    }

    // 8. Garbage Collection: Prune unused versions from the virtual store
    if !global {
        let _ = installer_shared.prune_vstore(&resolved_tree_arc);
    }

    let elapsed = start_time.elapsed();
    multi.println(format!("\n{} XyPriss Installation complete in {:.2}s", "[OK]".green().bold(), elapsed.as_secs_f64())).unwrap();
    if global {
        let bin_path = target_dir.join("bin");
        crate::utils::shell::ensure_global_path_is_configured(&bin_path);
    }
    multi.println("   Powered by Nehonix™ & XyPriss Engine".truecolor(100, 100, 100).italic().to_string()).unwrap();

    Ok(())
}

fn migrate_legacy_storage(current_dir: &Path, new_path: &Path) {
    let legacy_path = current_dir.join(".xpm_storage");
    if legacy_path.exists() {
         if let Some(p) = new_path.parent() { let _ = Cas::create_dir_all_secure(p); }
         if !new_path.exists() {
             if let Ok(_) = std::fs::rename(&legacy_path, &new_path) { } else { let _ = std::fs::remove_dir_all(&legacy_path); }
         } else { let _ = std::fs::remove_dir_all(&legacy_path); }
    }
}

fn update_package_json_batch(root: &Path, updates: &HashMap<String, String>, dep_type: DependencyType, exact: bool) -> anyhow::Result<()> {
    let pkg_path = root.join("package.json");
    if !pkg_path.exists() { return Ok(()); } 
    let content = std::fs::read_to_string(&pkg_path)?;
    let mut json: serde_json::Value = serde_json::from_str(&content)?;

    if let Some(obj) = json.as_object_mut() {
        let sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
        let target_section = match dep_type {
            DependencyType::Dev => "devDependencies",
            DependencyType::Optional => "optionalDependencies",
            DependencyType::Peer => "peerDependencies",
            DependencyType::Regular => "dependencies",
        };

        for (name, version) in updates {
            let version_req = if exact { version.clone() } else { format!("^{}", version) };
            let mut found = false;
            for section in sections {
                if let Some(deps) = obj.get_mut(section).and_then(|v| v.as_object_mut()) {
                    if deps.contains_key(name) {
                        deps.insert(name.clone(), serde_json::Value::String(version_req.clone()));
                        found = true;
                        break;
                    }
                }
            }
            if !found {
                if !obj.contains_key(target_section) {
                    obj.insert(target_section.to_string(), serde_json::Value::Object(serde_json::Map::new()));
                }
                if let Some(deps) = obj.get_mut(target_section).and_then(|v| v.as_object_mut()) {
                    deps.insert(name.clone(), serde_json::Value::String(version_req));
                }
            }
        }
    }
    std::fs::write(pkg_path, serde_json::to_string_pretty(&json)?)?;
    Ok(())
}

fn parse_package_arg(arg: &str) -> (String, String) {
    let last_at = arg.rfind('@');
    match last_at {
        Some(idx) if idx > 0 => (arg[..idx].to_string(), arg[idx+1..].to_string()),
        _ => (arg.to_string(), "latest".to_string())
    }
}

async fn finalize_installation(
    installer: &Arc<Installer>,
    multi: &MultiProgress,
    resolved_tree: &Arc<Vec<Arc<ResolvedPackage>>>,
    direct_packages: &HashMap<String, String>,
    resolver: &Arc<Resolver>,
    updates_to_save: &mut HashMap<String, String>,
    installed_summary: &mut Vec<(String, String)>,
) -> anyhow::Result<()> {
    use rayon::prelude::*;
    let mut direct_resolved = Vec::new();
    for (name, req) in direct_packages {
        if let Some(version) = resolver.find_compatible_version(name, req) {
            updates_to_save.insert(name.clone(), version.clone());
            if !installed_summary.iter().any(|(n, _)| n == name) { installed_summary.push((name.clone(), version.clone())); }
            if let Some(pkg) = resolved_tree.iter().find(|p| p.name == *name && p.version == version) { direct_resolved.push(pkg.clone()); }
        }
    }

    // --- PHASE 1: Hoisting ---
    multi.println(format!("{} Syncing dependency tree...", "[>>]".bold().blue())).unwrap();
    let hoist_pb = Arc::new(multi.add(ProgressBar::new(resolved_tree.len() as u64)));
    hoist_pb.set_style(ProgressStyle::default_bar().template("{spinner:.blue} [HOIST] Linking: [{bar:40.blue/black}] {pos}/{len} 0x{msg}").unwrap().progress_chars("10"));
    hoist_pb.enable_steady_tick(std::time::Duration::from_millis(60));
    let hoist_inst = Arc::clone(installer);
    let hp_pb = Arc::clone(&hoist_pb);
    
    resolved_tree.par_iter().for_each(|pkg| {
        // Force linking. If multiple versions exist, the last one linked wins at this stage.
        let _ = hoist_inst.link_to_root(&pkg.name, &pkg.version, pkg.metadata.bin.as_ref());
        hp_pb.inc(1);
         if rand::random::<f32>() < 0.05 { hp_pb.set_message(format!("{:04x}", rand::random::<u16>())); }
    });
    hoist_pb.finish_and_clear();

    // --- PHASE 2: Direct Dependencies (PRIORITY) ---
    multi.println(format!("{} Finalizing root dependencies...", "[>>]".bold().cyan())).unwrap();
    let root_pb = Arc::new(multi.add(ProgressBar::new(direct_resolved.len() as u64)));
    root_pb.set_style(ProgressStyle::default_bar().template("{spinner:.cyan} [ROOT] Linking: [{bar:40.cyan/blue}] {pos}/{len} 0x{msg}").unwrap().progress_chars("10-"));
    root_pb.enable_steady_tick(std::time::Duration::from_millis(60));
    let direct_inst = Arc::clone(installer);
    let dp_pb = Arc::clone(&root_pb);
    
    direct_resolved.into_par_iter().for_each(|pkg| {
        if let Err(e) = direct_inst.link_to_root(&pkg.name, &pkg.version, pkg.metadata.bin.as_ref()) { 
            dp_pb.println(format!("   {} Fatal error linking root dep {}: {}", "[ERR]".red().bold(), pkg.name, e)); 
        }
        dp_pb.inc(1);
    });
    root_pb.finish_and_clear();
    Ok(())
}
