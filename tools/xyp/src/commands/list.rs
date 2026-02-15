use std::path::Path;
use colored::Colorize;
use crate::core::resolver::PackageJson;

pub async fn run(packages: Vec<String>) -> anyhow::Result<()> {
    let current_dir = std::env::current_dir()?;
    let nm_path = current_dir.join("node_modules");

    if !nm_path.exists() {
        println!("{}", "No node_modules found. Run 'xfpm install' first.".yellow());
        return Ok(());
    }

    if packages.is_empty() {
        // List all direct dependencies from package.json
        let pkg_json_path = current_dir.join("package.json");
        if !pkg_json_path.exists() {
            println!("{}", "No package.json found.".red());
            return Ok(());
        }

        let pkg_json = match PackageJson::from_file(&pkg_json_path) {
            Ok(p) => p,
            Err(e) => {
                println!("{} {}", "Error reading package.json:".red(), e);
                return Ok(());
            }
        };
        
        println!("{} {} v{}", "Project:".cyan().bold(), pkg_json.name.bold(), pkg_json.version.cyan());
        
        let mut all_deps: Vec<_> = pkg_json.all_dependencies().keys().cloned().collect();
        all_deps.sort();

        if all_deps.is_empty() {
            println!("No dependencies found in package.json.");
        } else {
            for name in all_deps {
                print_package_version(&nm_path, &name);
            }
        }
    } else {
        for name in packages {
            print_package_version(&nm_path, &name);
        }
    }

    Ok(())
}

fn print_package_version(nm_path: &Path, name: &str) {
    let pkg_path = nm_path.join(name).join("package.json");
    if pkg_path.exists() {
        if let Ok(pkg) = PackageJson::from_file(&pkg_path) {
            println!("  {} {}", name.bold(), pkg.version.cyan());
        } else {
            println!("  {} {}", name.bold(), "error reading package.json".red());
        }
    } else {
        println!("  {} {}", name.bold(), "not installed".red());
    }
}
