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
pub struct PnpmConfig {
    #[serde(default)]
    pub overrides: HashMap<String, String>,
    #[serde(default)]
    pub resolutions: HashMap<String, String>, // Sometimes used as alias
    #[serde(rename = "onlyBuiltDependencies", default)]
    pub only_built_dependencies: Vec<String>,
    #[serde(rename = "patchedDependencies", default)]
    pub patched_dependencies: HashMap<String, String>,
}

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
    #[serde(default)]
    pub pnpm: Option<PnpmConfig>,
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
    catalogs: HashMap<String, HashMap<String, String>>, // Pnpm catalogs: catalog_name -> (pkg_name -> version)
    overrides: HashMap<String, String>, // Forced versions from root package.json
    update: bool,
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
            catalogs: HashMap::new(),
            overrides: HashMap::new(),
            update: false,
        }
    }

    pub fn set_overrides(&mut self, overrides: HashMap<String, String>) {
        self.overrides = overrides;
    }

    pub fn set_update(&mut self, update: bool) {
        self.update = update;
    }

    pub fn set_eager_tx(&self, tx: tokio::sync::mpsc::Sender<Arc<ResolvedPackage>>) {
        *self.eager_tx.lock() = Some(tx);
    }

    pub fn set_concurrency(&mut self, n: usize) {
        self.concurrency = n;
    }

    pub fn clear_eager_tx(&self) {
        *self.eager_tx.lock() = None;
    }

    pub fn load_catalogs(&mut self, start_path: &Path) {
        let mut curr = Some(start_path);
        let mut workspace_yaml = None;

        while let Some(path) = curr {
            let candidate = path.join("pnpm-workspace.yaml");
            if candidate.exists() {
                workspace_yaml = Some(candidate);
                break;
            }
            curr = path.parent();
        }

        let workspace_yaml = match workspace_yaml {
            Some(y) => y,
            None => {
                let _ = fs::write("xfpm-debug.log", format!("[DEBUG] No pnpm-workspace.yaml found starting from {:?}", start_path));
                return;
            }
        };

        if let Ok(content) = fs::read_to_string(&workspace_yaml) {
            let mut log = format!("[DEBUG] Loading catalog from {:?}\n", workspace_yaml);
            let mut current_catalog = String::new();
            let mut mode = 0; // 0=none, 1=catalog, 2=catalogs

            for line in content.lines() {
                let trimmed = line.trim();
                let indent = line.chars().take_while(|c| c.is_whitespace()).count();
                if trimmed.is_empty() || trimmed.starts_with('#') { continue; }

                let name_part = if let Some(idx) = trimmed.find('#') {
                    trimmed[..idx].trim()
                } else {
                    trimmed
                };

                if indent == 0 {
                    if name_part == "catalog:" {
                        mode = 1;
                        current_catalog = "default".to_string();
                    } else if name_part == "catalogs:" {
                        mode = 2;
                    } else {
                        mode = 0;
                    }
                    continue;
                }

                if mode == 1 && indent > 0 {
                    if let Some((pkg, ver)) = self.parse_yaml_kv(name_part) {
                        log.push_str(&format!("[DEBUG] Identified (default): {} -> {}\n", pkg, ver));
                        self.catalogs.entry("default".to_string()).or_default().insert(pkg, ver);
                    }
                } else if mode == 2 && indent > 0 {
                    if name_part.ends_with(':') {
                        current_catalog = name_part[..name_part.len()-1].trim().trim_matches('\'').trim_matches('"').to_string();
                    } else {
                        if let Some((pkg, ver)) = self.parse_yaml_kv(name_part) {
                            log.push_str(&format!("[DEBUG] Identified ({}): {} -> {}\n", current_catalog, pkg, ver));
                            self.catalogs.entry(current_catalog.clone()).or_default().insert(pkg.clone(), ver);
                        }
                    }
                }
            }
            let _ = fs::write("xfpm-debug.log", log);
        }
    }

    fn parse_yaml_kv(&self, line: &str) -> Option<(String, String)> {
        let line = line.trim();
        if let Some(idx) = line.find(':') {
            let key = line[..idx].trim().trim_matches('\'').trim_matches('"').to_string();
            let val = line[idx+1..].trim().trim_matches('\'').trim_matches('"').to_string();
            if !key.is_empty() && !val.is_empty() {
                return Some((key, val));
            }
        }
        None
    }

    fn parse_alias(&self, name: &str, req_str: &str) -> (String, String) {
        let mut current_name = name.to_string();
        let mut current_req = req_str.to_string();

        // 1. Apply overrides if any (Top-level only for now)
        if let Some(overridden) = self.overrides.get(&current_name) {
            current_req = overridden.clone();
        }

        // 2. Resolve catalogs recursively
        while current_req.starts_with("catalog:") {
            let catalog_name = if current_req == "catalog:" { "default" } else { &current_req[8..] };
            if let Some(catalog) = self.catalogs.get(catalog_name) {
                if let Some(version) = catalog.get(&current_name) {
                    current_req = version.clone();
                } else {
                    break; // Catalog found but entry missing, stop resolving catalog
                }
            } else {
                break; // Catalog not found, stop resolving catalog
            }
        }

        // 3. Handle npm: aliases
        if let Some(stripped) = current_req.strip_prefix("npm:") {
            if let Some(at_idx) = stripped.rfind('@') {
                if at_idx > 0 {
                    current_name = stripped[..at_idx].to_string();
                    current_req = stripped[at_idx + 1..].to_string();
                } else {
                    current_name = stripped.to_string();
                    current_req = "latest".to_string();
                }
            } else {
                current_name = stripped.to_string();
                current_req = "latest".to_string();
            }
        }

        // 4. Handle workspace:* (Normalize to latest for the registry if needed, 
        // though usually these are skipped in monorepos)
        if current_req.starts_with("workspace:") {
            current_req = "latest".to_string();
        }

        (current_name, current_req)
    }

    pub fn set_cas(&mut self, cas: Arc<crate::core::cas::Cas>) {
        self.cas = Some(cas);
    }

    pub fn set_multi(&mut self, multi: MultiProgress) {
        self.multi = multi;
    }

    #[inline]
    pub fn find_compatible_version(&self, name: &str, req_str: &str) -> Option<String> {
        // 1. Check resolution cache first
        let cache_key = format!("{}@{}", name, req_str);
        if let Some(cached) = self.resolution_cache.get(&cache_key) {
            return Some(cached.clone());
        }

        // 1b. Fallback for "latest" or "*"
        if req_str == "latest" || req_str == "*" {
            if let Some(versions) = self.resolved_by_name.get(name) {
                let mut v_list: Vec<Version> = versions.value().iter()
                    .map(|p| p.semver_version.clone())
                    .collect();
                v_list.sort_unstable();
                return v_list.last().map(|v| v.to_string());
            }
        }

        // 2. Search resolved packages using index
        if let Some(versions) = self.resolved_by_name.get(name) {
             for pkg in versions.value() {
                 if Self::satisfies_npm_range(req_str, &pkg.semver_version) {
                     return Some(pkg.version.clone());
                 }
             }
        }
        None
    }

    fn satisfies_npm_range(req_str: &str, version: &Version) -> bool {
        // 1. Handle || (OR)
        if req_str.contains("||") {
            for part in req_str.split("||") {
                if Self::satisfies_npm_range(part.trim(), version) { return true; }
            }
            return false;
        }

        // 2. Handle Hyphen Ranges: "1.2.3 - 2.3.4" -> ">=1.2.3,<=2.3.4"
        // This is a simplified implementation of NPM hyphen ranges
        if req_str.contains(" - ") {
            let parts: Vec<&str> = req_str.split(" - ").collect();
            if parts.len() == 2 {
                let start = parts[0].trim();
                let end = parts[1].trim();
                // We convert to a standard AND range
                let new_req = format!(">={},<={}", start, end);
                return Self::satisfies_npm_range(&new_req, version);
            }
        }

        // 3. Normalize: remove spaces after operators
        let mut normalized = req_str.to_string();
        for op in &[">=", "<=", ">", "<", "^", "~", "="] {
            let from = format!("{} ", op);
            normalized = normalized.replace(&from, op);
        }

        // 4. Handle spaces (AND) - convert to commas for Rust's semver crate
        let parts: Vec<&str> = normalized.split_whitespace().collect();
        let unified = parts.join(",");
        
        VersionReq::parse(&unified).map(|r| r.matches(version)).unwrap_or_else(|_| {
            // Last resort: try original string
             VersionReq::parse(req_str).map(|r| r.matches(version)).unwrap_or(false)
        })
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
            if req.starts_with("workspace:") {
                continue;
            }
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
                if !self.update {
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
                                        if dep_req.starts_with("workspace:") { continue; }
                                        let dep_key = format!("{}@{}", dep_name, dep_req);
                                        if self.visited.insert(dep_key) {
                                            queue.push_back((dep_name, dep_req, is_optional_dep));
                                        }
                                    }
                                }
                                continue; // Processed via cache hit
                            }
                            Err(_) => {} // Fallback to network
                         }
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
                                        pb.println(format!("   {} Skipped PlatM: {}", "[!] ".yellow(), pkg.name)); // platform mismatch = PlatM
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
                                    if dep_req.starts_with("workspace:") { continue; }
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
        
        // Use unified alias parsing (handles catalog:, npm:, workspace:, etc.)
        let (real_name, real_req) = self.parse_alias(&name, &req_str);

        // Fast path: CAS lookup for exact versions
        let is_exact = !real_req.is_empty() 
            && !real_req.contains(|c: char| c == '^' || c == '~' || c == '>' || c == '<' || c == '*')
            && real_req != "latest";

        if is_exact && !self.update {
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
        let pkg_info = registry.fetch_package(&real_name, self.update).await
            .context(format!("Failed to fetch package metadata for {}", real_name))?;
        
        // Resolve version
        let version = if real_req == "latest" || real_req == "*" {
            pkg_info.dist_tags.get("latest")
                .cloned()
                .context(format!("No latest tag for {}", real_name))?
        } else {
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
                .find(|v| Self::satisfies_npm_range(&real_req, v))
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
                .find(|v| Self::satisfies_npm_range(&real_req, v))
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
