use crate::core::resolver::{PackageJson, Resolver};
use crate::core::installer::Installer;
use std::path::Path;
use std::sync::Arc;
use futures_util::stream::{FuturesUnordered, StreamExt};
use colored::Colorize;

pub async fn run(packages: Vec<String>, _use_npm: bool) -> anyhow::Result<()> {
    let multi = indicatif::MultiProgress::new();
    let current_dir = std::env::current_dir()?;
    let registry = Arc::new(crate::core::registry::RegistryClient::new(None));
    
    println!("   {} Project root: {}", "🏠".dimmed(), current_dir.display().to_string().cyan());

    // Create a local CAS directory for testing
    let cas_path = Path::new(".xpm_storage");
    let mut installer = Installer::new(cas_path, &current_dir, registry.clone())?;
    installer.set_multi(multi.clone());
    
    let mut resolver = Resolver::new(registry.clone());
    resolver.set_multi(multi.clone());

    if packages.is_empty() {
        println!("{} Full Installation...", "🚀".cyan());
        
        // Try to load package.json
        if Path::new("package.json").exists() {
            let pkg = PackageJson::from_file("package.json")?;
            println!("   {} Project: {} v{}", "✓".green(), pkg.name.bold(), pkg.version.cyan());
            
            let root_deps = pkg.all_dependencies();
            let resolved_tree = resolver.resolve_tree(&root_deps).await?;

            println!("\n{} Installing packages...", "📦".magenta());
            
            // Parallel installation (limited concurrency)
            let mut tasks = FuturesUnordered::new();
            let installer = Arc::new(installer);
            
            for pkg in resolved_tree {
                let inst = Arc::clone(&installer);
                tasks.push(tokio::spawn(async move {
                    inst.install_package(&pkg.name, &pkg.version).await
                }));
                
                // Limit concurrency to 30 for high performance
                if tasks.len() >= 30 {
                    if let Some(res) = tasks.next().await {
                        res??;
                    }
                }
            }
            
            while let Some(res) = tasks.next().await {
                res??;
            }
        } else {
            println!("   {} No package.json found in current directory.", "✗".red());
            return Ok(());
        }
    } else {
        println!("{} Installing specific packages...", "🚀".cyan());
        // For specific packages, we can still use the resolver to get dependencies
        let mut deps = std::collections::HashMap::new();
        for pkg_name in packages {
            deps.insert(pkg_name, "latest".to_string());
        }

        let resolved_tree = resolver.resolve_tree(&deps).await?;
        
        let installer = Arc::new(installer);
        let mut tasks = FuturesUnordered::new();

        for pkg in resolved_tree {
             let inst = Arc::clone(&installer);
             tasks.push(tokio::spawn(async move {
                 inst.install_package(&pkg.name, &pkg.version).await
             }));
             
             if tasks.len() >= 30 {
                 if let Some(res) = tasks.next().await {
                     res??;
                 }
             }
        }
        
        while let Some(res) = tasks.next().await {
            res??;
        }
    }

    println!("\n{} {} (Internal Engine v0.1)", "✨".yellow(), "XPM Installation complete".bold());
    println!("   {} node_modules is now populated via CAS.", "→".dimmed());

    Ok(())
}
