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
}

impl PackageJson {
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let content = fs::read_to_string(path).context("Failed to read package.json")?;
        let pkg: PackageJson = serde_json::from_str(&content).context("Failed to parse package.json")?;
        Ok(pkg)
    }

    pub fn all_dependencies(&self) -> HashMap<String, String> {
        let mut all = HashMap::with_capacity(self.dependencies.len() + self.dev_dependencies.len());
        all.extend(self.dependencies.iter().map(|(k, v)| (k.clone(), v.clone())));
        all.extend(self.dev_dependencies.iter().map(|(k, v)| (k.clone(), v.clone())));
        all
    }
}

#[derive(Debug, Clone)]
pub struct ResolvedPackage {
    pub name: String,
    pub version: String,
    pub metadata: Arc<VersionMetadata>,
    pub resolved_dependencies: HashMap<String, String>,
}

pub struct Resolver {
    registry: Arc<RegistryClient>,
    cas: Option<Arc<crate::core::cas::Cas>>,
    resolved: DashMap<String, ResolvedPackage>,
    visited: DashSet<String>,
    resolution_cache: DashMap<String, String>,
    multi: MultiProgress,
    platform: Platform,
    concurrency: usize,
    eager_tx: parking_lot::Mutex<Option<tokio::sync::mpsc::Sender<ResolvedPackage>>>,
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
            visited: DashSet::new(),
            resolution_cache: DashMap::new(),
            multi: MultiProgress::new(),
            platform: Platform::current(),
            concurrency: 1000, // Increased from 500
            eager_tx: parking_lot::Mutex::new(None),
            version_cache: DashMap::new(),
        }
    }

    pub fn set_eager_tx(&self, tx: tokio::sync::mpsc::Sender<ResolvedPackage>) {
        *self.eager_tx.lock() = Some(tx);
    }

    pub fn set_concurrency(&mut self, n: usize) {
        self.concurrency = n;
    }

    pub fn clear_eager_tx(&self) {
        *self.eager_tx.lock() = None;
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

        // Parse requirement once
        let req = VersionReq::parse(req_str).ok()?;
        
        // Search resolved packages
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

    pub async fn resolve_tree(self: Arc<Self>, root_deps: &HashMap<String, String>) -> Result<Vec<ResolvedPackage>> {
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

            // Fill pipeline with tasks
            while active_tasks < max_concurrency && !queue.is_empty() {
                let (name, req, is_optional) = queue.pop_front().unwrap();
                
                // Fast path: Check if already resolved with exact version
                let cache_key = format!("{}@{}", name, req);
                if let Some(resolved_version) = self.resolution_cache.get(&cache_key) {
                    let version_key = format!("{}@{}", name, resolved_version.value());
                    if self.resolved.contains_key(&version_key) {
                        continue; // Skip already resolved
                    }
                }

                let resolver = Arc::clone(&self);
                let pb_clone = pb.clone();
                let name_clone = name.clone();
                let req_clone = req.clone();
                
                results.push(tokio::spawn(async move {
                    if rand::random::<f32>() < 0.3 {
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
                                self.resolved.insert(version_key.clone(), pkg.clone());
                                resolved_count += 1;
                                
                                pb.println(format!("   {} {} v{}", "+".bold().green(), pkg.name.bold(), pkg.version.cyan()));
                                 pb.set_position(resolved_count as u64);
                                 if resolved_count % 5 == 0 {
                                     pb.set_message(format!("{:04x}", rand::random::<u16>()));
                                 }

                                 // Eager extraction DISABLED for sequential phases
                                 // if let Some(ref tx) = *self.eager_tx.lock() {
                                 //    let _ = tx.try_send(pkg.clone());
                                 // }
                                
                                // Queue dependencies (batch)
                                let all_deps = pkg.metadata.get_all_deps();
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
        
        // Parallel dependency resolution pass
        let resolved_snapshot: Vec<_> = self.resolved.iter()
            .map(|kv| (kv.key().clone(), kv.value().clone()))
            .collect();
        
        // Build version lookup map (optimized)
        let mut by_name: HashMap<String, Vec<Version>> = HashMap::new();
        for (_, pkg) in &resolved_snapshot {
            if let Ok(v) = Version::parse(&pkg.version) {
                by_name.entry(pkg.name.clone()).or_insert_with(Vec::new).push(v);
            }
        }
        
        // Sort versions (descending)
        by_name.par_iter_mut().for_each(|(_, versions)| {
            versions.sort_unstable();
            versions.reverse();
        });
        
        let by_name = Arc::new(by_name);

        // Parallel dependency matching
        resolved_snapshot.into_par_iter().for_each(|(key, mut pkg)| {
            let mut resolved_deps = HashMap::new();
            let all_deps = pkg.metadata.get_all_deps();
            
            for (dep_name, dep_req, _) in all_deps {
                if let Ok(req) = VersionReq::parse(&dep_req) {
                    if let Some(versions) = by_name.get(&dep_name) {
                        if let Some(v) = versions.iter().find(|v| req.matches(v)) {
                            resolved_deps.insert(dep_name, v.to_string());
                        }
                    }
                }
            }
            
            pkg.resolved_dependencies = resolved_deps;
            self.resolved.insert(key, pkg);
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
                            return Ok(ResolvedPackage {
                                name: name.clone(), // Keep original name (alias)
                                version: real_req.clone(),
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

                return Ok(ResolvedPackage {
                    name, // Keep original name (alias)
                    version: real_req,
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

        Ok(ResolvedPackage {
            name,
            version,
            metadata: Arc::new(metadata),
            resolved_dependencies: HashMap::new(),
        })
    }
}