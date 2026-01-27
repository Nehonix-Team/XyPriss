use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use anyhow::Result;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::broadcast;
use futures_util::StreamExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct RegistryPackage {
    pub name: String,
    #[serde(rename = "dist-tags")]
    pub dist_tags: HashMap<String, String>,
    pub versions: HashMap<String, VersionMetadata>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionMetadata {
    pub name: String,
    pub version: String,
    pub dist: Dist,
    #[serde(default)]
    pub dependencies: HashMap<String, String>,
    #[serde(rename = "peerDependencies", default)]
    pub peer_dependencies: HashMap<String, String>,
    #[serde(rename = "optionalDependencies", default)]
    pub optional_dependencies: HashMap<String, String>,
    #[serde(default)]
    pub os: Vec<String>,
    #[serde(default)]
    pub cpu: Vec<String>,
    #[serde(default)]
    pub libc: Vec<String>,
}

impl VersionMetadata {
    pub fn get_all_deps(&self) -> Vec<(String, String, bool)> {
        let mut all = Vec::new();
        for (k, v) in &self.dependencies {
            all.push((k.clone(), v.clone(), false));
        }
        for (k, v) in &self.optional_dependencies {
            all.push((k.clone(), v.clone(), true));
        }
        for (k, v) in &self.peer_dependencies {
            // Peer deps are usually required by the parent, treat as non-optional for now
            all.push((k.clone(), v.clone(), false));
        }
        all
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Dist {
    pub tarball: String,
    pub shasum: String,
    pub integrity: Option<String>,
    #[serde(rename = "unpackedSize", default)]
    pub unpacked_size: u64,
    #[serde(rename = "fileCount", default)]
    pub file_count: u64,
}

pub struct RegistryClient {
    client: reqwest::Client,
    base_url: String,
    retries: u32,
    package_cache: moka::future::Cache<String, Arc<RegistryPackage>>,
    inflight: DashMap<String, broadcast::Sender<Arc<RegistryPackage>>>,
    semaphore: Arc<tokio::sync::Semaphore>,
    cache_dir: Option<std::path::PathBuf>,
    config: crate::core::config::GlobalConfig,
}

impl RegistryClient {
    pub fn new(base_url: Option<String>, retries: u32) -> Self {
        let config = Arc::new(crate::core::config::DynamicConfig::new());
        
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "Accept",
            "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8".parse().unwrap()
        );

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .user_agent("XyPriss/1.0 (Advanced Agentic Coding; +https://github.com/Nehonix-Team/XyPriss)")
            .connect_timeout(std::time::Duration::from_secs(5))
            .pool_idle_timeout(std::time::Duration::from_secs(60))
            .pool_max_idle_per_host(32) 
            .tcp_keepalive(Some(std::time::Duration::from_secs(30)))
            .tcp_nodelay(true)
            .build()
            .unwrap_or_default();

        Self {
            client,
            base_url: base_url.unwrap_or_else(|| "https://registry.npmjs.org".to_string()),
            retries,
            package_cache: moka::future::Cache::builder()
                .max_capacity(10000)
                .time_to_live(std::time::Duration::from_secs(7200))
                .build(),
            inflight: DashMap::new(),
            semaphore: Arc::new(tokio::sync::Semaphore::new(128)), // High limit, governed by DynamicConfig
            cache_dir: None,
            config,
        }
    }

    pub fn set_config(&mut self, config: crate::core::config::GlobalConfig) {
        self.config = config;
    }

    pub fn get_config(&self) -> crate::core::config::GlobalConfig {
        self.config.clone()
    }

    pub fn set_cache_dir(&mut self, path: std::path::PathBuf) {
        let metadata_dir = path.join("metadata");
        let _ = std::fs::create_dir_all(&metadata_dir);
        self.cache_dir = Some(metadata_dir);
    }

    async fn request_with_retry(&self, url: &str, is_metadata: bool, is_abbreviated: bool) -> Result<Vec<u8>> {
        let mut last_error = None;
        let mut attempt = 0;
        
        while attempt <= self.retries {
            let _permit = self.semaphore.acquire().await.unwrap();
            
            let timeout = self.config.get_timeout(attempt);
            let start = std::time::Instant::now();
            
            let mut req = self.client.get(url).timeout(timeout);
            if is_metadata {
                if is_abbreviated {
                    req = req.header("Accept", "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*");
                } else {
                    req = req.header("Accept", "application/json");
                }
            }

            match req.send().await {
                Ok(resp) => {
                    let status = resp.status();
                    if status.is_success() {
                        match resp.bytes().await {
                            Ok(b) => {
                                self.config.record_request(start.elapsed(), false);
                                return Ok(b.to_vec());
                            }
                            Err(e) => {
                                self.config.record_request(start.elapsed(), true);
                                last_error = Some(anyhow::anyhow!("Body download failed: {}", e));
                            }
                        }
                    } else if status == 404 {
                        return Err(anyhow::anyhow!("Package not found: {}", url));
                    } else {
                        self.config.record_request(start.elapsed(), true);
                        last_error = Some(anyhow::anyhow!("HTTP {} for URL: {}", status, url));
                    }
                }
                Err(e) => {
                    self.config.record_request(start.elapsed(), true);
                    last_error = Some(anyhow::anyhow!("Request failed for URL {}: {}", url, e));
                }
            }
            drop(_permit);

            if attempt < self.retries {
                let sleep_ms = 300 * (attempt as u64 + 1);
                tokio::time::sleep(std::time::Duration::from_millis(sleep_ms)).await;
            }
            attempt += 1;
        }
        Err(last_error.unwrap_or_else(|| anyhow::anyhow!("Unknown error during request for {}", url)))
    }

    pub async fn fetch_package(&self, name: &str) -> Result<Arc<RegistryPackage>> {
        // 1. Memory Cache
        if let Some(cached) = self.package_cache.get(name).await {
            return Ok(cached);
        }

        // 2. Persistent Disk Cache
        if let Some(ref dir) = self.cache_dir {
            let path = dir.join(format!("{}.json", name.replace("/", "+")));
            if path.exists() {
                if let Ok(file) = std::fs::File::open(&path) {
                    let reader = std::io::BufReader::new(file);
                    if let Ok(pkg) = serde_json::from_reader::<_, RegistryPackage>(reader) {
                        let arc_pkg = Arc::new(pkg);
                        self.package_cache.insert(name.to_string(), arc_pkg.clone()).await;
                        return Ok(arc_pkg);
                    }
                }
            }
        }

        // 3. Request Coalescing (Wait for in-flight request)
        let mut rx = {
            use dashmap::Entry;
            match self.inflight.entry(name.to_string()) {
                Entry::Occupied(e) => e.get().subscribe(),
                Entry::Vacant(e) => {
                    let (tx, _rx) = tokio::sync::broadcast::channel(1);
                    e.insert(tx);
                    return self.fetch_package_network(name).await;
                }
            }
        };

        match rx.recv().await {
            Ok(pkg) => Ok(pkg),
            Err(_) => self.fetch_package_network(name).await
        }
    }

    async fn fetch_package_network(&self, name: &str) -> Result<Arc<RegistryPackage>> {
        let url = format!("{}/{}", self.base_url, name);
        let bytes_res = self.request_with_retry(&url, true, true).await;
        let tx_opt = self.inflight.remove(name);

        match bytes_res {
            Ok(bytes) => {
                // Parse JSON in a separate thread to avoid blocking the network executor
                let pkg_res = tokio::task::spawn_blocking(move || {
                    serde_json::from_slice::<RegistryPackage>(&bytes)
                }).await?;

                match pkg_res {
                    Ok(pkg) => {
                        let arc_pkg = Arc::new(pkg);
                        self.package_cache.insert(name.to_string(), arc_pkg.clone()).await;
                        
                        // Save to disk cache (non-blocking file write)
                        if let Some(ref dir) = self.cache_dir {
                            let path = dir.join(format!("{}.json", name.replace("/", "+")));
                            let arc_pkg_c = arc_pkg.clone();
                            tokio::spawn(async move {
                                if let Ok(data) = serde_json::to_string(&*arc_pkg_c) {
                                    let _ = std::fs::write(path, data);
                                }
                            });
                        }

                        if let Some((_, tx)) = tx_opt {
                            let _ = tx.send(arc_pkg.clone());
                        }
                        Ok(arc_pkg)
                    },
                    Err(e) => Err(anyhow::anyhow!("Failed to parse metadata for {}: {}", name, e))
                }
            },
            Err(e) => Err(e),
        }
    }

    pub async fn get_version_metadata(&self, name: &str, version: &str) -> Result<Arc<VersionMetadata>> {
        if let Some(pkg) = self.package_cache.get(name).await {
            if let Some(meta) = pkg.versions.get(version) {
                return Ok(Arc::new(meta.clone()));
            }
        }

        let url = format!("{}/{}/{}", self.base_url, name, version);
        let bytes = self.request_with_retry(&url, true, false).await?;
        let metadata = tokio::task::spawn_blocking(move || {
            serde_json::from_slice::<VersionMetadata>(&bytes)
        }).await??;
        
        Ok(Arc::new(metadata))
    }

    pub async fn download_tarball(&self, url: &str) -> Result<Vec<u8>> {
        self.request_with_retry(url, false, false).await
    }

    pub async fn download_tarball_stream(&self, url: &str, range_start: Option<u64>) -> Result<impl futures_util::Stream<Item = std::io::Result<bytes::Bytes>>> {
        let mut last_error = None;
        let mut attempt = 0;
        
        while attempt <= self.retries {
            let _permit = self.semaphore.acquire().await.unwrap();
            
            let timeout = self.config.get_timeout(attempt);
            
            let mut req = self.client.get(url)
                .timeout(timeout.max(std::time::Duration::from_secs(600))); // Allow up to 10 mins for large bodies

            if let Some(start) = range_start {
                req = req.header("Range", format!("bytes={}-", start));
            }

            match req.send().await {
                Ok(resp) => {
                    let status = resp.status();
                    if status.is_success() || status == reqwest::StatusCode::PARTIAL_CONTENT {
                        return Ok(resp.bytes_stream().map(|res| res.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))));
                    } else {
                         last_error = Some(anyhow::anyhow!("Failed to start download: {} (URL: {})", status, url));
                    }
                }
                Err(e) => {
                    last_error = Some(anyhow::anyhow!("Download request failed: {} (URL: {})", e, url));
                }
            }
            drop(_permit);
            
             if attempt < self.retries {
                let sleep_ms = 500 * (attempt as u64 + 1);
                tokio::time::sleep(std::time::Duration::from_millis(sleep_ms)).await;
            }
            attempt += 1;
        }
        
        Err(last_error.unwrap_or_else(|| anyhow::anyhow!("Failed to download tarball after retries: {}", url)))
    }
}
