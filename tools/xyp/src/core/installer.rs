use crate::core::cas::Cas;
use crate::core::registry::RegistryClient;
use crate::core::extractor::StreamingExtractor;
use anyhow::{Result, Context};
use std::path::{Path, PathBuf};
use std::fs;
use std::io::Write;
use colored::Colorize;
use futures_util::StreamExt;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
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
    extracted_cache: Arc<DashSet<String>>, // Track extracted packages
    extraction_locks: Arc<DashSet<String>>, // Simple locks
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
        })
    }

    pub fn set_multi(&mut self, multi: MultiProgress) {
        self.multi = multi;
    }

    pub fn get_cas(&self) -> Arc<Cas> {
        Arc::new(self.cas.clone())
    }

    pub fn get_virtual_store_root(&self, name: &str, version: &str) -> PathBuf {
        let virtual_store_name = format!("{}@{}", name.replace('/', "+"), version);
        
        // CONSISTENT LAYOUT: Always use node_modules/.xpm if we are in a project
        if self.project_root.join("node_modules").exists() || self.project_root.join("package.json").exists() {
            let root = self.project_root.join("node_modules").join(".xpm").join("virtual_store").join(&virtual_store_name);
            let _ = fs::create_dir_all(root.parent().unwrap());
            root
        } else if self.project_root.ends_with(".xpm_global") {
            self.project_root.join("node_modules").join(".xpm").join("virtual_store").join(&virtual_store_name)
        } else {
            self.cas.base_path.join("virtual_store").join(&virtual_store_name)
        }
    }

    /// Optimized batch extraction - processes multiple packages in parallel
    pub async fn batch_ensure_extracted(&self, packages: &[crate::core::resolver::ResolvedPackage]) -> Result<()> {
        use futures_util::stream::{FuturesUnordered, StreamExt};
        
        let mut tasks = FuturesUnordered::new();
        
        for pkg in packages {
            let cache_key = format!("{}@{}", pkg.name, pkg.version);
            
            // Skip if already extracted
            if self.extracted_cache.contains(&cache_key) {
                continue;
            }
            
            tasks.push(self.ensure_extracted(pkg));
        }
        
        let pb = self.multi.add(indicatif::ProgressBar::new(packages.len() as u64));
        pb.set_style(indicatif::ProgressStyle::default_bar()
            .template("{spinner:.green}[*] Unpacking: [{bar:40.green/black}] {pos}/{len} ({percent}%) {msg}")
            .unwrap()
            .progress_chars("10"));
        pb.set_message("Extracting packages..");
        pb.enable_steady_tick(std::time::Duration::from_millis(50));

        let mut buffer = Vec::with_capacity(50);
        while let Some(result) = tasks.next().await {
            pb.inc(1);
            if let Ok(_) = result {
                // Occasional "techno" message
                if packages.len() > 10 && rand::random::<f32>() < 0.05 {
                    pb.set_message(format!("Decoding block 0x{:04x}...", rand::random::<u16>()));
                }
            }
            buffer.push(result);
            
            if buffer.len() >= 50 {
                for res in buffer.drain(..) {
                    res?;
                }
            }
        }
        
        pb.finish_with_message("Sequence complete.");
        
        // Process remaining
        for res in buffer {
            res?;
        }
        
        Ok(())
    }

    pub async fn ensure_extracted(&self, pkg: &crate::core::resolver::ResolvedPackage) -> Result<()> {
        let name = &pkg.name;
        let version = &pkg.version;
        let cache_key = format!("{}@{}", name, version);
        
        // Fast path: already extracted
        if self.extracted_cache.contains(&cache_key) {
            return Ok(());
        }
        
        let virtual_store_root = self.get_virtual_store_root(name, version);
        let pkg_dir = virtual_store_root.join("node_modules").join(name);

        if pkg_dir.exists() {
            self.extracted_cache.insert(cache_key);
            return Ok(());
        }
        
        // SIMPLE LOCK: if another thread is already extracting, wait and retry
        while self.extraction_locks.contains(&cache_key) {
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            if self.extracted_cache.contains(&cache_key) { return Ok(()); }
        }
        
        self.extraction_locks.insert(cache_key.clone());
        
        // Re-check after acquiring "lock"
        if pkg_dir.exists() {
            self.extraction_locks.remove(&cache_key);
            self.extracted_cache.insert(cache_key);
            return Ok(());
        }

        let pb = self.multi.add(ProgressBar::new_spinner());
        pb.set_style(ProgressStyle::default_spinner()
            .template("{spinner:.cyan} {msg}")
            .unwrap());
        pb.set_message(format!("Unpacking {}@{}...", name, version));
        pb.enable_steady_tick(std::time::Duration::from_millis(80));

        let file_map = if let Some(index) = self.cas.get_index(name, version)? {
            index
        } else {
            let tarball_path = self.download_to_cache(pkg).await?;
            
            let cas_path = self.cas.base_path.clone();
            let name_owned = name.to_string();
            let version_owned = version.to_string();
            
            // Spawn blocking task for CPU-bound extraction
            tokio::task::spawn_blocking(move || {
                let cas = crate::core::cas::Cas::new(&cas_path)?;
                let extractor = StreamingExtractor::new(&cas);
                
                let file = fs::File::open(&tarball_path)?;
                let buffered_reader = std::io::BufReader::with_capacity(1024 * 1024, file);
                let file_map = extractor.extract(buffered_reader)?;
                
                cas.store_index(&name_owned, &version_owned, &file_map)?;
                Ok::<_, anyhow::Error>(file_map)
            }).await??
        };

        self.link_files_to_dir(&pkg_dir, &file_map).context("Linking files to virtual store")?;
        self.extracted_cache.insert(cache_key.clone());
        self.extraction_locks.remove(&cache_key);
        
        pb.finish_with_message(format!("{} Unpacked {}@{}", "[OK]".bold().green(), name, version));
        
        Ok(())
    }

    pub async fn link_package_deps(&self, pkg: &crate::core::resolver::ResolvedPackage) -> Result<()> {
        let name = &pkg.name;
        let version = &pkg.version;
        let virtual_store_root = self.get_virtual_store_root(name, version);
        let deps_nm = virtual_store_root.join("node_modules");

        // Dependency linking
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
            
            let rel_target = pathdiff::diff_paths(&dep_abs_target, target_link.parent().unwrap())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| dep_abs_target.to_string_lossy().to_string());
            
            #[cfg(unix)]
            {
                std::os::unix::fs::symlink(&rel_target, &target_link)
                    .map_err(|e| anyhow::anyhow!("Failed to link {} to {}: {}", dep_name, target_link.display(), e))?;
            }
            
            #[cfg(windows)]
            {
                std::os::windows::fs::symlink_dir(&rel_target, &target_link)?;
            }
        }
        
        // Run postinstall (wait for it to ensure binaries are ready)
        let pkg_path = deps_nm.join(name);
        Self::run_postinstall_static(&pkg_path, name, version).await?;
        
        Ok(())
    }

    fn link_files_to_dir(&self, dest_dir: &Path, index: &std::collections::HashMap<String, String>) -> Result<()> {
        // Pre-create destination directory
        if !dest_dir.exists() {
            fs::create_dir_all(dest_dir)?;
        }

        let dir_cache = dashmap::DashSet::with_capacity(index.len() / 4);
        
        index.par_iter().for_each(|(rel_path, hash)| {
            // Robust normalization: strip the first segment (usually "package/" or "repo-name/")
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

            // High performance: try hard_link directly first.
            if let Err(_) = fs::hard_link(&source_path, &dest_path) {
                // If it fails (likely already exists), remove and try again.
                let _ = fs::remove_file(&dest_path);
                if let Err(e) = fs::hard_link(&source_path, &dest_path) {
                    eprintln!("   {} Failed to link {} to {}: {}", "[ERR]".red(), source_path.display(), dest_path.display(), e);
                }
            }
        });

        Ok(())
    }

    async fn run_postinstall_static(pkg_dir: &Path, name: &str, _version: &str) -> Result<()> {
        let pkg_json_path = pkg_dir.join("package.json");
        if !pkg_json_path.exists() { 
            return Ok(()); 
        }

        let content = fs::read_to_string(&pkg_json_path)?;
        let v: serde_json::Value = serde_json::from_str(&content)?;
        
        if let Some(scripts) = v.get("scripts").and_then(|s| s.as_object()) {
            for event in &["preinstall", "install", "postinstall"] {
                if let Some(script) = scripts.get(*event).and_then(|s| s.as_str()) {
                    let mut child = tokio::process::Command::new("sh")
                        .arg("-c")
                        .arg(script)
                        .current_dir(pkg_dir)
                        .stdout(std::process::Stdio::piped())
                        .stderr(std::process::Stdio::piped())
                        .spawn()?;

                    let status = tokio::time::timeout(
                        std::time::Duration::from_secs(600), 
                        child.wait()
                    ).await;

                    match status {
                        Ok(Ok(s)) => {
                            if !s.success() {
                                let output = child.wait_with_output().await?;
                                let err_msg = String::from_utf8_lossy(&output.stderr);
                                eprintln!("   {} Script '{}' failed for {} with exit code {}\n      {}", 
                                    "[ERR]".red(), event, name.bold(), s.code().unwrap_or(-1), err_msg.trim().dimmed());
                            }
                        }
                        Ok(Err(e)) => {
                            eprintln!("   {} System error running '{}' for {}: {}", 
                                "[ERR]".red(), event, name.bold(), e);
                        }
                        Err(_) => {
                            eprintln!("   {} Script '{}' for {} timed out (10m)", 
                                "[ERR]".red(), event, name.bold());
                            let _ = child.kill().await;
                        }
                    }
                }
            }
        }
        
        Ok(())
    }

    async fn run_postinstall(&self, pkg_dir: &Path, name: &str, version: &str) -> Result<()> {
        Self::run_postinstall_static(pkg_dir, name, version).await
    }

    pub fn link_to_root(&self, name: &str, version: &str) -> Result<()> {
        let root_nm = self.project_root.join("node_modules").join(name);
        
        let virtual_store_root = self.get_virtual_store_root(name, version);
        let abs_target = virtual_store_root.join("node_modules").join(name);
        
        // Ensure abs_target exists before linking
        if !abs_target.exists() {
             anyhow::bail!("Cannot link to root: virtual store target {} does not exist yet", abs_target.display());
        }

        let rel_target = pathdiff::diff_paths(&abs_target, root_nm.parent().unwrap())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| abs_target.to_string_lossy().to_string());

        // Ensure parent exists and is a real directory (crucial for scoped packages like @types)
        if let Some(parent) = root_nm.parent() {
            if parent.exists() && fs::symlink_metadata(parent).is_ok() && fs::symlink_metadata(parent)?.file_type().is_symlink() {
                let _ = fs::remove_file(parent);
            }
            if !parent.exists() { 
                fs::create_dir_all(parent)?; 
            }
        }

        // Clean existing symlink/directory
        if root_nm.exists() || fs::symlink_metadata(&root_nm).is_ok() {
            if root_nm.is_dir() && !fs::symlink_metadata(&root_nm)?.file_type().is_symlink() {
                fs::remove_dir_all(&root_nm).context("Removing stale directory for root link")?;
            } else {
                let _ = fs::remove_file(&root_nm);
            }
        }

        // Create the symlink
        #[cfg(unix)]
        std::os::unix::fs::symlink(&rel_target, &root_nm).context("Creating package root symlink")?;
        
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&rel_target, &root_nm)?;
        
        // Link binaries
        let virtual_store_name = format!("{}@{}", name.replace('/', "+"), version);
        let nm_root = self.project_root.join("node_modules");
        self.link_binaries(&abs_target, &nm_root.join(".bin"), &virtual_store_name)
            .with_context(|| format!("Linking binaries for {} to root bin", name))?;
        
        Ok(())
    }

    pub fn link_binaries(&self, pkg_dir: &Path, target_bin_dir: &Path, virtual_store_name: &str) -> Result<()> {
        let pkg_json_path = pkg_dir.join("package.json");
        if !pkg_json_path.exists() { 
            return Ok(()); 
        }

        let content = fs::read_to_string(&pkg_json_path).context("Reading package.json for bins")?;
        let v: serde_json::Value = serde_json::from_str(&content).context("Parsing package.json for bins")?;
        
        if !target_bin_dir.exists() { 
            let _ = fs::create_dir_all(&target_bin_dir);
        }

        if let Some(bin) = v.get("bin") {
            if let Some(bin_map) = bin.as_object() {
                for (bin_name, bin_path_val) in bin_map {
                    if let Some(bin_rel_path) = bin_path_val.as_str() {
                        let _ = self.create_bin_link(bin_name, pkg_dir, bin_rel_path, target_bin_dir);
                    }
                }
            } else if let Some(bin_path) = bin.as_str() {
                let pkg_name = virtual_store_name.split('@').next().unwrap_or(virtual_store_name);
                let clean_name = pkg_name.split('/').last().unwrap_or(pkg_name);
                let _ = self.create_bin_link(clean_name, pkg_dir, bin_path, target_bin_dir);
            }
        }
        
        Ok(())
    }

    fn create_bin_link(&self, name: &str, pkg_dir: &Path, bin_path: &str, bin_dir: &Path) -> Result<()> {
        let dest = bin_dir.join(name);
        
        // Clean existing - ignore errors if file was deleted by another thread
        if dest.exists() || fs::symlink_metadata(&dest).is_ok() { 
            if dest.is_dir() && !fs::symlink_metadata(&dest)?.file_type().is_symlink() {
                let _ = fs::remove_dir_all(&dest);
            } else {
                let _ = fs::remove_file(&dest); 
            }
        }
        
        let abs_target = pkg_dir.join(bin_path);
        if !abs_target.exists() {
             return Ok(()); // Skip broken binary references
        }

        // Calculate relative path for portability
        let rel_target = pathdiff::diff_paths(&abs_target, bin_dir)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| abs_target.to_string_lossy().to_string());
        
        #[cfg(unix)]
        {
            let _ = std::os::unix::fs::symlink(&rel_target, &dest);
            
            // Make executable
            use std::os::unix::fs::PermissionsExt;
            if let Ok(meta) = fs::metadata(&abs_target) {
                let mut perms = meta.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&abs_target, perms);
            }
        }
        
        #[cfg(windows)]
        {
            let _ = std::os::windows::fs::symlink_file(&rel_target, &dest);
        }
        
        Ok(())
    }

    pub fn update_package_json(path: &Path, updates: HashMap<String, String>) -> Result<()> {
        if !path.exists() || updates.is_empty() { return Ok(()); }
        let content = fs::read_to_string(path)?;
        let mut v: serde_json::Value = serde_json::from_str(&content)?;
        
        if let Some(deps) = v.get_mut("dependencies").and_then(|d| d.as_object_mut()) {
            for (name, version) in updates {
                deps.insert(name, serde_json::Value::String(version));
            }
        }
        
        fs::write(path, serde_json::to_string_pretty(&v)?)?;
        Ok(())
    }

    /// Batch link all packages to root - ultra-fast parallel operation
    pub fn batch_link_to_root(&self, packages: &[(String, String)]) -> Result<()> {
        packages.par_iter().for_each(|(name, version)| {
            if let Err(e) = self.link_to_root(name, version) {
                eprintln!("{} Failed to link {}@{}: {}", 
                    "✘".red().bold(), name, version, e);
            }
        });
        
        Ok(())
    }

    async fn download_to_cache(&self, pkg: &crate::core::resolver::ResolvedPackage) -> Result<PathBuf> {
        let name = &pkg.name;
        let version = &pkg.version;
        let download_path = self.cas.get_download_path(name, version);
        let partial_path = download_path.with_extension("tar.gz.part");

        if download_path.exists() {
            return Ok(download_path);
        }

        let mut start_pos = 0;
        if partial_path.exists() {
            if let Ok(meta) = fs::metadata(&partial_path) {
                start_pos = meta.len();
            }
        }

        let pb = self.multi.add(ProgressBar::new_spinner());
        pb.set_style(ProgressStyle::default_spinner()
            .template("{spinner:.magenta} {msg}")
            .unwrap());
        
        let msg = if start_pos > 0 {
            format!("Resuming download {}@{}...", name, version)
        } else {
            format!("Downloading {}@{}...", name, version)
        };
        pb.set_message(msg);
        pb.enable_steady_tick(std::time::Duration::from_millis(80));

        let mut stream = self.registry.download_tarball_stream(&pkg.metadata.dist.tarball, Some(start_pos)).await?;
        
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&partial_path)?;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk)?;
        }
        
        file.sync_all()?;
        fs::rename(&partial_path, &download_path)?;
        
        pb.finish_and_clear();
        Ok(download_path)
    }
}