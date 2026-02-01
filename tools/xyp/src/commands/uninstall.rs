use std::path::Path;
use colored::Colorize;
use anyhow::Result;
use serde_json::Value;
use crate::core::lockfile::Lockfile;
use std::collections::{HashMap, HashSet};

pub async fn run(packages: Vec<String>, global: bool) -> Result<()> {
    let current_dir = std::env::current_dir()?;
    
    let nm_root = if global {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        Path::new(&home).join(".xpm_global").join("node_modules")
    } else {
        current_dir.join("node_modules")
    };

    if packages.is_empty() {
        println!("{} No packages specified for uninstallation.", "⚠".bold().yellow());
        return Ok(());
    }

    println!("{} Removing packages...", "🗑".bold().red());

    let mut removed_count = 0;

    for pkg_name in &packages {
        let pkg_path = nm_root.join(pkg_name);
        
        if pkg_path.exists() {
            // Remove the package directory/symlink
            // Remove the package directory/symlink
            if pkg_path.is_symlink() || !pkg_path.is_dir() {
                std::fs::remove_file(&pkg_path)?;
            } else {
                std::fs::remove_dir_all(&pkg_path)?;
            }
            
            // Clean up empty scope directory
            if let Some(parent) = pkg_path.parent() {
                if parent != nm_root {
                    if let Ok(mut entries) = std::fs::read_dir(parent) {
                        if entries.next().is_none() {
                            let _ = std::fs::remove_dir(parent);
                        }
                    }
                }
            }

            println!("   {} Removed {}", "-".bold().red(), pkg_name.bold());
            removed_count += 1;

            // Attempt to clean up binaries
            if global {
               let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
               let global_root = Path::new(&home).join(".xpm_global");
               cleanup_global_binaries(&global_root, pkg_name).ok();
            } else {
               cleanup_binaries(&nm_root, pkg_name).ok();
            }
        } else {
            println!("   {} Package {} not found in {}", "⚠".bold().yellow(), pkg_name.dimmed(), nm_root.display());
        }
    }

    // Update package.json (only if local)
    if !global {
        let pkg_json_path = current_dir.join("package.json");
        if pkg_json_path.exists() {
            update_package_json(&pkg_json_path, &packages)?;
        }
        
        // UPDATE LOCKFILE: Remove uninstalled packages and orphaned dependencies
        let lockfile_path = current_dir.join("xfpm-lock.json");
        if lockfile_path.exists() {
            if let Ok(lockfile) = update_lockfile_after_uninstall(&lockfile_path, &pkg_json_path, &packages) {
                let _ = lockfile.write_to_file(&lockfile_path);
                println!("   {} Updated xfpm-lock.json", "✎".bold().blue());
            }
        }
    }

    println!();
    if removed_count > 0 {
        println!("{} Uninstall complete ({} removed)", "✓".bold().green(), removed_count);
    } else {
        println!("{} Nothing to remove", "✓".bold().green());
    }
    println!("{}", "   Powered by Nehonix™ & XyPriss Engine".truecolor(100, 100, 100).italic());

    Ok(())
}

fn cleanup_global_binaries(global_root: &Path, pkg_name: &str) -> Result<()> {
    let bin_dir = global_root.join("bin");
    if !bin_dir.exists() { return Ok(()); }

    for entry in std::fs::read_dir(bin_dir)? {
        let entry = entry?;
        let path = entry.path();
        
        // Check if it's a symlink
        if let Ok(target) = std::fs::read_link(&path) {
            let target_str = target.to_string_lossy();
            
            // More precise match for binary links
            let pattern = format!("{0}node_modules{0}{1}{0}", std::path::MAIN_SEPARATOR, pkg_name);
            let pattern_end = format!("{0}node_modules{0}{1}", std::path::MAIN_SEPARATOR, pkg_name);
            
            if target_str.contains(&pattern) || target_str.ends_with(&pattern_end) {
                std::fs::remove_file(&path)?;
                println!("   {} Removed binary link: {}", "🔗".bold().magenta(), path.file_name().unwrap().to_string_lossy());
            }
        }
    }
    Ok(())
}

fn cleanup_binaries(nm_root: &Path, pkg_name: &str) -> Result<()> {
    let bin_dir = nm_root.join(".bin");
    if !bin_dir.exists() { return Ok(()); }

    for entry in std::fs::read_dir(bin_dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if let Ok(target) = std::fs::read_link(&path) {
            let target_str = target.to_string_lossy();
            
            // Precise match for relative or absolute paths
            let pattern = format!("{0}{1}{0}", std::path::MAIN_SEPARATOR, pkg_name);
            let pattern_rel = format!("..{0}{1}{0}", std::path::MAIN_SEPARATOR, pkg_name);
            
            if target_str.contains(&pattern) || target_str.contains(&pattern_rel) || 
               target_str.ends_with(&format!("{}{}", std::path::MAIN_SEPARATOR, pkg_name)) {
                std::fs::remove_file(path)?;
            }
        }
    }
    Ok(())
}

fn update_package_json(path: &Path, packages: &[String]) -> Result<()> {
    let content = std::fs::read_to_string(path)?;
    let mut json: Value = serde_json::from_str(&content)?;

    let sections = vec!["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
    let mut modified = false;

    for section in sections {
        if let Some(deps) = json.get_mut(section).and_then(|v| v.as_object_mut()) {
            for pkg in packages {
                if deps.remove(pkg).is_some() {
                    modified = true;
                }
            }
        }
    }

    if modified {
        let new_content = serde_json::to_string_pretty(&json)?;
        std::fs::write(path, new_content)?;
        println!("   {} Updated package.json", "✎".bold().blue());
    }

    Ok(())
}

fn update_lockfile_after_uninstall(lockfile_path: &Path, pkg_json_path: &Path, _removed_packages: &[String]) -> Result<Lockfile> {
    let mut lockfile = Lockfile::from_file(lockfile_path)?;
    
    // Read current package.json to know what should still be there
    let content = std::fs::read_to_string(pkg_json_path)?;
    let json: Value = serde_json::from_str(&content)?;
    
    let mut required_packages = HashSet::new();
    let sections = vec!["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
    for section in sections {
        if let Some(deps) = json.get(section).and_then(|v| v.as_object()) {
            for (name, _) in deps {
                required_packages.insert(name.clone());
            }
        }
    }
    
    // Build dependency graph from lockfile to find orphans
    let mut needed = HashSet::new();
    let mut to_check: Vec<String> = required_packages.iter().cloned().collect();
    
    while let Some(pkg_name) = to_check.pop() {
        if needed.contains(&pkg_name) {
            continue;
        }
        needed.insert(pkg_name.clone());
        
        if let Some(pkg) = lockfile.get_package(&pkg_name) {
            for (dep_name, _) in &pkg.dependencies {
                if !needed.contains(dep_name) {
                    to_check.push(dep_name.clone());
                }
            }
        }
    }
    
    // Remove packages not in the needed set
    let all_packages: Vec<String> = lockfile.packages.keys().cloned().collect();
    for pkg_name in all_packages {
        if !needed.contains(&pkg_name) {
            lockfile.packages.remove(&pkg_name);
        }
    }
    
    Ok(lockfile)
}
