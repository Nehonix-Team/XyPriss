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
    
    println!("   {} Project root: {}", "[ROOT]".dimmed(), current_dir.display().to_string().cyan());

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

            println!("{} Finalizing workspace and linking dependencies...", "[FINALIZE]".blue().bold());
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
        println!("{} Installing requested packages...", "[INSTALL]".cyan().bold());
        // For specific packages, we use a similar optimization logic
        let mut deps = std::collections::HashMap::new();
        for pkg_name in packages { deps.insert(pkg_name, "latest".to_string()); }

        let resolved_tree = Arc::new(resolver.resolve_tree(&deps).await?);
        let installer = Arc::new(installer);
        
        for pkg in resolved_tree.iter() {
            installer.ensure_extracted(pkg).await?;
            installer.link_package_deps(pkg).await?;
        }

        println!("{} Finalizing root dependencies...", "[FINALIZE]".blue().bold());
        for (name, req) in &deps {
            if let Some(version) = resolver.find_compatible_version(name, req) {
                installer.link_to_root(name, &version)?;
            }
        }
    }

    println!("\n{} XyPriss Installation complete", "[✓]".bold().green());
    println!("   → Workspace environment initialized via CAS-Optimized lookup.");

    Ok(())
}
