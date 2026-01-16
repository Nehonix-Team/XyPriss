use crate::core::cas::Cas;
use crate::core::registry::RegistryClient;
use crate::core::extractor::StreamingExtractor;
use anyhow::{Result, Context};
use std::path::Path;
use std::fs;
use colored::Colorize;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use futures_util::StreamExt;

use std::sync::Arc;

pub struct Installer {
    cas: Cas,
    registry: Arc<RegistryClient>,
    multi: MultiProgress,
    project_root: std::path::PathBuf,
}

impl Installer {
    pub fn new(cas_path: &Path, project_root: &Path, registry: Arc<RegistryClient>) -> Result<Self> {
        let abs_cas = if cas_path.is_absolute() { cas_path.to_path_buf() } else { project_root.join(cas_path) };
        Ok(Self {
            cas: Cas::new(&abs_cas)?,
            registry,
            multi: MultiProgress::new(),
            project_root: project_root.to_path_buf(),
        })
    }

    pub fn set_multi(&mut self, multi: MultiProgress) {
        self.multi = multi;
    }

    fn get_rel_prefix(&self, name: &str, extra: usize) -> String {
        let depth = name.split('/').count();
        "../".repeat(depth + extra)
    }

    pub async fn ensure_extracted(&self, pkg: &crate::core::resolver::ResolvedPackage) -> Result<()> {
        let name = &pkg.name;
        let version = &pkg.version;
        
        let virtual_store_name = format!("{}@{}", name.replace("/", "+"), version);
        let virtual_store_root = self.cas.base_path.join("virtual_store").join(&virtual_store_name);
        let pkg_dir = virtual_store_root.join("node_modules").join(name);
        
        if !pkg_dir.exists() {
            let pb = self.multi.add(ProgressBar::new_spinner());
            pb.set_style(ProgressStyle::default_spinner().template("{spinner:.cyan} {msg}").unwrap());
            pb.set_message(format!("Unpacking {}@{}...", name, version));
            pb.enable_steady_tick(std::time::Duration::from_millis(80));

            let file_map = if let Some(index) = self.cas.get_index(name, version)? {
                index
            } else {
                let metadata = self.registry.get_version_metadata(name, version).await?;
                let resp = self.registry.download_stream(&metadata.dist.tarball).await?.error_for_status()?;
                let stream = resp.bytes_stream().map(|item| item.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e)));
                let mut async_reader = tokio_util::io::StreamReader::new(stream);
                
                let cas_path = self.cas.base_path.clone();
                let name_owned = name.to_string();
                let version_owned = version.to_string();
                
                tokio::task::spawn_blocking(move || {
                     let cas = crate::core::cas::Cas::new(&cas_path).unwrap();
                     let extractor = StreamingExtractor::new(&cas);
                     
                     // Bridge AsyncRead to Read
                     let mut sync_reader = tokio_util::io::SyncIoBridge::new(&mut async_reader);
                     let file_map = extractor.extract(&mut sync_reader)?;
                     
                     cas.store_index(&name_owned, &version_owned, &file_map)?;
                     Ok::<_, anyhow::Error>(file_map)
                }).await??
            };

            self.link_files_to_dir(&pkg_dir, &file_map)?;
            pb.println(format!("{} Unpacked {}@{}", "✓".bold().green(), name, version));
            pb.finish_and_clear();
        }
        Ok(())
    }

    pub async fn link_package_deps(&self, pkg: &crate::core::resolver::ResolvedPackage) -> Result<()> {
        let name = &pkg.name;
        let version = &pkg.version;
        let virtual_store_name = format!("{}@{}", name.replace("/", "+"), version);
        let virtual_store_root = self.cas.base_path.join("virtual_store").join(&virtual_store_name);
        let deps_nm = virtual_store_root.join("node_modules");

        for (dep_name, dep_version) in &pkg.resolved_dependencies {
            let dep_virtual_store_name = format!("{}@{}", dep_name.replace("/", "+"), dep_version);
            let target_link = deps_nm.join(dep_name);
            
            if let Some(parent) = target_link.parent() {
                let _ = fs::create_dir_all(parent);
            }
            
            if target_link.exists() || target_link.is_symlink() {
                let _ = fs::remove_file(&target_link);
            }
            
            // DEP is at virtual_store/NAME@VER/node_modules/DEP
            // Root of virtual_store is at depth+2 from DEP
            let prefix = self.get_rel_prefix(dep_name, 2);
            let rel_target = format!("{}{}/node_modules/{}", prefix, dep_virtual_store_name, dep_name);
            
            #[cfg(unix)]
            let _ = std::os::unix::fs::symlink(&rel_target, &target_link);
        }
        
        if let Err(e) = self.run_postinstall(&deps_nm.join(name), name, version).await {
            let pb = self.multi.add(ProgressBar::new_spinner());
            pb.println(format!("{} Postinstall failed for {}@{} : {}", "✘".bold().red(), name, version, e));
            pb.finish_and_clear();
        }
        
        let pb = self.multi.add(ProgressBar::new_spinner());
        pb.println(format!("{} Linked {}@{}", "✓".bold().green(), name, version));
        pb.finish_and_clear();

        Ok(())
    }

    fn link_files_to_dir(&self, dest_dir: &Path, index: &std::collections::HashMap<String, String>) -> Result<()> {
        if !dest_dir.exists() {
            fs::create_dir_all(dest_dir)?;
        }

        for (rel_path, hash) in index {
            let normalized_path = if rel_path.starts_with("package/") { &rel_path[8..] } else { rel_path };
            let dest_path = dest_dir.join(normalized_path);
            let source_path = self.cas.get_file_path(hash);

            if let Some(parent) = dest_path.parent() {
                if !parent.exists() { fs::create_dir_all(parent)?; }
            }

            if dest_path.exists() { let _ = fs::remove_file(&dest_path); }
            fs::hard_link(&source_path, &dest_path)?;
        }
        Ok(())
    }

    async fn run_postinstall(&self, pkg_dir: &Path, _name: &str, _version: &str) -> Result<()> {
        let pkg_json_path = pkg_dir.join("package.json");
        if !pkg_json_path.exists() { return Ok(()); }

        let content = fs::read_to_string(&pkg_json_path)?;
        let v: serde_json::Value = serde_json::from_str(&content)?;
        
        if let Some(postinstall) = v.get("scripts").and_then(|s| s.get("postinstall")).and_then(|p| p.as_str()) {
            let mut child = tokio::process::Command::new("sh")
                .arg("-c")
                .arg(postinstall)
                .current_dir(pkg_dir)
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .spawn()?;

            let _ = tokio::time::timeout(std::time::Duration::from_secs(60), child.wait()).await;
        }
        Ok(())
    }

    pub fn link_to_root(&self, name: &str, version: &str) -> Result<()> {
        let root_nm = self.project_root.join("node_modules").join(name);
        let virtual_store_name = format!("{}@{}", name.replace("/", "+"), version);
        
        let prefix = self.get_rel_prefix(name, 0);
        let rel_target = format!("{}.xpm_storage/virtual_store/{}/node_modules/{}", prefix, virtual_store_name, name);

        if let Some(parent) = root_nm.parent() {
            if !parent.exists() { fs::create_dir_all(parent)?; }
        }

        if root_nm.exists() || root_nm.is_symlink() {
            if root_nm.is_dir() && !root_nm.is_symlink() {
                let _ = fs::remove_dir_all(&root_nm);
            } else {
                let _ = fs::remove_file(&root_nm);
            }
        }

        #[cfg(unix)]
        std::os::unix::fs::symlink(&rel_target, &root_nm)?;
        
        let abs_pkg_dir = self.cas.base_path.join("virtual_store").join(&virtual_store_name).join("node_modules").join(name);
        self.link_binaries(&abs_pkg_dir, root_nm.parent().unwrap(), &virtual_store_name)?;
        
        Ok(())
    }

    fn link_binaries(&self, pkg_dir: &Path, nm_root: &Path, virtual_store_name: &str) -> Result<()> {
        let pkg_json_path = pkg_dir.join("package.json");
        if !pkg_json_path.exists() { return Ok(()); }

        let content = fs::read_to_string(&pkg_json_path)?;
        let v: serde_json::Value = serde_json::from_str(&content)?;
        
        let bin_dir = self.project_root.join("node_modules").join(".bin");
        if !bin_dir.exists() { fs::create_dir_all(&bin_dir)?; }

        if let Some(bin) = v.get("bin") {
             if let Some(bin_map) = bin.as_object() {
                 for (bin_name, bin_path_val) in bin_map {
                     if let Some(bin_rel_path) = bin_path_val.as_str() {
                         self.create_bin_link(bin_name, virtual_store_name, bin_rel_path, &bin_dir)?;
                     }
                 }
             } else if let Some(bin_path) = bin.as_str() {
                 let bin_name = pkg_dir.file_name().unwrap().to_str().unwrap();
                 self.create_bin_link(bin_name, virtual_store_name, bin_path, &bin_dir)?;
             }
        }
        Ok(())
    }

    fn create_bin_link(&self, name: &str, virtual_store_name: &str, bin_path: &str, bin_dir: &Path) -> Result<()> {
        let dest = bin_dir.join(name);
        if dest.exists() || dest.is_symlink() { let _ = fs::remove_file(&dest); }
        
        // From node_modules/.bin/binary to project root is ../../
        // We need: ../../.xpm_storage/virtual_store/{V_NAME}/node_modules/{PKG_NAME}/{BIN_PATH}
        // PKG_NAME is virtual_store_name but with @version removed and + replaced by /
        let pkg_name = virtual_store_name.split('@').next().unwrap().replace('+', "/");
        let rel_target = format!(
            "../../.xpm_storage/virtual_store/{}/node_modules/{}/{}", 
            virtual_store_name, pkg_name, bin_path
        );
        
        #[cfg(unix)]
        {
            let _ = std::os::unix::fs::symlink(&rel_target, &dest);
            // Ensure target is executable
            let pkg_name = virtual_store_name.split('@').next().unwrap().replace('+', "/");
            let abs_path = self.cas.base_path.join("virtual_store").join(virtual_store_name).join("node_modules").join(pkg_name).join(bin_path);
            
            if abs_path.exists() {
                 use std::os::unix::fs::PermissionsExt;
                 if let Ok(meta) = fs::metadata(&abs_path) {
                     let mut perms = meta.permissions();
                     perms.set_mode(0o755);
                     let _ = fs::set_permissions(&abs_path, perms);
                 }
            }
        }
        Ok(())
    }
}
