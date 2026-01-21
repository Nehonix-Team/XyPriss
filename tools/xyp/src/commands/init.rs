use std::path::{Path, PathBuf};

use colored::Colorize;
use anyhow::{Result, Context, anyhow};
use dialoguer::{Input, Select, theme::ColorfulTheme};
use serde_json::Value;
use std::fs::File;
use indicatif::{ProgressBar, ProgressStyle};

const TEMPLATE_URL: &str = "https://dll.nehonix.com/dl/mds/xypriss/templates/initdr.zip";

pub struct InitOptions {
    pub name: Option<String>,
    pub desc: Option<String>,
    pub lang: Option<String>,
    pub port: Option<u16>,
    pub author: Option<String>,
    pub alias: Option<String>,
}

pub async fn run(opts: InitOptions) -> Result<()> {
    let start_time = std::time::Instant::now();
    // 1. Get Project Name
    let name = match opts.name.clone() {
        Some(n) => n,
        None => Input::with_theme(&ColorfulTheme::default())
            .with_prompt("Project name")
            .default("my-xypriss-app".to_string())
            .interact_text()?
    };

    let target_dir = std::env::current_dir()?.join(&name);
    
    // Handle existing directory
    if target_dir.exists() {
        let options = vec!["Overwrite (Delete existing)", "Cancel"];
        let selection = Select::with_theme(&ColorfulTheme::default())
            .with_prompt(format!("Directory '{}' already exists", name))
            .default(0)
            .items(&options)
            .interact()?;

        if selection == 1 {
            println!("Operation cancelled.");
            return Ok(());
        }
        
        // Delete existing directory
        let pb = ProgressBar::new_spinner();
        pb.set_style(ProgressStyle::default_spinner().template("{spinner:.red} Removing existing directory...").unwrap());
        pb.enable_steady_tick(std::time::Duration::from_millis(80));
        std::fs::remove_dir_all(&target_dir)?;
        pb.finish_and_clear();
    }

    // 2. Select Language
    let lang_folder = match opts.lang.as_deref() {
        Some("ts") | Some("typescript") => "TS",
        Some("js") | Some("javascript") => "JS",
        Some(_) => "TS", 
        None => {
            let languages = vec!["TypeScript", "JavaScript"];
            let selection = Select::with_theme(&ColorfulTheme::default())
                .with_prompt("Select language")
                .default(0)
                .items(&languages)
                .interact()?;
            if selection == 0 { "TS" } else { "JS" }
        }
    };
    
    println!(); // Spacing

    // 3. Download Template
    let pb = ProgressBar::new_spinner();
    pb.set_style(ProgressStyle::default_spinner().template("{spinner:.cyan} {msg}").unwrap());
    pb.set_message("Downloading template...");
    pb.enable_steady_tick(std::time::Duration::from_millis(80));
    
    let zip_path = download_template().await?;
    pb.finish_with_message(format!("{} Template downloaded", "✓".green()));

    // 4. Extract Template
    let pb = ProgressBar::new_spinner();
    pb.set_style(ProgressStyle::default_spinner().template("{spinner:.cyan} {msg}").unwrap());
    pb.set_message("Extracting project structure...");
    pb.enable_steady_tick(std::time::Duration::from_millis(80));
    
    extract_template(&zip_path, &target_dir, lang_folder)?;
    std::fs::remove_file(&zip_path).ok(); // Cleanup zip
    pb.finish_with_message(format!("{} Project extracted", "✓".green()));

    // 5. Customize Configuration
    let pb = ProgressBar::new_spinner();
    pb.set_style(ProgressStyle::default_spinner().template("{spinner:.cyan} {msg}").unwrap());
    pb.set_message("Configuring project...");
    pb.enable_steady_tick(std::time::Duration::from_millis(80));
    
    customize_package_json(&target_dir, &name, &opts)?;
    customize_env(&target_dir, &opts)?;
    customize_config(&target_dir, &name, &opts)?;
    customize_readme(&target_dir, &name, &opts)?;
    
    // Process .config file for dependencies
    if let Err(e) = process_dot_config(&target_dir) {
        // Log warning but don't fail hard, proceed with empty deps if config fails
        pb.println(format!("   {} Warning: Failed to process .config file: {}", "⚠".yellow(), e));
    }

    pb.finish_with_message(format!("{} Configuration applied", "✓".green()));

    // 6. Install Dependencies
    println!();
    println!("{}", "📦 Installing dependencies...".magenta());
    
    // Change dir to project dir for installation
    std::env::set_current_dir(&target_dir)?;
    
    // We use our own install command
    crate::commands::install::run(vec![], false, 3, false).await?;

    // Success Message (Professional & Clean)
    println!();
    let elapsed = start_time.elapsed();
    println!("   {} Project {} initialized successfully in {:.2}s!", "✨".green(), name.bold(), elapsed.as_secs_f64());
    println!();
    println!("   {}", "Next steps:".bold());
    println!("    $ cd {}", name.cyan());
    println!("    $ xyp dev");
    println!("    $ cd {} && xyp dev", name.cyan());
    println!();

    Ok(())
}

async fn download_template() -> Result<PathBuf> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()?;
    let resp = client.get(TEMPLATE_URL).send().await
        .context("Failed to connect to template server")?;
        
    if !resp.status().is_success() {
        return Err(anyhow!("Failed to download template: HTTP {}", resp.status()));
    }
    
    let temp_dir = std::env::temp_dir();
    let temp_path = temp_dir.join(format!("xypriss-template-{}.zip", uuid::Uuid::new_v4()));
    
    let content = resp.bytes().await?;
    std::fs::write(&temp_path, content)?;
    
    Ok(temp_path)
}

fn extract_template(zip_path: &Path, target_dir: &Path, lang_folder: &str) -> Result<()> {
    let file = File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    std::fs::create_dir_all(target_dir)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let name = file.name().to_string(); // Clone name to own string locally to avoid borrow issues

        // Check if file is inside the selected language folder (e.g. "TS/")
        if name.starts_with(lang_folder) {
            // Strip prefix to root it in target dir
            // "TS/src/index.ts" -> "src/index.ts"
            let relative_name = name.strip_prefix(lang_folder)
                .unwrap_or(&name)
                .trim_start_matches('/');
                
            if relative_name.is_empty() { continue; } // It IS the folder itself

            let out_path = target_dir.join(relative_name);

            if file.is_dir() {
                std::fs::create_dir_all(&out_path)?;
            } else {
                if let Some(parent) = out_path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                let mut outfile = File::create(&out_path)?;
                std::io::copy(&mut file, &mut outfile)?;
            }
        }
    }
    Ok(())
}


fn customize_package_json(root: &Path, name: &str, opts: &InitOptions) -> Result<()> {
    let path = root.join("package.json");
    if !path.exists() { return Ok(()); }
    
    let content = std::fs::read_to_string(&path)?;
    let mut json: Value = serde_json::from_str(&content)?;
    
    if let Some(obj) = json.as_object_mut() {
        obj.insert("name".to_string(), Value::String(name.to_lowercase()));
        let desc = opts.desc.clone().unwrap_or_else(|| format!("XyPriss project: {}", name));
        obj.insert("description".to_string(), Value::String(desc));
        if let Some(author) = &opts.author {
            obj.insert("author".to_string(), Value::String(author.clone()));
        }
    }
    
    let new_content = serde_json::to_string_pretty(&json)?;
    std::fs::write(path, new_content)?;
    Ok(())
}

fn customize_env(root: &Path, opts: &InitOptions) -> Result<()> {
    let path = root.join(".env");
    if !path.exists() { return Ok(()); }
    
    let content = std::fs::read_to_string(&path)?;
    let port = opts.port.unwrap_or(8080);
    
    let new_content = content
        .replace("{{PORT}}", &port.to_string())
        .replace("PORT=8080", &format!("PORT={}", port));

    std::fs::write(path, new_content)?;
    Ok(())
}

fn customize_config(root: &Path, name: &str, opts: &InitOptions) -> Result<()> {
    let path = root.join("xypriss.config.json");
    
    let mut config: Value = if path.exists() {
        let content = std::fs::read_to_string(&path)?;
        serde_json::from_str(&content).unwrap_or_else(|_| Value::Object(serde_json::Map::new()))
    } else {
        Value::Object(serde_json::Map::new())
    };
    
    let desc = opts.desc.clone().unwrap_or_else(|| format!("XyPriss project: {}", name));
    let author = opts.author.clone().unwrap_or_else(|| "User".to_string());
    let alias = opts.alias.clone().unwrap_or_else(|| name.to_string());
    let port = opts.port.unwrap_or(8080);
    
    let sys_config = serde_json::json!({
        "__version__": "1.0.0",
        "__author__": author,
        "__name__": name,
        "__description__": desc,
        "__alias__": alias,
        "__port__": port,
        "__PORT__": port
    });
    
    if let Some(obj) = config.as_object_mut() {
        obj.insert("__sys__".to_string(), sys_config);
    }
    
    let new_content = serde_json::to_string_pretty(&config)?;
    std::fs::write(path, new_content)?;
    Ok(())
}

fn customize_readme(root: &Path, name: &str, opts: &InitOptions) -> Result<()> {
    let path = root.join("README.md");
    if !path.exists() { return Ok(()); }
    
    let desc = opts.desc.clone().unwrap_or_else(|| format!("XyPriss project: {}", name));
    let port = opts.port.unwrap_or(8080);

    let content = std::fs::read_to_string(&path)?;
    let new_content = content
        .replace("{{PROJECT_NAME}}", name)
        .replace("{{PROJECT_DESCRIPTION}}", &desc)
        .replace("{{PORT}}", &port.to_string())
        .replace("{{FEATURES}}", ""); // Clean up placeholder
        
    std::fs::write(path, new_content)?;
    Ok(())
}

fn process_dot_config(root: &Path) -> Result<()> {
    let config_path = root.join(".config");
    if !config_path.exists() {
        // println!("Warning: .config not found at {}", config_path.display());
        return Ok(()); 
    }
    
    let content = std::fs::read_to_string(&config_path)?;
    let lines: Vec<&str> = content.lines().collect();
    
    let mut deps: Vec<String> = Vec::new();
    let mut dev_deps: Vec<String> = Vec::new();
    let mut in_deps = false;
    let mut in_dev_deps = false;
    
    for line in lines {
        let raw_trimmed = line.trim();
        if raw_trimmed.is_empty() || raw_trimmed.starts_with("#") { continue; }
        
        // Handle list syntax "- package"
        let trimmed = raw_trimmed.strip_prefix("-").unwrap_or(raw_trimmed).trim();
        if trimmed.is_empty() { continue; }
        
        let lower = raw_trimmed.to_lowercase(); // check section headers on raw line or trimmed? 
        // Headers actullement dans le fichier que j'ai vu en zip semblaient etre "Deps:" sans tiret,
        // mais si "line" commence par "- ", alors "Deps:" ne sera pas matché si je check sur "trimmed" qui a perdu le tiret ?
        // Non, headers sont probablement "Deps:" tout court.
        // Mais "Dependencies:" pourrait etre matché.
        if lower.starts_with("deps:") || lower.starts_with("dependencies:") {
            in_deps = true;
            in_dev_deps = false;
            continue;
        } else if lower.starts_with("devdeps:") || lower.starts_with("devdependencies:") {
            in_deps = false;
            in_dev_deps = true;
            continue;
        }
        
        if in_deps {
            deps.push(trimmed.to_string());
        } else if in_dev_deps {
            dev_deps.push(trimmed.to_string());
        }
    }
    
    // println!("Found {} deps and {} devDeps in .config", deps.len(), dev_deps.len());
    
    // Now update package.json
    let pkg_path = root.join("package.json");
    let pkg_content = std::fs::read_to_string(&pkg_path)?;
    let mut json: Value = serde_json::from_str(&pkg_content)?;
    
    if let Some(obj) = json.as_object_mut() {
        // Init dependencies object if missing
        if !obj.contains_key("dependencies") {
            obj.insert("dependencies".to_string(), serde_json::json!({}));
        }
        if !obj.contains_key("devDependencies") {
            obj.insert("devDependencies".to_string(), serde_json::json!({}));
        }

        // Populate dependencies ("latest" is clearer than "*")
        if let Some(d) = obj.get_mut("dependencies").and_then(|v| v.as_object_mut()) {
            for dep in &deps {
                d.insert(dep.clone(), Value::String("latest".to_string()));
            }
        }
        
        // Populate devDependencies ("latest")
        if let Some(d) = obj.get_mut("devDependencies").and_then(|v| v.as_object_mut()) {
            for dep in &dev_deps {
                d.insert(dep.clone(), Value::String("latest".to_string()));
            }
        }
    }
    
    let new_content = serde_json::to_string_pretty(&json)?;
    std::fs::write(pkg_path, new_content)?;
    
    // cleanup .config
    std::fs::remove_file(config_path)?;
    
    Ok(())
}
