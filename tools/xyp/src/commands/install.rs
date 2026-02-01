use crate::core::resolver::{PackageJson, Resolver, ResolvedPackage};
use crate::core::installer::Installer;
use std::path::Path;
use std::sync::Arc;
use futures_util::stream::{FuturesUnordered, StreamExt};
use indicatif::{ProgressBar, ProgressStyle, MultiProgress};
use colored::Colorize;
use semver::Version;
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
    
    // Use a GLOBAL cache for metadata to speed up fresh project resolving
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let global_cache_dir = std::path::Path::new(&home).join(".xpm_cache");
    let _ = std::fs::create_dir_all(&global_cache_dir);
    registry_client.set_cache_dir(global_cache_dir);
    
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
    resolver.set_concurrency(128); 
    let resolver_shared = Arc::new(resolver);

    setup_pb.finish_and_clear();
    
    if !global {
        let _ = std::fs::create_dir_all(target_dir.join("node_modules").join(".xpm"));
    }

    let _ = multi.println(format!("{} Full installation initiated...", "[>>]".cyan().bold()));
    let _ = multi.println(format!("{} Scanning neural gateway...", "[*]".dimmed()));

    let mut updates_to_save = HashMap::new();
    let skipped_packages: Vec<(String, String, String)> = Vec::new();
    let mut installed_summary: Vec<(String, String)> = Vec::new();

    if packages.is_empty() {
        let pkg_json_path = target_dir.join("package.json");
        if !global && !pkg_json_path.exists() {
             anyhow::bail!("No package.json found in {}.", target_dir.display());
        }

        let pkg = PackageJson::from_file(pkg_json_path.to_str().unwrap())?;
        let root_deps = pkg.all_dependencies();
        
        let _ = multi.println(format!("   {} Project: {} v{}", "-->".green().bold(), pkg.name.bold(), pkg.version.cyan()));
        
        let deps_to_resolve = root_deps.clone();
        
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
        let eager_handle = tokio::spawn(async move {
            let mut tasks = FuturesUnordered::new();
            let depacking_semaphore = Arc::new(tokio::sync::Semaphore::new(128)); // Increased to 128
            
            while let Some(pkg) = eager_rx.recv().await {
                // QUICK CHECK: If already extracted, just increment bar and continue
                if installer_eager.is_package_extracted(&pkg.name, &pkg.version) {
                    let current_len = upb.length().unwrap_or(0);
                    if upb.position() >= current_len {
                        upb.set_length(current_len + 50); 
                    }
                    upb.inc(1);
                    continue;
                }

                let inst = Arc::clone(&installer_eager);
                let upb_c = upb.clone();
                let sem = Arc::clone(&depacking_semaphore);
                let pkg_c = Arc::clone(&pkg);
                
                let current_len = upb_c.length().unwrap_or(0);
                if upb_c.position() + tasks.len() as u64 >= current_len {
                    upb_c.set_length(current_len + 50); 
                }

                tasks.push(tokio::spawn(async move {
                    let _permit = sem.acquire().await;
                    let res = inst.ensure_extracted(&pkg_c).await;
                    upb_c.inc(1);
                    if let Err(ref e) = res {
                         upb_c.println(format!("   {} Neural node failure ({}): {}", "[!!]".red(), pkg_c.name, e));
                    } else if rand::random::<f32>() < 0.05 {
                         upb_c.set_message(format!("0x{:04x} [DECODED] {}", rand::random::<u16>(), pkg_c.name.dimmed()));
                    }
                    res
                }));
                
                // Drive tasks but allow higher accumulation for burst speed
                if tasks.len() > 256 {
                    if let Some(res) = tasks.next().await { res??; }
                }
            }
            while let Some(res) = tasks.next().await { res??; }
            Ok::<(), anyhow::Error>(())
        });

        let resolved_tree = Arc::clone(&resolver_shared).resolve_tree(&deps_to_resolve).await?;
        multi.println(format!("{} Graph stable. Neural sequence unlocked.", "[OK]".green().bold())).unwrap();
        
        unpacking_pb.set_length(resolved_tree.len() as u64); if unpacking_pb.position() > unpacking_pb.length().unwrap_or(0) { unpacking_pb.set_length(unpacking_pb.position()); }
        let resolved_tree_arc = Arc::new(resolved_tree);
        resolver_shared.clear_eager_tx(); 

        multi.println(format!("\n{} Finalizing storage and artifacts...", "[*]".magenta().bold())).unwrap();
        
        eager_handle.await??;
        
        unpacking_pb.finish_and_clear();
        multi.println(format!("{} Storage synchronized. All artifacts cached.", "[OK]".green().bold())).unwrap();

        let xpm_internal = target_dir.join("node_modules").join(".xpm");
        if !xpm_internal.exists() { let _ = std::fs::create_dir_all(&xpm_internal); }

        multi.println(format!("{} Optimizing layout and shims...", "[>>]".bold().blue())).unwrap();
        
        let (tx_ready, mut rx_ready) = tokio::sync::mpsc::channel::<Arc<ResolvedPackage>>(4096);
        let installer_linking = Arc::clone(&installer_shared);
        
        let final_linking_handle = tokio::spawn(async move {
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
        
        finalize_installation(&installer_shared, &multi, &resolved_tree_arc, &deps_to_resolve, &resolver_shared, &mut updates_to_save, &mut installed_summary).await?;

        final_linking_handle.await??;

        multi.println(format!("{} Executing post-installation sequence...", "[>>]".bold().green())).unwrap();
        
        // New parallel script runner with containerization
        let script_runner = crate::core::script_runner::ScriptRunner::new(target_dir.clone());
        let script_tasks = script_runner.scan_packages(&resolved_tree_arc).await?;
        script_runner.execute_parallel(script_tasks).await?;

        let pkg_json_path = target_dir.join("package.json");
        let mut updates = HashMap::new();
        for (name, req) in &pkg.all_dependencies() {
            if let Some(version) = resolver_shared.find_compatible_version(name, req) {
                updates.insert(name.clone(), version);
            }
        }
        let _ = crate::core::installer::Installer::update_package_json(&pkg_json_path, updates);
    } else {
        // --- CASE: Manual Installation ---
        let mut deps_to_resolve = HashMap::new();
        for pkg_req in &packages {
             let (name, ver) = parse_package_arg(pkg_req);
            deps_to_resolve.insert(name, ver);
        }

        let unpacking_pb = multi.add(ProgressBar::new(deps_to_resolve.len() as u64));
        unpacking_pb.set_style(ProgressStyle::default_bar()
            .template("{spinner:.green} [MATRIX_CORE] Unpacking: [{bar:40.green/black}] {pos}/{len} ({percent}%) -> {msg}")
            .unwrap().progress_chars("10"));
        unpacking_pb.set_message("Initializing neural stream...");
        unpacking_pb.enable_steady_tick(std::time::Duration::from_millis(50));
        installer_shared.set_main_pb(unpacking_pb.clone());

        let (eager_tx, mut eager_rx) = tokio::sync::mpsc::channel::<Arc<ResolvedPackage>>(4096);
        resolver_shared.set_eager_tx(eager_tx);

        let inst_eager = Arc::clone(&installer_shared);
        let upb_eager = unpacking_pb.clone();
        let eager_handle = tokio::spawn(async move {
            let mut tasks = FuturesUnordered::new();
            while let Some(pkg) = eager_rx.recv().await {
                let inst = Arc::clone(&inst_eager);
                let upb = upb_eager.clone();
                tasks.push(tokio::spawn(async move {
                    let res = inst.ensure_extracted(&pkg).await;
                    upb.inc(1);
                    if rand::random::<f32>() < 0.1 {
                        upb.set_message(format!("0x{:04x} [DEPACKING] {}", rand::random::<u16>(), pkg.name.dimmed()));
                    }
                    res
                }));
                if tasks.len() >= 32 { if let Some(res) = tasks.next().await { res??; } }
            }
            while let Some(res) = tasks.next().await { res??; }
            Ok::<(), anyhow::Error>(())
        });

        let resolved_tree = Arc::clone(&resolver_shared).resolve_tree(&deps_to_resolve).await?;
        multi.println(format!("{} Graph stable. Neural sequence unlocked.", "[OK]".green().bold())).unwrap();
        
        unpacking_pb.set_length(resolved_tree.len() as u64); if unpacking_pb.position() > unpacking_pb.length().unwrap_or(0) { unpacking_pb.set_length(unpacking_pb.position()); }
        let resolved_tree_arc = Arc::new(resolved_tree);
        resolver_shared.clear_eager_tx();
        
        multi.println(format!("\n{} Synchronizing virtual store...", "[*]".magenta().bold())).unwrap();
        eager_handle.await??;
        
        installer_shared.batch_ensure_extracted(&resolved_tree_arc).await?;
        unpacking_pb.finish_and_clear();
        
        let link_pb = multi.add(ProgressBar::new(resolved_tree_arc.len() as u64));
        link_pb.set_style(ProgressStyle::default_bar()
            .template("{spinner:.cyan} [LN-KERNEL] Linking: [{bar:40.cyan/blue}] {pos}/{len} 0x{msg}")
            .unwrap().progress_chars("10-"));
        link_pb.set_message("Linking artifacts...");
        link_pb.enable_steady_tick(std::time::Duration::from_millis(60));

        let mut link_tasks = FuturesUnordered::new();
        for pkg in resolved_tree_arc.iter() {
            let inst = Arc::clone(&installer_shared);
            let pkg_c = pkg.clone();
            let lpb = link_pb.clone();
            link_tasks.push(tokio::spawn(async move {
                let res = inst.link_package_deps(&pkg_c).await;
                lpb.inc(1);
                if rand::random::<f32>() < 0.05 { lpb.set_message(format!("{:04x}", rand::random::<u16>())); }
                res
            }));
        }
        while let Some(res) = link_tasks.next().await { res??; }
        link_pb.finish_and_clear();

        finalize_installation(&installer_shared, &multi, &resolved_tree_arc, &deps_to_resolve, &resolver_shared, &mut updates_to_save, &mut installed_summary).await?;
        
        multi.println(format!("{} Deployment successful.", "[OK]".blue().bold())).unwrap();
    }
    
    for (name, version, reason) in skipped_packages {
        let _ = multi.println(format!("   {} {} v{} ({})", "v".green(), name.bold(), version.cyan(), reason.dimmed()));
    }
    for (name, version) in &installed_summary {
         multi.println(format!("   {} {} v{}", "+".bold().green(), name.bold(), version.cyan())).unwrap();
    }

    if global && !installed_summary.is_empty() {
        let bin_dir = target_dir.join("bin");
        if !bin_dir.exists() { std::fs::create_dir_all(&bin_dir)?; }
        
        let bin_pb = multi.add(ProgressBar::new(installed_summary.len() as u64));
        bin_pb.set_style(ProgressStyle::default_spinner()
            .template("{spinner:.cyan} [BIN-SHIM] Exporting binary artifacts... 0x{msg}")
            .unwrap());
        bin_pb.enable_steady_tick(std::time::Duration::from_millis(60));
        bin_pb.set_message("8f2a");

        for (name, version) in &installed_summary {
             let pkg_name_clean = name.split('@').next().unwrap_or(name);
             let pkg_dir_real = installer_shared.get_virtual_store_root(name, version).join("node_modules").join(pkg_name_clean);
             
             let virtual_store_name = format!("{}@{}", name.replace('/', "+"), version);
             if let Err(e) = installer_shared.link_binaries(&pkg_dir_real, &bin_dir, &virtual_store_name) {
                 multi.println(format!("   {} Error exporting binary for {}: {}", "[ERR]".red().bold(), name, e)).unwrap();
             }
             bin_pb.inc(1);
             if rand::random::<f32>() < 0.2 { bin_pb.set_message(format!("{:04x}", rand::random::<u16>())); }
        }
        bin_pb.finish_and_clear();
        multi.println(format!("{} Global binaries exported to: {}", "[OK]".cyan().bold(), bin_dir.display())).unwrap();
    }

    if !global && !updates_to_save.is_empty() {
        update_package_json_batch(&target_dir, &updates_to_save, dep_type, exact).ok();
    }

    let elapsed = start_time.elapsed();
    multi.println(format!("\n{} XyPriss Installation complete in {:.2}s", "[OK]".green().bold(), elapsed.as_secs_f64())).unwrap();
    if global {
        let bin_path = target_dir.join("bin");
        crate::utils::shell::ensure_global_path_is_configured(&bin_path);
    }
    multi.println("   Powered by Nehonix™ & XyPriss Engine".truecolor(100, 100, 100).italic().to_string()).unwrap();
    println!();

    Ok(())
}

fn migrate_legacy_storage(current_dir: &Path, new_path: &Path) {
    let legacy_path = current_dir.join(".xpm_storage");
    if legacy_path.exists() {
         if let Some(p) = new_path.parent() { let _ = std::fs::create_dir_all(p); }
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
            
            // 1. Try to find if package already exists in ANY section
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

            // 2. If not found, add to the requested target section
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
    let new_content = serde_json::to_string_pretty(&json)?;
    std::fs::write(pkg_path, new_content)?;
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
    // Link EVERYTHING resolved to root node_modules. This provides compatibility
    // but might link sub-dependency versions that clash with root.
    multi.println(format!("{} Syncing dependency tree...", "[>>]".bold().blue())).unwrap();
    let hoist_pb = Arc::new(multi.add(ProgressBar::new(resolved_tree.len() as u64)));
    hoist_pb.set_style(ProgressStyle::default_bar().template("{spinner:.blue} [HOIST] Linking: [{bar:40.blue/black}] {pos}/{len} 0x{msg}").unwrap().progress_chars("10"));
    hoist_pb.set_message("8f2a");
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
    // Link direct dependencies LAST. This ensures they OVERWRITE any sub-dependency
    // version that might have been hoisted in Phase 1.
    multi.println(format!("{} Finalizing root dependencies...", "[>>]".bold().cyan())).unwrap();
    let root_pb = Arc::new(multi.add(ProgressBar::new(direct_resolved.len() as u64)));
    root_pb.set_style(ProgressStyle::default_bar().template("{spinner:.cyan} [ROOT] Linking: [{bar:40.cyan/blue}] {pos}/{len} 0x{msg}").unwrap().progress_chars("10-"));
    root_pb.set_message("8f2a");
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
