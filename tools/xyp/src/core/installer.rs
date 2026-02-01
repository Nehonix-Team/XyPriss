use crate::core::cas::Cas;
use crate::core::registry::RegistryClient;
use crate::core::extractor::StreamingExtractor;
use anyhow::{Result, Context};
use std::path::{Path, PathBuf};
use std::fs;
use colored::Colorize;
use indicatif::{MultiProgress, ProgressBar};
use rayon::prelude::*;
use std::collections::HashMap;
use std::sync::Arc;
use dashmap::DashSet;
use tokio_util::io::{StreamReader, SyncIoBridge};

pub struct Installer {
    cas: Cas,
    registry: Arc<RegistryClient>,
    multi: MultiProgress,
    project_root: PathBuf,
    extracted_cache: Arc<DashSet<String>>, 
    extraction_locks: Arc<DashSet<String>>, 
    dir_cache: Arc<DashSet<String>>, 
    is_project_mode: bool, 
    main_pb: Arc<parking_lot::Mutex<Option<ProgressBar>>>, 
}

impl Installer {
    pub fn new(cas_path: &Path, project_root: &Path, registry: Arc<RegistryClient>) -> Result<Self> {
        let abs_cas = if cas_path.is_absolute() { 
            cas_path.to_path_buf() 
        } else { 
            project_root.join(cas_path) 
        };
        
        Ok(Self {
            cas: Cas::new(&abs_cas)?,
            registry,
            multi: MultiProgress::new(),
            project_root: project_root.to_path_buf(),
            extracted_cache: Arc::new(DashSet::new()),
            extraction_locks: Arc::new(DashSet::new()),
            dir_cache: Arc::new(DashSet::new()),
            is_project_mode: project_root.join("node_modules").exists() || project_root.join("package.json").exists(),
            main_pb: Arc::new(parking_lot::Mutex::new(None)),
        })
    }

    pub fn set_main_pb(&self, pb: ProgressBar) {
        *self.main_pb.lock() = Some(pb);
    }

    pub fn set_multi(&mut self, multi: MultiProgress) {
        self.multi = multi;
    }

    pub fn get_cas(&self) -> Arc<Cas> {
        Arc::new(self.cas.clone())
    }

    pub fn is_package_extracted(&self, name: &str, version: &str) -> bool {
        let cache_key = format!("{}@{}", name, version);
        if self.extracted_cache.contains(&cache_key) {
            return true;
        }
        let virtual_store_root = self.get_virtual_store_root(name, version);
        virtual_store_root.join("node_modules").join(name).join("package.json").exists()
    }

    pub fn get_virtual_store_root(&self, name: &str, version: &str) -> PathBuf {
        let virtual_store_name = format!("{}@{}", name.replace('/', "+"), version);
        
        if self.is_project_mode {
            self.project_root.join("node_modules").join(".xpm").join("virtual_store").join(&virtual_store_name)
        } else if self.project_root.ends_with(".xpm_global") {
            self.project_root.join("node_modules").join(".xpm").join("virtual_store").join(&virtual_store_name)
        } else {
            self.cas.base_path.join("virtual_store").join(&virtual_store_name)
        }
    }

    pub async fn batch_ensure_extracted(&self, packages: &[Arc<crate::core::resolver::ResolvedPackage>]) -> Result<()> {
        use futures_util::stream::{self, StreamExt};
        
        let pb = {
            let mut guard = self.main_pb.lock();
            if let Some(ref pb) = *guard {
                pb.clone()
            } else {
                let pb = self.multi.add(indicatif::ProgressBar::new(packages.len() as u64));
                pb.set_style(indicatif::ProgressStyle::default_bar()
                    .template("{spinner:.green} [*] Unpacking: [{bar:40.green/black}] {pos}/{len} ({percent}%) -> {msg}")
                    .unwrap()
                    .progress_chars("10"));
                pb.set_message("Initializing sequence...");
                pb.enable_steady_tick(std::time::Duration::from_millis(50));
                *guard = Some(pb.clone());
                pb
            }
        };

        if pb.length().unwrap_or(0) < packages.len() as u64 {
            pb.set_length(packages.len() as u64);
        }

        let concurrency = self.registry.get_config().get_concurrency().min(64).max(16);
        
        let mut stream = stream::iter(packages)
            .map(|pkg| {
                let pb = pb.clone();
                async move {
                    let cache_key = format!("{}@{}", pkg.name, pkg.version);
                    if !self.extracted_cache.contains(&cache_key) {
                        if rand::random::<f32>() < 0.1 {
                             pb.set_message(format!("0x{:04x} >> extracting {}...", rand::random::<u16>(), pkg.name.dimmed()));
                        }
                    }
                    
                    let res = self.ensure_extracted(pkg).await;
                    pb.inc(1);
                    
                    if rand::random::<f32>() < 0.05 {
                        pb.set_message(format!("0x{:04x} [STREAM_LOCKED]", rand::random::<u16>()));
                    }
                    
                    res
                }
            })
            .buffer_unordered(concurrency);

        while let Some(result) = stream.next().await {
            result?; 
        }
        
        pb.finish_and_clear();
        Ok(())
    }

    pub async fn ensure_extracted(&self, pkg: &crate::core::resolver::ResolvedPackage) -> Result<()> {
        let name = &pkg.name;
        let version = &pkg.version;
        let cache_key = format!("{}@{}", name, version);
        
        if self.extracted_cache.contains(&cache_key) {
            return Ok(());
        }
        
        let virtual_store_root = self.get_virtual_store_root(name, version);
        let pkg_dir = virtual_store_root.join("node_modules").join(name);

        if pkg_dir.join("package.json").exists() {
            self.extracted_cache.insert(cache_key);
            return Ok(());
        }
        
        while self.extraction_locks.contains(&cache_key) {
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            if self.extracted_cache.contains(&cache_key) { return Ok(()); }
        }
        
        self.extraction_locks.insert(cache_key.clone());
        
        let virtual_store_root = self.get_virtual_store_root(name, version);
        let pkg_parent = virtual_store_root.join("node_modules");

        let parent_str = pkg_parent.to_string_lossy();
        if !self.dir_cache.contains(parent_str.as_ref()) {
            let _ = fs::create_dir_all(&pkg_parent);
            self.dir_cache.insert(parent_str.to_string());
        }
        
        let pkg_dir = pkg_parent.join(name);
        
        if pkg_dir.exists() {
            self.extraction_locks.remove(&cache_key);
            self.extracted_cache.insert(cache_key);
            return Ok(());
        }

        if let Some(pb) = self.main_pb.lock().as_ref() {
            if rand::random::<f32>() < 0.2 {
                pb.set_message(format!("0x{:04x} [DEPACKING] {}", rand::random::<u16>(), name.dimmed()));
            }
        }

        let file_map = if let Some(index) = self.cas.get_index(name, version)? {
            index
        } else {
            let stream = self.registry.download_tarball_stream(&pkg.metadata.dist.tarball).await?;
            let cas_path = self.cas.base_path.clone();
            let name_owned = name.to_string();
            let version_owned = version.to_string();
            
            tokio::task::spawn_blocking(move || {
                let cas = crate::core::cas::Cas::new(&cas_path)?;
                let extractor = StreamingExtractor::new(&cas);
                let reader = StreamReader::new(stream);
                let sync_reader = SyncIoBridge::new(reader);
                let buffered_reader = std::io::BufReader::with_capacity(1024 * 1024, sync_reader);
                let file_map = extractor.extract(buffered_reader)?;
                cas.store_index(&name_owned, &version_owned, &file_map)?;
                Ok::<_, anyhow::Error>(file_map)
            }).await??
        };

        self.link_files_to_dir(&pkg_dir, &file_map).context("Linking files to virtual store")?;
        self.extracted_cache.insert(cache_key.clone());
        self.extraction_locks.remove(&cache_key);
        Ok(())
    }

    pub async fn link_package_deps(&self, pkg: &crate::core::resolver::ResolvedPackage) -> Result<()> {
        let name = &pkg.name;
        let version = &pkg.version;
        let virtual_store_root = self.get_virtual_store_root(name, version);
        let deps_nm = virtual_store_root.join("node_modules");

        for (dep_name, dep_version) in pkg.resolved_dependencies.iter() {
            let target_link = deps_nm.join(dep_name);
            
            if let Some(parent) = target_link.parent() {
                fs::create_dir_all(parent)?;
            }
            
            if target_link.exists() || target_link.is_symlink() {
                let _ = fs::remove_file(&target_link);
            }
            
            let dep_abs_target = self.get_virtual_store_root(dep_name, dep_version)
                .join("node_modules")
                .join(dep_name);
            
            if !dep_abs_target.exists() {
                 continue; 
            }
            
            #[cfg(unix)]
            {
                std::os::unix::fs::symlink(&dep_abs_target, &target_link)
                    .map_err(|e| anyhow::anyhow!("Failed to link {} to {}: {}", dep_name, target_link.display(), e))?;
            }
            
            #[cfg(windows)]
            {
                std::os::windows::fs::symlink_dir(&dep_abs_target, &target_link)?;
            }
        }
        
        Ok(())
    }

    fn link_files_to_dir(&self, dest_dir: &Path, index: &std::collections::HashMap<String, String>) -> Result<()> {
        if !dest_dir.exists() {
            fs::create_dir_all(dest_dir)?;
        }

        let dir_cache = dashmap::DashSet::with_capacity(index.len() / 4);
        
        index.par_iter().for_each(|(rel_path, hash)| {
            let normalized_path = if let Some(pos) = rel_path.find('/') {
                &rel_path[pos + 1..]
            } else {
                rel_path
            };
            let dest_path = dest_dir.join(normalized_path);
            let source_path = self.cas.get_file_path(hash);

            if let Some(parent) = dest_path.parent() {
                let parent_str = parent.to_string_lossy();
                if !dir_cache.contains(parent_str.as_ref()) {
                    let _ = fs::create_dir_all(parent);
                    dir_cache.insert(parent_str.to_string());
                }
            }

            if let Err(_) = fs::hard_link(&source_path, &dest_path) {
                let _ = fs::remove_file(&dest_path);
                if let Err(e) = fs::hard_link(&source_path, &dest_path) {
                    eprintln!("   {} Failed to link {} to {}: {}", "[ERR]".red(), source_path.display(), dest_path.display(), e);
                }
            }
        });

        Ok(())
    }

    async fn run_postinstall_static(pkg_dir: &Path, name: &str, version: &str) -> Result<()> {
        let pkg_json_path = pkg_dir.join("package.json");
        if !pkg_json_path.exists() { 
            return Ok(()); 
        }

        let content = fs::read_to_string(&pkg_json_path)?;
        let v: serde_json::Value = serde_json::from_str(&content)?;
        
        let scripts_to_run = ["preinstall", "install", "postinstall"];
        let mut found_scripts = Vec::new();

        if let Some(scripts) = v.get("scripts").and_then(|s| s.as_object()) {
            for event in &scripts_to_run {
                if let Some(script) = scripts.get(*event).and_then(|s| s.as_str()) {
                    found_scripts.push((*event, script.to_string()));
                }
            }
        }

        if found_scripts.is_empty() {
            return Ok(());
        }

        let mut path_val = std::env::var_os("PATH").unwrap_or_default();
        let mut paths = Vec::new();

        if let Some(deps_bin) = pkg_dir.parent().map(|p| p.join(".bin")) {
            if deps_bin.exists() {
                paths.push(deps_bin);
            }
        }

        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
        let global_bin = std::path::Path::new(&home).join(".xpm_global").join("bin");
        if global_bin.exists() {
            paths.push(global_bin);
        }

        if !paths.is_empty() {
            if let Ok(current_path) = std::env::var("PATH") {
                paths.extend(std::env::split_paths(&current_path));
            }
            if let Ok(new_path) = std::env::join_paths(paths) {
                path_val = new_path.into();
            }
        }

        for (event, script) in found_scripts {
            println!("   {} Running {} script for {}@{}...", "⚡".yellow().bold(), event.cyan(), name.bold(), version.cyan());
            
            let mut child = tokio::process::Command::new("sh")
                .arg("-c")
                .arg(&script)
                .current_dir(pkg_dir)
                .env("PATH", &path_val)
                .stdout(std::process::Stdio::inherit())
                .stderr(std::process::Stdio::inherit())
                .spawn()?;

            let status = tokio::time::timeout(
                std::time::Duration::from_secs(600), 
                child.wait()
            ).await;

            match status {
                Ok(Ok(exit_status)) => {
                    if !exit_status.success() {
                        eprintln!("   {} Script '{}' failed with exit code: {:?}", "✖".red(), event, exit_status.code());
                    }
                }
                Ok(Err(e)) => {
                    eprintln!("   {} Failed to wait for script '{}': {}", "✖".red(), event, e);
                }
                Err(_) => {
                    eprintln!("   {} Script '{}' timed out after 10 minutes", "✖".red(), event);
                    let _ = child.kill().await;
                }
            }
        }
        
        Ok(())
    }

    pub async fn run_postinstall_for_pkg(&self, pkg: &crate::core::resolver::ResolvedPackage) -> Result<()> {
        let name = &pkg.name;
        let version = &pkg.version;
        let virtual_store_root = self.get_virtual_store_root(name, version);
        let pkg_path = virtual_store_root.join("node_modules").join(name);
        Self::run_postinstall_static(&pkg_path, name, version).await
    }

    pub fn link_to_root(&self, name: &str, version: &str, bin_meta: Option<&serde_json::Value>) -> Result<()> {
        let root_nm = self.project_root.join("node_modules").join(name);
        
        let virtual_store_root = self.get_virtual_store_root(name, version);
        let abs_target = virtual_store_root.join("node_modules").join(name);
        
        if !abs_target.exists() {
            return Err(anyhow::anyhow!("Virtual store target missing for {}@{}: {}", name, version, abs_target.display()));
        }

        if let Some(parent) = root_nm.parent() {
            let parent_str = parent.to_string_lossy();
            if !self.dir_cache.contains(parent_str.as_ref()) {
                if parent.exists() && parent.is_symlink() {
                    let _ = fs::remove_file(parent);
                }
                if !parent.exists() { 
                    fs::create_dir_all(parent)?; 
                }
                self.dir_cache.insert(parent_str.to_string());
            }
        }

        if root_nm.exists() || root_nm.is_symlink() {
            if root_nm.is_dir() && !root_nm.is_symlink() {
                let _ = fs::remove_dir_all(&root_nm);
            } else {
                let _ = fs::remove_file(&root_nm);
            }
        }

        #[cfg(unix)]
        std::os::unix::fs::symlink(&abs_target, &root_nm).context("Creating package root symlink")?;
        
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&abs_target, &root_nm)?;
        
        let virtual_store_name = format!("{}@{}", name.replace('/', "+"), version);
        let nm_root = self.project_root.join("node_modules");
        self.link_binaries_with_meta(&abs_target, &nm_root.join(".bin"), &virtual_store_name, bin_meta)
            .context("Linking binaries to root bin")?;
        
        Ok(())
    }

    pub fn link_binaries_with_meta(&self, pkg_dir: &Path, target_bin_dir: &Path, virtual_store_name: &str, bin_meta: Option<&serde_json::Value>) -> Result<()> {
        if let Some(bin) = bin_meta {
            if !target_bin_dir.exists() { 
                let _ = fs::create_dir_all(&target_bin_dir); 
            }

            if let Some(bin_map) = bin.as_object() {
                for (bin_name, bin_path_val) in bin_map {
                    if let Some(bin_rel_path) = bin_path_val.as_str() {
                        self.create_bin_link(bin_name, pkg_dir, bin_rel_path, target_bin_dir)?;
                    }
                }
            } else if let Some(bin_path) = bin.as_str() {
                let pkg_name = virtual_store_name.split('@').next().unwrap_or(virtual_store_name);
                self.create_bin_link(pkg_name, pkg_dir, bin_path, target_bin_dir)?;
            }
            return Ok(());
        }

        self.link_binaries(pkg_dir, target_bin_dir, virtual_store_name)
    }

    pub fn link_binaries(&self, pkg_dir: &Path, target_bin_dir: &Path, virtual_store_name: &str) -> Result<()> {
        let pkg_json_path = pkg_dir.join("package.json");
        if !pkg_json_path.exists() { 
            return Ok(()); 
        }

        let content = fs::read_to_string(&pkg_json_path)?;
        let v: serde_json::Value = serde_json::from_str(&content)?;
        
        if !target_bin_dir.exists() { 
            fs::create_dir_all(&target_bin_dir)?; 
        }

        if let Some(bin) = v.get("bin") {
            if let Some(bin_map) = bin.as_object() {
                for (bin_name, bin_path_val) in bin_map {
                    if let Some(bin_rel_path) = bin_path_val.as_str() {
                        self.create_bin_link(bin_name, pkg_dir, bin_rel_path, target_bin_dir)?;
                    }
                }
            } else if let Some(bin_path) = bin.as_str() {
                let pkg_name = virtual_store_name.split('@').next().unwrap_or(virtual_store_name);
                self.create_bin_link(pkg_name, pkg_dir, bin_path, target_bin_dir)?;
            }
        }
        
        Ok(())
    }

    fn create_bin_link(&self, name: &str, pkg_dir: &Path, bin_path: &str, bin_dir: &Path) -> Result<()> {
        let dest = bin_dir.join(name);
        
        if dest.exists() || dest.is_symlink() { 
            let _ = fs::remove_file(&dest); 
        }
        
        let abs_target = pkg_dir.join(bin_path);

        let rel_target = pathdiff::diff_paths(&abs_target, bin_dir)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| abs_target.to_string_lossy().to_string());
        
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&rel_target, &dest)?;
            
            if abs_target.exists() {
                use std::os::unix::fs::PermissionsExt;
                if let Ok(meta) = fs::metadata(&abs_target) {
                    let mut perms = meta.permissions();
                    perms.set_mode(0o755);
                    if let Err(e) = fs::set_permissions(&abs_target, perms) {
                        eprintln!("   {} Warning: Could not set executable bit on {}: {}", "[!]".yellow(), abs_target.display(), e);
                    }
                }
            }
        }
        
        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_file(&rel_target, &dest)?;
        }
        
        Ok(())
    }

    pub fn update_package_json(path: &Path, updates: HashMap<String, String>) -> Result<()> {
        if !path.exists() || updates.is_empty() { return Ok(()); }
        let content = fs::read_to_string(path)?;
        let mut v: serde_json::Value = serde_json::from_str(&content)?;
        
        let sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

        if let Some(obj) = v.as_object_mut() {
            for (name, version) in updates {
                let mut found = false;
                for section in sections {
                    if let Some(deps) = obj.get_mut(section).and_then(|d| d.as_object_mut()) {
                        if deps.contains_key(&name) {
                            deps.insert(name.clone(), serde_json::Value::String(version.clone()));
                            found = true;
                            break;
                        }
                    }
                }

                if !found {
                    if !obj.contains_key("dependencies") {
                        obj.insert("dependencies".to_string(), serde_json::Value::Object(serde_json::Map::new()));
                    }
                    if let Some(deps) = obj.get_mut("dependencies").and_then(|d| d.as_object_mut()) {
                        deps.insert(name, serde_json::Value::String(version));
                    }
                }
            }
        }
        
        fs::write(path, serde_json::to_string_pretty(&v)?)?;
        Ok(())
    }

    pub fn batch_link_to_root(&self, packages: &[(String, String)]) -> Result<()> {
        packages.par_iter().for_each(|(name, version)| {
            if let Err(e) = self.link_to_root(name, version, None) {
                eprintln!("{} Failed to link {}@{}: {}", 
                    "✘".red().bold(), name, version, e);
            }
        });
        
        Ok(())
    }
}