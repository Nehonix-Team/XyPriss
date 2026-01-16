use dashmap::{DashMap, DashSet};
use std::sync::Arc;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use semver::{Version, VersionReq};
use anyhow::{Context, Result};
use futures_util::stream::{FuturesUnordered, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
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
    pub resolved_dependencies: HashMap<String, String>, // name -> version
}

pub struct Resolver {
    registry: Arc<RegistryClient>,
    cas: Option<Arc<crate::core::cas::Cas>>,
    resolved: DashMap<String, ResolvedPackage>,
    visited: DashSet<String>,
    resolution_cache: DashMap<String, String>,
    multi: MultiProgress,
    platform: Platform,
}

#[derive(Clone, Debug)]
pub struct Platform {
    pub os: String,
    pub arch: String,
}

impl Platform {
    pub fn current() -> Self {
        Self {
            os: std::env::consts::OS.to_string(),
            arch: match std::env::consts::ARCH {
                "x86_64" => "x64".to_string(),
                "aarch64" => "arm64".to_string(),
                other => other.to_string(),
            },
        }
    }
}

impl Resolver {
    pub fn new(registry: Arc<RegistryClient>) -> Self {
        Self {
            registry,
            cas: None,
            resolved: DashMap::new(),
            visited: DashSet::new(),
            resolution_cache: DashMap::new(),
            multi: MultiProgress::new(),
            platform: Platform::current(),
        }
    }

    pub fn set_cas(&mut self, cas: Arc<crate::core::cas::Cas>) {
        self.cas = Some(cas);
    }

    pub fn set_multi(&mut self, multi: MultiProgress) {
        self.multi = multi;
    }

    fn is_platform_supported(&self, metadata: &VersionMetadata) -> bool {
        if !metadata.os.is_empty() && !metadata.os.contains(&self.platform.os) {
            return false;
        }
        if !metadata.cpu.is_empty() && !metadata.cpu.contains(&self.platform.arch) {
            return false;
        }
        true
    }

    pub fn find_compatible_version(&self, name: &str, req_str: &str) -> Option<String> {
        let req = VersionReq::parse(req_str).unwrap_or_else(|_| VersionReq::parse("*").unwrap());
        for entry in self.resolved.iter() {
            let pkg = entry.value();
            if pkg.name == name {
                if let Ok(v) = Version::parse(&pkg.version) {
                    if req.matches(&v) {
                        return Some(pkg.version.clone());
                    }
                }
            }
        }
        None
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
        
        let (tx, mut rx) = tokio::sync::mpsc::channel::<(String, String, bool)>(4096);
        let mut queue: VecDeque<(String, String, bool)> = VecDeque::new();
        
        // Initial dependencies
        for (name, req) in root_deps {
            let dep_key = format!("{}@{}", name, req);
            if self.visited.insert(dep_key) {
                queue.push_back((name.clone(), req.clone(), false));
            }
        }

        let mut resolved_count = 0;
        let mut active_tasks = 0;
        let mut results = FuturesUnordered::new();
        let max_concurrency = 100;

        loop {
            // Try to send tasks from the queue to the channel if there's capacity
            while active_tasks < max_concurrency && !queue.is_empty() {
                let (name, req, is_optional) = queue.pop_front().unwrap();
                let registry = self.registry.clone();
                let cas = self.cas.clone();
                results.push(tokio::spawn(async move {
                    (name.clone(), req.clone(), is_optional, Self::resolve_package_internal(registry, cas, name, req).await)
                }));
                active_tasks += 1;
            }

            if active_tasks == 0 && queue.is_empty() {
                break;
            }

            tokio::select! {
                Some(res) = results.next() => {
                    active_tasks -= 1;
                    if let Ok((name, req, is_optional, pkg_res)) = res {
                        match pkg_res {
                            Ok(pkg) => {
                                let version_key = format!("{}@{}", pkg.name, pkg.version);
                                if !self.resolved.contains_key(&version_key) {
                                    if !self.is_platform_supported(&pkg.metadata) {
                                        if is_optional { continue; }
                                        continue; 
                                    }

                                    self.resolution_cache.insert(format!("{}@{}", name, req), pkg.version.clone());
                                    self.resolved.insert(version_key.clone(), pkg.clone());
                                    resolved_count += 1;
                                    
                                    // Visual Feedback: Show in list format
                                    pb.println(format!("   {} {} v{}", "+".bold().green(), pkg.name.bold(), pkg.version.cyan()));
                                    pb.set_message(format!("Resolving dependencies... ({})", resolved_count));
                                    
                                    // Queue dependencies
                                    let all_deps = pkg.metadata.get_all_deps();
                                    for (dep_name, dep_req, is_optional_dep) in all_deps {
                                        let dep_key = format!("{}@{}", dep_name, dep_req);
                                        if self.visited.insert(dep_key) {
                                            queue.push_back((dep_name, dep_req, is_optional_dep));
                                        }
                                    }
                                } else {
                                     // Already resolved, just map version
                                     self.resolution_cache.insert(format!("{}@{}", name, req), pkg.version.clone());
                                }
                            }
                            Err(e) => {
                                if !is_optional {
                                    pb.abandon_with_message(format!("Failed to resolve {}@{}: {}", name, req, e));
                                    return Err(e);
                                }
                            }
                        }
                    }
                }
                Some((name, req, is_optional)) = rx.recv(), if active_tasks < max_concurrency => {
                    let registry = self.registry.clone();
                    let cas = self.cas.clone();
                    results.push(tokio::spawn(async move {
                        (name.clone(), req.clone(), is_optional, Self::resolve_package_internal(registry, cas, name, req).await)
                    }));
                    active_tasks += 1;
                }
            }
        }

        pb.finish_with_message(format!("Resolution complete. Found {} unique package versions.", resolved_count));
        
        // Snapshot logic to avoid Deadlock during iteration
        let resolved_snapshot: Vec<ResolvedPackage> = self.resolved.iter().map(|kv| kv.value().clone()).collect();

        // Final pass: Match every dependency requirement to a resolved version
        for mut kv in self.resolved.iter_mut() {
            let pkg = kv.value_mut();
            let mut resolved_deps = HashMap::new();
            let all_deps = pkg.metadata.get_all_deps();
            
            for (dep_name, dep_req, _) in all_deps {
                // Find compatible version using the snapshot (no locks)
                let req = VersionReq::parse(&dep_req).unwrap_or_else(|_| VersionReq::parse("*").unwrap());
                for candidate in &resolved_snapshot {
                    if candidate.name == dep_name {
                        if let Ok(v) = Version::parse(&candidate.version) {
                            if req.matches(&v) {
                                resolved_deps.insert(dep_name.clone(), candidate.version.clone());
                                break; // Take the first matching one (usually latest due to sort order or random)
                            }
                        }
                    }
                }
            }
            pkg.resolved_dependencies = resolved_deps;
        }
        
        Ok(self.resolved.iter().map(|kv| kv.value().clone()).collect())
    }

    async fn resolve_package_internal(
        registry: Arc<RegistryClient>, 
        cas: Option<Arc<crate::core::cas::Cas>>,
        name: String, 
        req_str: String
    ) -> Result<ResolvedPackage> {
        // 1. Try CAS metadata first if it's an exact version
        let is_exact = !req_str.is_empty() && req_str != "latest" && req_str != "*" && 
             !req_str.contains(|c| c == '^' || c == '~' || c == '>' || c == '<' || c == '*');

        if is_exact {
             if let Some(ref c) = cas {
                 if let Ok(Some(cached_meta)) = c.get_metadata(&name, &req_str) {
                      if let Ok(metadata) = serde_json::from_value::<crate::core::registry::VersionMetadata>(cached_meta) {
                          return Ok(ResolvedPackage {
                              name: name.clone(),
                              version: req_str.clone(),
                              metadata: Arc::new(metadata),
                              resolved_dependencies: HashMap::new(),
                          });
                      }
                 }
             }
        }

        // 2. Fetch from registry
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
                .context(format!("No matching version found for {}@{}", name, req_str))?
        };

        let metadata = pkg_info.versions.get(&version)
            .context(format!("Version {} not found in metadata for {}", version, name))?
            .clone();

        // 3. Store in CAS for future usage if we have it
        if let Some(ref c) = cas {
            if let Ok(val) = serde_json::to_value(&metadata) {
                let _ = c.store_metadata(&name, &version, &val);
            }
        }

        Ok(ResolvedPackage {
            name,
            version,
            metadata: Arc::new(metadata),
            resolved_dependencies: HashMap::new(),
        })
    }
}
