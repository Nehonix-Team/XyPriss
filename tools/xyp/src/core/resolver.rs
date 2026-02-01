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
use rayon::prelude::*;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PackageJson {
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub dependencies: HashMap<String, String>,
    #[serde(rename = "devDependencies", default)]
    pub dev_dependencies: HashMap<String, String>,
    #[serde(rename = "optionalDependencies", default)]
    pub optional_dependencies: HashMap<String, String>,
    #[serde(rename = "peerDependencies", default)]
    pub peer_dependencies: HashMap<String, String>,
}

impl PackageJson {
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let content = fs::read_to_string(path).context("Failed to read package.json")?;
        let pkg: PackageJson = serde_json::from_str(&content).context("Failed to parse package.json")?;
        Ok(pkg)
    }

    pub fn all_dependencies(&self) -> HashMap<String, String> {
        let mut all = HashMap::with_capacity(self.dependencies.len() + self.dev_dependencies.len() + self.optional_dependencies.len() + self.peer_dependencies.len());
        all.extend(self.dependencies.iter().map(|(k, v)| (k.clone(), v.clone())));
        all.extend(self.dev_dependencies.iter().map(|(k, v)| (k.clone(), v.clone())));
        all.extend(self.optional_dependencies.iter().map(|(k, v)| (k.clone(), v.clone())));
        all.extend(self.peer_dependencies.iter().map(|(k, v)| (k.clone(), v.clone())));
        all
    }
}

#[derive(Debug, Clone)]
pub struct ResolvedPackage {
    pub name: String,
    pub version: String,
    pub semver_version: Version, // Pre-parsed for speed
    pub metadata: Arc<VersionMetadata>,
    pub resolved_dependencies: HashMap<String, String>,
}

pub struct Resolver {
    registry: Arc<RegistryClient>,
    cas: Option<Arc<crate::core::cas::Cas>>,
    resolved: DashMap<String, Arc<ResolvedPackage>>,
    resolved_by_name: DashMap<String, Vec<Arc<ResolvedPackage>>>, // Index for O(1) lookup
    visited: DashSet<String>,
    resolution_cache: DashMap<String, String>,
    req_cache: DashMap<String, Arc<VersionReq>>, // Cache parsed requirements
    multi: MultiProgress,
    platform: Platform,
    concurrency: usize,
    eager_tx: parking_lot::Mutex<Option<tokio::sync::mpsc::Sender<Arc<ResolvedPackage>>>>,
    version_cache: DashMap<String, Arc<Vec<Version>>>, // Cache parsed versions
}

#[derive(Clone, Debug)]
pub struct Platform {
    pub os: String,
    pub arch: String,
    pub libc: String,
}

impl Platform {
    pub fn current() -> Self {
        let os = match std::env::consts::OS {
            "macos" => "darwin",
            "windows" => "win32",
            other => other,
        };
        let libc = if cfg!(target_env = "musl") { "musl" } else { "glibc" };
        
        Self {
            os: os.to_string(),
            arch: match std::env::consts::ARCH {
                "x86_64" => "x64",
                "aarch64" => "arm64",
                other => other,
            }.to_string(),
            libc: libc.to_string(),
        }
    }

    #[inline]
    fn matches_os(&self, pkg_os: &[String]) -> bool {
        pkg_os.is_empty() || pkg_os.iter().any(|os| {
            if let Some(negated) = os.strip_prefix('!') {
                negated != self.os
            } else {
                os == &self.os
            }
        })
    }

    #[inline]
    fn matches_arch(&self, pkg_cpu: &[String]) -> bool {
        pkg_cpu.is_empty() || pkg_cpu.iter().any(|cpu| {
            if let Some(negated) = cpu.strip_prefix('!') {
                negated != self.arch
            } else {
                cpu == &self.arch
            }
        })
    }

    #[inline]
    fn matches_libc(&self, pkg_name: &str, pkg_libc: &[String]) -> bool {
        if pkg_libc.is_empty() {
            // HEURISTIC: Many packages encode libc in the name
            if pkg_name.contains("-musl") && self.libc != "musl" {
                return false;
            }
            if pkg_name.contains("-gnu") && self.libc != "glibc" {
                return false;
            }
            return self.libc == "glibc" || self.os != "linux";
        }
        pkg_libc.contains(&self.libc)
    }

    #[inline]
    pub fn is_compatible(&self, metadata: &VersionMetadata) -> bool {
        let name = metadata.name.to_lowercase();
        
        // Strict platform check
        if !self.matches_os(&metadata.os) || !self.matches_arch(&metadata.cpu) || !self.matches_libc(&name, &metadata.libc) {
            return false;
        }

        // HEURISTIC: Bun/SWC specific name-based filtering
        
        // Final name-based double check for cross-platform safety
        if self.os == "linux" {
            if name.contains("android") || name.contains("darwin") || name.contains("win32") { return false; }
            if self.libc == "glibc" && name.contains("-musl") { return false; }
            if self.libc == "musl" && (name.contains("-gnu") || name.contains("-glibc")) { return false; }
        }

        true
    }
}

impl Resolver {
    pub fn new(registry: Arc<RegistryClient>) -> Self {
        Self {
            registry,
            cas: None,
            resolved: DashMap::new(),
            resolved_by_name: DashMap::new(),
            visited: DashSet::new(),
            resolution_cache: DashMap::new(),
            req_cache: DashMap::new(),
            multi: MultiProgress::new(),
            platform: Platform::current(),
            concurrency: 256, // Increased default concurrency
            eager_tx: parking_lot::Mutex::new(None),
            version_cache: DashMap::new(),
        }
    }

    pub fn set_eager_tx(&self, tx: tokio::sync::mpsc::Sender<Arc<ResolvedPackage>>) {
        *self.eager_tx.lock() = Some(tx);
    }

    pub fn get_resolved(&self) -> &DashMap<String, Arc<ResolvedPackage>> {
        &self.resolved
    }

    pub fn set_concurrency(&mut self, n: usize) {
        self.concurrency = n;
    }

    pub fn clear_eager_tx(&self) {
        *self.eager_tx.lock() = None;
    }

    fn parse_alias(&self, name: &str, req_str: &str) -> (String, String) {
        if let Some(stripped) = req_str.strip_prefix("npm:") {
            if let Some(at_idx) = stripped.rfind('@') {
                if at_idx > 0 {
                    return (stripped[..at_idx].to_string(), stripped[at_idx + 1..].to_string());
                }
            }
            return (stripped.to_string(), "latest".to_string());
        }
        (name.to_string(), req_str.to_string())
    }

    pub fn set_cas(&mut self, cas: Arc<crate::core::cas::Cas>) {
        self.cas = Some(cas);
    }

    pub fn set_multi(&mut self, multi: MultiProgress) {
        self.multi = multi;
    }

    #[inline]
    pub fn find_compatible_version(&self, name: &str, req_str: &str) -> Option<String> {
        // Check resolution cache first
        let cache_key = format!("{}@{}", name, req_str);
        if let Some(cached) = self.resolution_cache.get(&cache_key) {
            return Some(cached.clone());
        }

        // Get or parse requirement
        let req = if let Some(cached_req) = self.req_cache.get(req_str) {
            cached_req.clone()
        } else {
            let parsed = Arc::new(VersionReq::parse(req_str).ok()?);
            self.req_cache.insert(req_str.to_string(), parsed.clone());
            parsed
        };
        
        // Search resolved packages using index (O(V) where V is versions of THIS package, not all)
        if let Some(versions) = self.resolved_by_name.get(name) {
            for pkg in versions.value() {
                if req.matches(&pkg.semver_version) {
                    return Some(pkg.version.clone());
                }
            }
        }
        None
    }

    pub async fn resolve_tree(self: Arc<Self>, root_deps: &HashMap<String, String>) -> Result<Vec<Arc<ResolvedPackage>>> {
        let pb = self.multi.add(ProgressBar::new(1000)); // Initial guess, updates dynamically
        pb.set_style(
            ProgressStyle::default_spinner()
                .template("{spinner:.green} [NEURAL_LINK] Resolving: {pos} pkgs | {msg} [{bar:40.green/black}]")
                .unwrap()
                .progress_chars("10"),
        );
        pb.set_message("Starting neural link...");
        pb.enable_steady_tick(Duration::from_millis(50));
        
        let mut queue: VecDeque<(String, String, bool)> = VecDeque::with_capacity(root_deps.len() * 10);
        
        // Pre-allocate and add initial dependencies
        for (name, req) in root_deps {
            let dep_key = format!("{}@{}", name, req);
            if self.visited.insert(dep_key) {
                queue.push_back((name.clone(), req.clone(), false));
            }
        }

        let mut resolved_count = 0;
        let mut active_tasks = 0;
        let mut results = FuturesUnordered::new();
        // Batch processing loop
        loop {
            // DYNAMIC CONCURRENCY: Fetch current safe limit based on network performance
            let max_concurrency = self.registry.get_config().get_concurrency();
            pb.set_length((queue.len() + active_tasks + resolved_count) as u64);

            // Fill pipeline with tasks
            while !queue.is_empty() && active_tasks < max_concurrency {
                let (name, req, is_optional) = queue.pop_front().unwrap();
                
                // Fast path 1: Check if already resolved with exact version
                let cache_key = format!("{}@{}", name, req);
                if let Some(resolved_version) = self.resolution_cache.get(&cache_key) {
                    let version_key = format!("{}@{}", name, resolved_version.value());
                    if self.resolved.contains_key(&version_key) {
                        continue;
                    }
                }

                // Fast path 2: Check if metadata is in MEMORY or DISK cache
                // This allows resolving cached trees almost instantly even on slow networks
                if let Some(pkg) = self.registry.get_cached_package(&name).await {
                     match self.resolve_from_metadata(name.clone(), req.clone(), pkg).await {
                        Ok(resolved_pkg) => {
                            let version_key = format!("{}@{}", resolved_pkg.name, resolved_pkg.version);
                            if !self.resolved.contains_key(&version_key) {
                                let arc_pkg = Arc::new(resolved_pkg);
                                self.resolution_cache.insert(cache_key, arc_pkg.version.clone());
                                self.resolved.insert(version_key, arc_pkg.clone());
                                self.resolved_by_name.entry(arc_pkg.name.clone()).or_insert_with(Vec::new).push(arc_pkg.clone());
                                
                                resolved_count += 1;
                                pb.set_length((queue.len() + active_tasks + resolved_count) as u64);
                                if resolved_count % 10 == 0 {
                                    pb.set_position(resolved_count as u64);
                                    pb.set_message("CACHE_HIT_BURST");
                                }

                                if let Some(ref tx) = *self.eager_tx.lock() {
                                    let _ = tx.try_send(arc_pkg.clone());
                                }

                                for (dep_name, dep_req, is_optional_dep) in arc_pkg.metadata.get_all_deps() {
                                    let dep_key = format!("{}@{}", dep_name, dep_req);
                                    if self.visited.insert(dep_key) {
                                        queue.push_back((dep_name, dep_req, is_optional_dep));
                                    }
                                }
                            }
                            continue; // Proc²essed via cache hit
                        }
                        Err(_) => {} // Fallback to network
                     }
                }

                // Network path
                if active_tasks >= max_concurrency {
                    queue.push_front((name, req, is_optional));
                    break; 
                }

                let resolver = Arc::clone(&self);
                let pb_clone = pb.clone();
                let name_clone = name.clone();
                let req_clone = req.clone();
                
                results.push(tokio::spawn(async move {
                    if rand::random::<f32>() < 0.05 {
                        pb_clone.set_message(format!("{}@{}", name_clone.dimmed(), req_clone.cyan()));
                    }
                    let res = resolver.resolve_package_internal(name_clone.clone(), req_clone.clone()).await;
                    (name_clone, req_clone, is_optional, res)
                }));
                active_tasks += 1;
            }

            if active_tasks == 0 && queue.is_empty() {
                break;
            }

            // Process completed tasks
            if let Some(res) = results.next().await {
                active_tasks -= 1;
                
                match res {
                    Ok((name, req, is_optional, pkg_res)) => {
                        match pkg_res {
                            Ok(pkg) => {
                                let version_key = format!("{}@{}", pkg.name, pkg.version);
                                
                                // Double-check insertion for race conditions
                                if self.resolved.contains_key(&version_key) {
                                    self.resolution_cache.insert(format!("{}@{}", name, req), pkg.version.clone());
                                    continue;
                                }

                                // Platform check (optimized)
                                if !self.platform.is_compatible(&pkg.metadata) {
                                    if is_optional {
                                        pb.println(format!("   {} Skipped platform mismatch: {}", "[!] ".yellow(), pkg.name));
                                        continue;
                                    }
                                }

                                // Cache and store resolution
                                self.resolution_cache.insert(format!("{}@{}", name, req), pkg.version.clone());
                                let arc_pkg = Arc::new(pkg);
                                self.resolved.insert(version_key.clone(), arc_pkg.clone());
                                self.resolved_by_name.entry(arc_pkg.name.clone()).or_insert_with(Vec::new).push(arc_pkg.clone());
                                
                                resolved_count += 1;
                                
                                pb.println(format!("   {} {} v{}", "+".bold().green(), arc_pkg.name.bold(), arc_pkg.version.cyan()));
                                 pb.set_position(resolved_count as u64);
                                 if resolved_count % 10 == 0 {
                                     pb.set_message(format!("{:04x}", rand::random::<u16>()));
                                 }

                                 // Eager extraction for background processing
                                 if let Some(ref tx) = *self.eager_tx.lock() {
                                    let _ = tx.try_send(arc_pkg.clone());
                                 }
                                
                                // Queue dependencies (batch)
                                let all_deps = arc_pkg.metadata.get_all_deps();
                                for (dep_name, dep_req, is_optional_dep) in all_deps {
                                    let dep_key = format!("{}@{}", dep_name, dep_req);
                                    if self.visited.insert(dep_key) {
                                        queue.push_back((dep_name, dep_req, is_optional_dep));
                                    }
                                }
                            }
                            Err(e) => {
                                let err_msg = e.to_string();
                                if err_msg.contains("incompatible with platform") {
                                    pb.println(format!("   {} Skipped optional: {} ({})", "[!] ".yellow(), name.dimmed(), "platform mismatch"));
                                } else if !is_optional {
                                    pb.println(format!("   {} Failed: {}@{} - {}", 
                                        "[ERR]".red().bold(), name.bold(), req, err_msg.red()));
                                    pb.abandon();
                                    return Err(e);
                                } else {
                                    pb.println(format!("   {} Skipped optional: {}", "[!] ".yellow(), name.dimmed()));
                                }
                            }
                        }
                    }
                    Err(e) => {
                        pb.println(format!("   {} Task panic: {}", "[ERR]".red().bold(), e));
                    }
                }
            }
        }

        pb.finish_with_message(format!("{} Resolved {} packages", "[OK]".bold().green(), resolved_count));
        
        // Parallel dependency resolution pass (Optimized)
        let resolved_snapshot: Vec<(String, Arc<ResolvedPackage>)> = self.resolved.iter()
            .map(|kv| (kv.key().clone(), kv.value().clone()))
            .collect();
        
        let self_arc = Arc::clone(&self);
        resolved_snapshot.into_par_iter().for_each(|(key, pkg)| {
            let mut resolved_deps = HashMap::new();
            let mut pkg_mut = (*pkg).clone(); // Clone for modification
            
            for (dep_name, dep_req, _) in pkg.metadata.get_all_deps() {
                if let Some(version) = self_arc.find_compatible_version(&dep_name, &dep_req) {
                    resolved_deps.insert(dep_name, version);
                }
            }
            
            pkg_mut.resolved_dependencies = resolved_deps;
            self_arc.resolved.insert(key, Arc::new(pkg_mut));
        });
        
        pb.finish_and_clear();
        Ok(self.resolved.iter().map(|kv| kv.value().clone()).collect())
    }

    async fn resolve_package_internal(
        self: Arc<Self>,
        name: String, 
        req_str: String
    ) -> Result<ResolvedPackage> {
        let registry = &self.registry;
        let cas = &self.cas;
        let platform = &self.platform;
        // Handle npm aliases (pnpm/yarn/npm style: "alias": "npm:real-package@version")
        let (real_name, real_req) = if let Some(stripped) = req_str.strip_prefix("npm:") {
            if let Some(at_idx) = stripped.rfind('@') {
                if at_idx > 0 { // Not just the leading @ of a scoped package
                    (stripped[..at_idx].to_string(), stripped[at_idx + 1..].to_string())
                } else {
                    (stripped.to_string(), "latest".to_string())
                }
            } else {
                (stripped.to_string(), "latest".to_string())
            }
        } else {
            (name.clone(), req_str.clone())
        };

        // Fast path: CAS lookup for exact versions
        let is_exact = !real_req.is_empty() 
            && !real_req.contains(|c: char| c == '^' || c == '~' || c == '>' || c == '<' || c == '*')
            && real_req != "latest";

        if is_exact {
            if let Some(ref c) = cas {
                if let Ok(Some(cached_meta)) = c.get_metadata(&real_name, &real_req) {
                    if let Ok(metadata) = serde_json::from_value::<VersionMetadata>(cached_meta) {
                        if platform.is_compatible(&metadata) {
                            let semver_version = Version::parse(&real_req).unwrap_or_else(|_| Version::new(0,0,0));
                            return Ok(ResolvedPackage {
                                name: name.clone(), // Keep original name (alias)
                                version: real_req.clone(),
                                semver_version,
                                metadata: Arc::new(metadata),
                                resolved_dependencies: HashMap::new(),
                            });
                        }
                    }
                }
            }
        }

        // OPTIMIZATION: If we have an exact version, fetch just that version's metadata
        // This is much faster than fetching the whole package info for heavy packages
        if is_exact {
            if let Ok(metadata) = registry.get_version_metadata(&real_name, &real_req).await {
                 // Async CAS storage (fire and forget)
                if let Some(ref c) = cas {
                    if let Ok(val) = serde_json::to_value(&*metadata) {
                        let c = Arc::clone(c);
                        let n = real_name.clone();
                        let v = real_req.clone();
                        tokio::spawn(async move {
                            let _ = c.store_metadata(&n, &v, &val);
                        });
                    }
                }

                if !platform.is_compatible(&metadata) {
                    anyhow::bail!("Package {}@{} incompatible with platform", real_name, real_req);
                }

                let semver_version = Version::parse(&real_req).unwrap_or_else(|_| Version::new(0,0,0));
                return Ok(ResolvedPackage {
                    name, // Keep original name (alias)
                    version: real_req,
                    semver_version,
                    metadata,
                    resolved_dependencies: HashMap::new(),
                });
            }
        }

        // Fallback or Range: Fetch full package info
        let pkg_info = registry.fetch_package(&real_name).await
            .context(format!("Failed to fetch package metadata for {}", real_name))?;
        
        // Resolve version
        let version = if real_req == "latest" || real_req == "*" {
            pkg_info.dist_tags.get("latest")
                .cloned()
                .context(format!("No latest tag for {}", real_name))?
        } else {
            let req = VersionReq::parse(&real_req)
                .unwrap_or_else(|_| VersionReq::parse("*").unwrap());
            
            // Pre-parse and sort versions with cache
            let versions = if let Some(cached) = self.version_cache.get(&real_name) {
                cached.clone()
            } else {
                let mut v_list: Vec<Version> = pkg_info.versions.keys()
                    .filter_map(|v| Version::parse(v).ok())
                    .collect();
                v_list.sort_unstable();
                let arc_v = Arc::new(v_list);
                self.version_cache.insert(real_name.clone(), arc_v.clone());
                arc_v
            };
            
            if versions.is_empty() {
                anyhow::bail!("No valid versions found for {}", real_name);
            }
            
            versions.iter().rev()
                .find(|v| req.matches(v))
                .map(|v| v.to_string())
                .context(format!("No matching version found for {}@{}", real_name, real_req))?
        };

        let metadata = pkg_info.versions.get(&version)
            .cloned()
            .context(format!("Version {} not found in metadata for {}", version, real_name))?;

        // Platform compatibility check
        if !platform.is_compatible(&metadata) {
            anyhow::bail!("Package {}@{} incompatible with platform", real_name, version);
        }

        // Async CAS storage (fire and forget)
        if let Some(ref c) = cas {
            if let Ok(val) = serde_json::to_value(&metadata) {
                let c = Arc::clone(c);
                let n = real_name.clone();
                let v = version.clone();
                tokio::spawn(async move {
                    let _ = c.store_metadata(&n, &v, &val);
                });
            }
        }

        let semver_version = Version::parse(&version).unwrap_or_else(|_| Version::new(0,0,0));
        Ok(ResolvedPackage {
            name,
            version,
            semver_version,
            metadata: Arc::new(metadata),
            resolved_dependencies: HashMap::new(),
        })
    }

    async fn resolve_from_metadata(
        &self,
        name: String,
        req_str: String,
        pkg_info: Arc<crate::core::registry::RegistryPackage>
    ) -> Result<ResolvedPackage> {
        let (real_name, real_req) = self.parse_alias(&name, &req_str);

        let version = if real_req == "latest" || real_req == "*" {
            pkg_info.as_ref().dist_tags.get("latest")
                .cloned()
                .context(format!("No latest tag for {}", real_name))?
        } else {
            let req = VersionReq::parse(&real_req)
                .unwrap_or_else(|_| VersionReq::parse("*").unwrap());
            
            let versions = if let Some(cached) = self.version_cache.get(&real_name) {
                cached.clone()
            } else {
                let mut v_list: Vec<Version> = pkg_info.as_ref().versions.keys()
                    .filter_map(|v| Version::parse(v).ok())
                    .collect();
                v_list.sort_unstable();
                let arc_v = Arc::new(v_list);
                self.version_cache.insert(real_name.clone(), arc_v.clone());
                arc_v
            };
            
            versions.iter().rev()
                .find(|v| req.matches(v))
                .map(|v| v.to_string())
                .context(format!("No matching version found for {}@{}", real_name, real_req))?
        };

        let metadata = pkg_info.versions.get(&version)
            .cloned()
            .context(format!("Version {} not found in metadata for {}", version, real_name))?;

        if !self.platform.is_compatible(&metadata) {
            anyhow::bail!("Package {}@{} incompatible with platform", real_name, version);
        }

        let semver_version = Version::parse(&version).unwrap_or_else(|_| Version::new(0,0,0));
        Ok(ResolvedPackage {
            name,
            version,
            semver_version,
            metadata: Arc::new(metadata),
            resolved_dependencies: HashMap::new(),
        })
    }
}
