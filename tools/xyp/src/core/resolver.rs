use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use anyhow::{Context, Result};
use crate::core::registry::RegistryClient;
use crate::core::registry::VersionMetadata;
use semver::{Version, VersionReq};
use std::sync::{Arc, Mutex};
use futures_util::stream::{FuturesUnordered, StreamExt};

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
    pub metadata: VersionMetadata,
}

use indicatif::{MultiProgress, ProgressBar, ProgressStyle};

pub struct Resolver {
    registry: Arc<RegistryClient>,
    resolved: Arc<Mutex<HashMap<String, ResolvedPackage>>>,
    visited: Arc<Mutex<HashSet<String>>>,
    multi: MultiProgress,
}

impl Resolver {
    pub fn new() -> Self {
        Self {
            registry: Arc::new(RegistryClient::new(None)),
            resolved: Arc::new(Mutex::new(HashMap::new())),
            visited: Arc::new(Mutex::new(HashSet::new())),
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
        pb.set_message("Resolving dependency tree...");
        pb.enable_steady_tick(std::time::Duration::from_millis(100));

        let mut queue = FuturesUnordered::new();

        {
            let mut visited = self.visited.lock().unwrap();
            for (name, req) in root_deps {
                let dep_key = format!("{}@{}", name, req);
                visited.insert(dep_key);
                queue.push(self.resolve_package(name.clone(), req.clone()));
            }
        }

        let mut resolved_count = 0;

        while let Some(result) = queue.next().await {
            let pkg = result?;
            
            // Store resolved package
            {
                let mut resolved = self.resolved.lock().unwrap();
                resolved.insert(pkg.name.clone(), pkg.clone());
            }

            resolved_count += 1;
            pb.set_message(format!("Resolved {} packages (latest: {}@{})", resolved_count, pkg.name, pkg.version));

            // Recursively resolve dependencies
            for (dep_name, dep_req) in &pkg.metadata.dependencies {
                let dep_key = format!("{}@{}", dep_name, dep_req);
                let should_resolve = {
                    let mut visited = self.visited.lock().unwrap();
                    if visited.contains(&dep_key) {
                        false
                    } else {
                        visited.insert(dep_key);
                        true
                    }
                };

                if should_resolve {
                    queue.push(self.resolve_package(dep_name.clone(), dep_req.clone()));
                }
            }
        }

        pb.finish_with_message(format!("Resolution complete. Found {} unique packages.", resolved_count));
        
        let resolved_map = self.resolved.lock().unwrap();
        Ok(resolved_map.values().cloned().collect())
    }

    async fn resolve_package(&self, name: String, req_str: String) -> Result<ResolvedPackage> {
        // Simple version picking: try to match semver or just take latest if it's "latest"
        let pkg_info = self.registry.fetch_package(&name).await?;
        
        let version = if req_str == "latest" || req_str == "*" {
            pkg_info.dist_tags.get("latest")
                .context(format!("No latest tag for {}", name))?
                .clone()
        } else {
            // Very basic semver matching
            let req = VersionReq::parse(&req_str).unwrap_or_else(|_| VersionReq::parse("*").unwrap());
            
            let mut versions: Vec<Version> = pkg_info.versions.keys()
                .filter_map(|v| Version::parse(v).ok())
                .collect();
            versions.sort();
            
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
            metadata,
        })
    }
}
