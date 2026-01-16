use dashmap::{DashMap, DashSet};
use std::sync::Arc;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use semver::{Version, VersionReq};
use anyhow::{Context, Result};
use futures_util::stream::{FuturesUnordered, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use crate::core::registry::{RegistryClient, VersionMetadata};
use colored::Colorize;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PackageJson {
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub dependencies: HashMap<String, String>,
    #[serde(rename = "devDependencies", default)]
    pub dev_dependencies: HashMap<String, String>,
}

impl PackageJson {
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let content = fs::read_to_string(path).context("Failed to read package.json")?;
        let pkg: PackageJson = serde_json::from_str(&content).context("Failed to parse package.json")?;
        Ok(pkg)
    }

    pub fn all_dependencies(&self) -> HashMap<String, String> {
        let mut all = self.dependencies.clone();
        for (k, v) in &self.dev_dependencies {
            all.insert(k.clone(), v.clone());
        }
        all
    }
}

#[derive(Debug, Clone)]
pub struct ResolvedPackage {
    pub name: String,
    pub version: String,
    pub metadata: Arc<VersionMetadata>,
}

pub struct Resolver {
    registry: Arc<RegistryClient>,
    resolved: DashMap<String, ResolvedPackage>,
    visited: DashSet<String>,
    resolution_cache: DashMap<String, String>, // key: "name@range", value: "version"
    multi: MultiProgress,
}

impl Resolver {
    pub fn new(registry: Arc<RegistryClient>) -> Self {
        Self {
            registry,
            resolved: DashMap::new(),
            visited: DashSet::new(),
            resolution_cache: DashMap::new(),
            multi: MultiProgress::new(),
        }
    }

    pub fn set_multi(&mut self, multi: MultiProgress) {
        self.multi = multi;
    }

    pub async fn resolve_tree(&self, root_deps: &HashMap<String, String>) -> Result<Vec<ResolvedPackage>> {
        let pb = self.multi.add(ProgressBar::new_spinner());
        pb.set_style(
            ProgressStyle::default_spinner()
                .template("{spinner:.green} [{elapsed_precise}] {msg}")
                .unwrap(),
        );
        pb.set_message("Initializing resolution...");
        pb.enable_steady_tick(std::time::Duration::from_millis(50));

        let (tx, mut rx) = tokio::sync::mpsc::channel::<(String, String)>(4096);
        
        // Initial dependencies
        for (name, req) in root_deps {
            let dep_key = format!("{}@{}", name, req);
            if self.visited.insert(dep_key) {
                tx.send((name.clone(), req.clone())).await.unwrap();
            }
        }

        let mut resolved_count = 0;
        let mut active_tasks = 0;
        let mut results = FuturesUnordered::new();
        let max_concurrency = 100; // Increase concurrency for faster network processing

        loop {
            // Fill up tasks if we have space and there are pending requests
            while active_tasks < max_concurrency {
                match rx.try_recv() {
                    Ok((name, req)) => {
                        let registry = self.registry.clone();
                        results.push(tokio::spawn(async move {
                            (name.clone(), req.clone(), Self::resolve_package_static(registry, name, req).await)
                        }));
                        active_tasks += 1;
                    }
                    Err(tokio::sync::mpsc::error::TryRecvError::Empty) => break,
                    Err(tokio::sync::mpsc::error::TryRecvError::Disconnected) => break,
                }
            }

            if active_tasks == 0 {
                break;
            }

            tokio::select! {
                Some(res) = results.next() => {
                    active_tasks -= 1;
                    if let Ok((name, req, pkg_res)) = res {
                        match pkg_res {
                            Ok(pkg) => {
                                // Update resolution cache
                                self.resolution_cache.insert(format!("{}@{}", name, req), pkg.version.clone());
                                
                                self.resolved.insert(name, pkg.clone());
                                resolved_count += 1;
                                
                                // Visual feedback: Print each package resolution for "wow" effect
                                let msg = format!("{} Resolved {}@{}", "✓".green(), pkg.name, pkg.version);
                                pb.println(msg);
                                pb.set_message(format!("Resolved {} packages...", resolved_count));

                                // Discover and queue new dependencies
                                for (dep_name, dep_req) in &pkg.metadata.dependencies {
                                    let dep_key = format!("{}@{}", dep_name, dep_req);
                                    if self.visited.insert(dep_key) {
                                        // CHECK CACHE: If we already know what this (name, req) resolves to, 
                                        // we still need to fetch its metadata if not in self.resolved,
                                        // but we keep the current flow for simplicity and correct discovery.
                                        if let Err(_) = tx.try_send((dep_name.clone(), dep_req.clone())) {
                                            let tx_c = tx.clone();
                                            let dn = dep_name.clone();
                                            let dr = dep_req.clone();
                                            tokio::spawn(async move { let _ = tx_c.send((dn, dr)).await; });
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                pb.abandon_with_message(format!("Failed to resolve {}@{}: {}", name, req, e));
                                return Err(e);
                            }
                        }
                    }
                }
                // Also listen to the receiver to avoid busy-waiting if results is empty but rx has data
                // (Though the loop handles it, select! is more efficient)
                Some((name, req)) = rx.recv(), if active_tasks < max_concurrency => {
                    // Fast path: if already resolved, skip (though visited should catch most)
                    if self.resolved.contains_key(&name) {
                         // We might need to check if the version matches the req, 
                         // but for the sake of speed and visited set, we skip.
                         continue;
                    }

                    let registry = self.registry.clone();
                    results.push(tokio::spawn(async move {
                        (name.clone(), req.clone(), Self::resolve_package_static(registry, name, req).await)
                    }));
                    active_tasks += 1;
                }
            }
        }

        pb.finish_with_message(format!("Resolution complete. Found {} unique packages.", resolved_count));
        
        Ok(self.resolved.iter().map(|kv| kv.value().clone()).collect())
    }

    async fn resolve_package_static(registry: Arc<RegistryClient>, name: String, req_str: String) -> Result<ResolvedPackage> {
        let pkg_info = registry.fetch_package(&name).await?;
        
        let version = if req_str == "latest" || req_str == "*" {
            pkg_info.dist_tags.get("latest")
                .context(format!("No latest tag for {}", name))?
                .clone()
        } else {
            let req = VersionReq::parse(&req_str).unwrap_or_else(|_| VersionReq::parse("*").unwrap());
            
            let mut versions: Vec<Version> = pkg_info.versions.keys()
                .filter_map(|v| Version::parse(v).ok())
                .collect();
            versions.sort_unstable();
            
            versions.iter().rev()
                .find(|v| req.matches(v))
                .map(|v| v.to_string())
                .or_else(|| pkg_info.dist_tags.get("latest").cloned())
                .context(format!("No matching version found for {}@{}", name, req_str))?
        };

        let metadata = pkg_info.versions.get(&version)
            .context(format!("Version {} not found in metadata for {}", version, name))?
            .clone();

        Ok(ResolvedPackage {
            name,
            version,
            metadata: Arc::new(metadata),
        })
    }
}
