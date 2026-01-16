use crate::core::cas::Cas;
use crate::core::registry::RegistryClient;
use crate::core::extractor::StreamingExtractor;
use anyhow::{Result, Context};
use std::path::Path;
use std::fs;
use colored::Colorize;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use futures_util::StreamExt;

pub struct Installer {
    cas: Cas,
    registry: RegistryClient,
    multi: MultiProgress,
    project_root: std::path::PathBuf,
}

impl Installer {
    pub fn new(cas_path: &Path, project_root: &Path) -> Result<Self> {
        Ok(Self {
            cas: Cas::new(cas_path)?,
            registry: RegistryClient::new(None),
            multi: MultiProgress::new(),
            project_root: project_root.to_path_buf(),
        })
    }

    pub fn set_multi(&mut self, multi: MultiProgress) {
        self.multi = multi;
    }

    pub async fn install_package(&self, name: &str, version: &str) -> Result<()> {
        let pb = self.multi.add(ProgressBar::new_spinner());
        pb.set_style(
            ProgressStyle::default_spinner()
                .template("{spinner:.green} {msg}")
                .unwrap(),
        );
        pb.set_message(format!("Resolving {}@{}...", name, version));
        pb.enable_steady_tick(std::time::Duration::from_millis(100));

        // 1. Check if index already exists in CAS
        if let Some(index) = self.cas.get_index(name, version)? {
            pb.set_message(format!("Linking {}@{} (cached)...", name, version));
            self.link_package(name, version, &index)?;
            pb.finish_with_message(format!("{} {}@{} (cached)", "✓".green(), name, version));
            return Ok(());
        }

        // 2. Get version metadata
        let metadata = self.registry.get_version_metadata(name, version).await
            .context(format!("Failed to fetch metadata for {}@{}", name, version))?;

        // Double check with actual version from metadata
        if let Some(index) = self.cas.get_index(name, &metadata.version)? {
             pb.set_message(format!("Linking {}@{} (cached)...", name, metadata.version));
             self.link_package(name, &metadata.version, &index)?;
             pb.finish_with_message(format!("{} {}@{} (cached)", "✓".green(), name, metadata.version));
             return Ok(());
        }

        pb.set_message(format!("Downloading {}@{}...", name, metadata.version));
        
        // 3. Download tarball stream
        let resp = self.registry.download_stream(&metadata.dist.tarball).await?.error_for_status()?;
        let total_size = resp.content_length().unwrap_or(0);
        
        pb.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} {msg}")
                .unwrap()
                .progress_chars("#>-"),
        );
        pb.set_length(total_size);
        pb.set_message(format!("{}@{}", name, metadata.version));

        // Use a bridge to connect async stream to sync reader
        let stream = resp.bytes_stream().map(|res| res.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e)));
        let reader = tokio_util::io::StreamReader::new(stream);
        let mut progress_reader = pb.wrap_async_read(reader);
        
        // We need a sync wrapper for the extractor
        let mut bytes = Vec::new();
        tokio::io::copy(&mut progress_reader, &mut bytes).await?;
        
        pb.set_style(ProgressStyle::default_spinner().template("{spinner:.green} {msg}").unwrap());
        pb.set_message(format!("Extracting {}@{}...", name, metadata.version));

        // 4. Extract to CAS
        let extractor = StreamingExtractor::new(&self.cas);
        let file_map = extractor.extract(&bytes[..])?;

        // 5. Store index in CAS
        self.cas.store_index(name, &metadata.version, &file_map)?;

        pb.set_message(format!("Linking {}@{}...", name, metadata.version));

        // 6. Create hard links in node_modules
        self.link_package(name, &metadata.version, &file_map)?;
        
        pb.finish_with_message(format!("{} {}@{}", "✓".green(), name, metadata.version));
        
        Ok(())
    }

    fn link_package(&self, name: &str, _version: &str, index: &std::collections::HashMap<String, String>) -> Result<()> {
        // Find real node_modules path
        let nm_path = self.project_root.join("node_modules").join(name);
        
        // Ensure the directory for the package exists
        if !nm_path.exists() {
            fs::create_dir_all(&nm_path)
                .context(format!("Failed to create directory for package: {:?}", nm_path))?;
        }

        for (rel_path, hash) in index {
            // Strip "package/" prefix typical of npm tarballs
            let normalized_path = if rel_path.starts_with("package/") {
                &rel_path[8..]
            } else {
                rel_path
            };

            let dest_path = nm_path.join(normalized_path);
            let source_path = self.cas.get_file_path(hash);

            // Ensure parent directory of the file exists (for nested files in packages)
            if let Some(parent) = dest_path.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .context(format!("Failed to create parent directory: {:?}", parent))?;
                }
            }

            // Remove existing file if any (to avoid "File exists" errors on re-install)
            if dest_path.exists() {
                fs::remove_file(&dest_path)
                    .context(format!("Failed to remove existing file: {:?}", dest_path))?;
            }

            // Verification: Ensure source exists in CAS
            if !source_path.exists() {
                return Err(anyhow::anyhow!("CRITICAL: Source file missing in CAS: {} (hash: {})", source_path.display(), hash));
            }

            // Create Hard Link
            if let Err(e) = fs::hard_link(&source_path, &dest_path) {
                eprintln!("\n[{}] LINK ERROR: {} -> {}", name, source_path.display(), dest_path.display());
                return Err(anyhow::anyhow!(e).context(format!(
                    "Failed to create hard link from CAS to project.\nSource: {:?}\nDest: {:?}\nHash: {}",
                    source_path, dest_path, hash
                )));
            }
        }

        Ok(())
    }
}
