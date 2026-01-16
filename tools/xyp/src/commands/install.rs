use crate::core::resolver::{PackageJson, Resolver, ResolvedPackage};
use crate::core::installer::Installer;
use std::path::Path;
use std::sync::Arc;
use futures_util::stream::{FuturesUnordered, StreamExt};
use indicatif::{ProgressBar, ProgressStyle};
use colored::Colorize;

pub async fn run(packages: Vec<String>, _use_npm: bool, retries: u32) -> anyhow::Result<()> {
    let multi = indicatif::MultiProgress::new();
    let current_dir = std::env::current_dir()?;
    let registry = Arc::new(crate::core::registry::RegistryClient::new(None, retries));
    
    // println!("   {} Project root: {}", "[ROOT]".dimmed(), current_dir.display().to_string().cyan());

    // Create a local CAS directory for testing
    let cas_path = Path::new(".xpm_storage");
    let mut installer = Installer::new(cas_path, &current_dir, registry.clone())?;
    installer.set_multi(multi.clone());
    
    let mut resolver = Resolver::new(registry.clone());
    resolver.set_multi(multi.clone());

    if packages.is_empty() {
        println!("{} Full installation initiated...", "[INSTALL]".cyan().bold());
        
        // Try to load package.json
        if Path::new("package.json").exists() {
            let pkg = PackageJson::from_file("package.json")?;
            println!("   {} Project: {} v{}", "[PROJECT]".green().bold(), pkg.name.bold(), pkg.version.cyan());
            
            let root_deps = pkg.all_dependencies();
            let resolved_tree = Arc::new(resolver.resolve_tree(&root_deps).await?);

            println!("\n{} Building virtual store and extracting artifacts...", "[PROCESS]".magenta().bold());
            
            let total_pkgs = resolved_tree.len() as u64;
            let main_pb = multi.add(ProgressBar::new(total_pkgs));
            main_pb.set_style(ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} {msg}")
                .unwrap()
                .progress_chars("#>-"));
            main_pb.set_message("Processing virtual store...");

            let (tx_ready, mut rx_ready) = tokio::sync::mpsc::channel::<ResolvedPackage>(4096);
            let installer = Arc::new(installer);
            let mut tasks = FuturesUnordered::new();
            
            for pkg in resolved_tree.iter() {
                let inst = Arc::clone(&installer);
                let pkg_c = pkg.clone();
                let tx = tx_ready.clone();
                let mpb = main_pb.clone();
                tasks.push(tokio::spawn(async move {
                    let res = inst.ensure_extracted(&pkg_c).await;
                    if res.is_ok() { 
                        let _ = tx.send(pkg_c).await;
                        mpb.inc(1);
                    }
                    res
                }));
                
                if tasks.len() >= 60 {
                    if let Some(res) = tasks.next().await { res??; }
                }
            }
            drop(tx_ready);
            
            // Phase 2: Start Linking and Postinstall
            let installer_c = Arc::clone(&installer);
            let final_linking = tokio::spawn(async move {
                 let mut tasks = FuturesUnordered::new();
                 while let Some(pkg) = rx_ready.recv().await {
                     let inst = Arc::clone(&installer_c);
                     tasks.push(tokio::spawn(async move {
                         inst.link_package_deps(&pkg).await
                     }));
                     
                     if tasks.len() >= 80 {
                         if let Some(res) = tasks.next().await { res??; }
                     }
                 }
                 while let Some(res) = tasks.next().await { res??; }
                 Ok::<(), anyhow::Error>(())
            });

            while let Some(res) = tasks.next().await { res??; }
            main_pb.finish_with_message("Storage preparation complete.");
            final_linking.await??;

            println!("{} Finalizing workspace and linking dependencies...", "→".bold().blue());
            for (name, _req) in &root_deps {
                if let Some(version) = resolver.find_compatible_version(name, _req) {
                    installer.link_to_root(name, &version)?;
                }
            }
        } else {
            println!("   {} No package.json found in current directory.", "[ERROR]".red().bold());
            return Ok(());
        }
    } else {
        // Smart Install: Pre-check for existing versions to Short-Circuit resolution
        let mut deps_to_resolve = std::collections::HashMap::new();
        let mut installed_summary = Vec::new();
        
        let analyze_pb = multi.add(ProgressBar::new_spinner());
        analyze_pb.set_style(ProgressStyle::default_spinner().template("{spinner:.blue} {msg}").unwrap());
        analyze_pb.set_message("Scanning package repositories...");
        analyze_pb.enable_steady_tick(std::time::Duration::from_millis(80));

        for pkg_name in packages {
            // 1. Get latest version from registry (lightweight)
            let pkg_meta_res = registry.fetch_package(&pkg_name).await;
            
            if let Ok(pkg_meta) = pkg_meta_res {
                if let Some(latest_ver) = pkg_meta.dist_tags.get("latest") {
                    let virtual_name = format!("{}@{}", pkg_name.replace("/", "+"), latest_ver);
                    let cache_path = cas_path.join("virtual_store").join(&virtual_name);
                    
                    if cache_path.exists() {
                         // ⚡ SHORT-CIRCUIT: Found in CAS, Link directly!
                         // We assume if formatting exists, deps are also there (immutable nature)
                         installer.link_to_root(&pkg_name, latest_ver)?;
                         analyze_pb.println(format!("   {} {} v{}", "⚡".bold().yellow(), pkg_name.bold(), latest_ver.cyan()));
                         installed_summary.push((pkg_name.clone(), latest_ver.clone()));
                         continue;
                    }
                }
            }
            
            // If not cached or info lookup failed, add to resolve queue
            deps_to_resolve.insert(pkg_name, "latest".to_string());
        }
        analyze_pb.finish_and_clear();

        if !deps_to_resolve.is_empty() {
             println!("{} Installing new packages...", "→".bold().cyan());
             
             let resolved_tree = match resolver.resolve_tree(&deps_to_resolve).await {
                Ok(tree) => Arc::new(tree),
                Err(e) => {
                    let err_str = e.to_string();
                    if err_str.contains("404") {
                        println!("{} Package not found in registry.", "✘".bold().red());
                    } else {
                        println!("{} Resolution failed: {}", "✘".bold().red(), err_str);
                    }
                    return Ok(());
                }
            };

            let total_pkgs = resolved_tree.len() as u64;
            let main_pb = multi.add(ProgressBar::new(total_pkgs));
            main_pb.set_style(ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} {msg}")
                .unwrap()
                .progress_chars("#>-"));
            main_pb.set_message("Processing virtual store...");

            let installer = Arc::new(installer);
            let mut tasks = FuturesUnordered::new();
            
            for pkg in resolved_tree.iter() {
                let inst = Arc::clone(&installer);
                let pkg_c = pkg.clone();
                let mpb = main_pb.clone();
                
                tasks.push(tokio::spawn(async move {
                    let res = inst.ensure_extracted(&pkg_c).await;
                     if res.is_ok() { 
                        mpb.inc(1);
                        // Optional: Add detailed log line if needed, but bar is better for speed feeling
                        // mpb.println(format!("   ✓ Unpacked {}", pkg_c.name));
                    }
                    if let Ok(_) = res {
                        inst.link_package_deps(&pkg_c).await?;
                    }
                    res
                }));
                
                if tasks.len() >= 20 { // Limit concurrency slightly for better visual stability
                   if let Some(res) = tasks.next().await { 
                        if let Ok(Err(e)) = res { return Err(e); }
                   }
                }
            }
            
            while let Some(res) = tasks.next().await { 
                if let Ok(Err(e)) = res { return Err(e); }
            }
            main_pb.finish_with_message("Packages installed.");

            println!("{} Finalizing root dependencies...", "→".bold().blue());
            for (name, req) in &deps_to_resolve {
                if let Some(version) = resolver.find_compatible_version(name, req) {
                    installer.link_to_root(name, &version)?;
                    installed_summary.push((name.clone(), version));
                }
            }
        }
        
        println!();
        for (name, version) in installed_summary {
             // Only print if not already printed as cached (avoid dupes if logic overlaps, though here distinct)
             if deps_to_resolve.contains_key(&name) {
                 println!("   {} {} v{}", "+".bold().green(), name.bold(), version.cyan());
             }
        }
    }

    println!();
    println!("{} XyPriss Installation complete", "✓".bold().green());
    println!("{}", "   Powered by Nehonix™ & XyPriss Engine".truecolor(100, 100, 100).italic());
    println!();

    Ok(())
}
