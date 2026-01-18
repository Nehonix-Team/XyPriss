use crate::core::cas::Cas;
use crate::core::registry::RegistryClient;
use crate::core::extractor::StreamingExtractor;
use anyhow::Result;
use std::path::{Path, PathBuf};
use std::fs;
use colored::Colorize;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use futures_util::StreamExt;
use rayon::prelude::*;
use std::sync::Arc;
use dashmap::DashSet;

pub struct Installer {
    cas: Cas,
    registry: Arc<RegistryClient>,
    multi: MultiProgress,
    project_root: PathBuf,
    extracted_cache: Arc<DashSet<String>>, // Track extracted packages
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
        })
    }

    pub fn set_multi(&mut self, multi: MultiProgress) {
        self.multi = multi;
    }

    pub fn get_cas(&self) -> Arc<Cas> {
        Arc::new(self.cas.clone())
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
        
        // Process up to 50 extractions concurrently
        let mut buffer = Vec::with_capacity(50);
        while let Some(result) = tasks.next().await {
            buffer.push(result);
            
            if buffer.len() >= 50 {
                // Check results in batch
                for res in buffer.drain(..) {
                    res?;
                }
            }
        }
        
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
        
        let virtual_store_name = format!("{}@{}", name.replace('/', "+"), version);
        let virtual_store_root = self.cas.base_path.join("virtual_store").join(&virtual_store_name);
        let pkg_dir = virtual_store_root.join("node_modules").join(name);
        
        if pkg_dir.exists() {
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
            let metadata = self.registry.get_version_metadata(name, version).await?;
            let resp = self.registry.download_stream(&metadata.dist.tarball).await?
                .error_for_status()?;
            
            // DOWNLOAD FIRST: Load entire tarball into RAM (fast for most packages)
            // or we could stream to a temp file if needed, but RAM is fastest for modern machines
            let bytes = resp.bytes().await?;
            
            let cas_path = self.cas.base_path.clone();
            let name_owned = name.to_string();
            let version_owned = version.to_string();
            
            // Spawn blocking task for CPU-bound extraction
            tokio::task::spawn_blocking(move || {
                let cas = crate::core::cas::Cas::new(&cas_path)?;
                let extractor = StreamingExtractor::new(&cas);
                
                // Read from memory buffer (Cursor)
                let cursor = std::io::Cursor::new(bytes);
                
                // Ultra-fast: 1MB buffer for decompression (even though source is memory, GZip needs buffer)
                let buffered_reader = std::io::BufReader::with_capacity(1024 * 1024, cursor);
                let file_map = extractor.extract(buffered_reader)?;
                
                cas.store_index(&name_owned, &version_owned, &file_map)?;
                Ok::<_, anyhow::Error>(file_map)
            }).await??
        };

        self.link_files_to_dir(&pkg_dir, &file_map)?;
        self.extracted_cache.insert(cache_key);
        
        pb.finish_with_message(format!("{} Unpacked {}@{}", "✓".bold().green(), name, version));
        
        Ok(())
    }

    pub async fn link_package_deps(&self, pkg: &crate::core::resolver::ResolvedPackage) -> Result<()> {
        let name = &pkg.name;
        let version = &pkg.version;
        let virtual_store_name = format!("{}@{}", name.replace('/', "+"), version);
        let virtual_store_root = self.cas.base_path.join("virtual_store").join(&virtual_store_name);
        let deps_nm = virtual_store_root.join("node_modules");

        // Parallel dependency linking
        let dep_entries: Vec<_> = pkg.resolved_dependencies.iter().collect();
        
        dep_entries.par_iter().for_each(|(dep_name, dep_version)| {
            let dep_virtual_store_name = format!("{}@{}", dep_name.replace('/', "+"), dep_version);
            let target_link = deps_nm.join(dep_name);
            
            if let Some(parent) = target_link.parent() {
                let _ = fs::create_dir_all(parent);
            }
            
            // Clean existing symlink/file
            if target_link.exists() || target_link.is_symlink() {
                let _ = fs::remove_file(&target_link);
            }
            
            let dep_abs_target = self.cas.base_path
                .join("virtual_store")
                .join(&dep_virtual_store_name)
                .join("node_modules")
                .join(dep_name);
            
            // Calculate relative path for portability
            let rel_target = pathdiff::diff_paths(&dep_abs_target, target_link.parent().unwrap())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| dep_abs_target.to_string_lossy().to_string());
            
            #[cfg(unix)]
            {
                let _ = std::os::unix::fs::symlink(&rel_target, &target_link);
            }
            
            #[cfg(windows)]
            {
                let _ = std::os::windows::fs::symlink_dir(&rel_target, &target_link);
            }
        });
        
        // Run postinstall (async, don't block linking)
        let pkg_path = deps_nm.join(name);
        let name_owned = name.to_string();
        let version_owned = version.to_string();
        
        tokio::spawn(async move {
            if let Err(e) = Self::run_postinstall_static(&pkg_path, &name_owned, &version_owned).await {
                eprintln!("{} Postinstall failed for {}@{}: {}", 
                    "✘".red().bold(), name_owned, version_owned, e);
            }
        });
        
        Ok(())
    }

    fn link_files_to_dir(&self, dest_dir: &Path, index: &std::collections::HashMap<String, String>) -> Result<()> {
        // Pre-create destination directory
        if !dest_dir.exists() {
            fs::create_dir_all(dest_dir)?;
        }

        // Parallel parent directory creation
        let parent_dirs: std::collections::HashSet<_> = index.keys()
            .filter_map(|rel_path| {
                let normalized = rel_path.strip_prefix("package/").unwrap_or(rel_path);
                dest_dir.join(normalized).parent().map(|p| p.to_path_buf())
            })
            .collect();
        
        parent_dirs.par_iter().for_each(|parent| {
            let _ = fs::create_dir_all(parent);
        });

        // Ultra-fast parallel hard linking
        let entries: Vec<_> = index.iter().collect();
        
        entries.par_iter().for_each(|(rel_path, hash)| {
            let normalized_path = rel_path.strip_prefix("package/").unwrap_or(rel_path);
            let dest_path = dest_dir.join(normalized_path);
            let source_path = self.cas.get_file_path(hash);

            // Remove existing file
            if dest_path.exists() { 
                let _ = fs::remove_file(&dest_path); 
            }
            
            // Hard link for zero-copy installation
            let _ = fs::hard_link(&source_path, &dest_path);
        });

        Ok(())
    }

    async fn run_postinstall_static(pkg_dir: &Path, _name: &str, _version: &str) -> Result<()> {
        let pkg_json_path = pkg_dir.join("package.json");
        if !pkg_json_path.exists() { 
            return Ok(()); 
        }

        let content = fs::read_to_string(&pkg_json_path)?;
        let v: serde_json::Value = serde_json::from_str(&content)?;
        
        if let Some(postinstall) = v.get("scripts")
            .and_then(|s| s.get("postinstall"))
            .and_then(|p| p.as_str()) 
        {
            let mut child = tokio::process::Command::new("sh")
                .arg("-c")
                .arg(postinstall)
                .current_dir(pkg_dir)
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn()?;

            // 10 minute timeout
            let _ = tokio::time::timeout(
                std::time::Duration::from_secs(600), 
                child.wait()
            ).await;
        }
        
        Ok(())
    }

    async fn run_postinstall(&self, pkg_dir: &Path, name: &str, version: &str) -> Result<()> {
        Self::run_postinstall_static(pkg_dir, name, version).await
    }

    pub fn link_to_root(&self, name: &str, version: &str) -> Result<()> {
        let root_nm = self.project_root.join("node_modules").join(name);
        let virtual_store_name = format!("{}@{}", name.replace('/', "+"), version);
        
        let abs_target = self.cas.base_path
            .join("virtual_store")
            .join(&virtual_store_name)
            .join("node_modules")
            .join(name);
        
        let rel_target = pathdiff::diff_paths(&abs_target, root_nm.parent().unwrap())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| abs_target.to_string_lossy().to_string());

        // Ensure parent exists
        if let Some(parent) = root_nm.parent() {
            if !parent.exists() { 
                fs::create_dir_all(parent)?; 
            }
        }

        // Clean existing symlink/directory
        if root_nm.exists() || root_nm.is_symlink() {
            if root_nm.is_dir() && !root_nm.is_symlink() {
                let _ = fs::remove_dir_all(&root_nm);
            } else {
                let _ = fs::remove_file(&root_nm);
            }
        }

        #[cfg(unix)]
        std::os::unix::fs::symlink(&rel_target, &root_nm)?;
        
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&rel_target, &root_nm)?;
        
        // Link binaries
        let abs_pkg_dir = self.cas.base_path
            .join("virtual_store")
            .join(&virtual_store_name)
            .join("node_modules")
            .join(name);
        
        self.link_binaries(&abs_pkg_dir, root_nm.parent().unwrap(), &virtual_store_name)?;
        
        Ok(())
    }

    fn link_binaries(&self, pkg_dir: &Path, _nm_root: &Path, virtual_store_name: &str) -> Result<()> {
        let pkg_json_path = pkg_dir.join("package.json");
        if !pkg_json_path.exists() { 
            return Ok(()); 
        }

        let content = fs::read_to_string(&pkg_json_path)?;
        let v: serde_json::Value = serde_json::from_str(&content)?;
        
        let bin_dir = self.project_root.join("node_modules").join(".bin");
        if !bin_dir.exists() { 
            fs::create_dir_all(&bin_dir)?; 
        }

        if let Some(bin) = v.get("bin") {
            if let Some(bin_map) = bin.as_object() {
                // Parallel binary linking
                let entries: Vec<_> = bin_map.iter().collect();
                
                entries.par_iter().for_each(|(bin_name, bin_path_val)| {
                    if let Some(bin_rel_path) = bin_path_val.as_str() {
                        let _ = self.create_bin_link(bin_name, virtual_store_name, bin_rel_path, &bin_dir);
                    }
                });
            } else if let Some(bin_path) = bin.as_str() {
                if let Some(bin_name) = pkg_dir.file_name().and_then(|n| n.to_str()) {
                    self.create_bin_link(bin_name, virtual_store_name, bin_path, &bin_dir)?;
                }
            }
        }
        
        Ok(())
    }

    fn create_bin_link(&self, name: &str, virtual_store_name: &str, bin_path: &str, bin_dir: &Path) -> Result<()> {
        let dest = bin_dir.join(name);
        
        // Clean existing
        if dest.exists() || dest.is_symlink() { 
            let _ = fs::remove_file(&dest); 
        }
        
        let pkg_name = virtual_store_name
            .split('@')
            .next()
            .unwrap_or(virtual_store_name)
            .replace('+', "/");
        
        let abs_target = self.cas.base_path
            .join("virtual_store")
            .join(virtual_store_name)
            .join("node_modules")
            .join(&pkg_name)
            .join(bin_path);

        // Calculate relative path for portability
        let rel_target = pathdiff::diff_paths(&abs_target, bin_dir)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| abs_target.to_string_lossy().to_string());
        
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&rel_target, &dest)?;
            
            // Make executable
            if abs_target.exists() {
                use std::os::unix::fs::PermissionsExt;
                if let Ok(meta) = fs::metadata(&abs_target) {
                    let mut perms = meta.permissions();
                    perms.set_mode(0o755);
                    let _ = fs::set_permissions(&abs_target, perms);
                }
            }
        }
        
        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_file(&rel_target, &dest)?;
        }
        
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
}