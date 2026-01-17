use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use anyhow::Result;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::broadcast;

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
}

impl RegistryClient {
    pub fn new(base_url: Option<String>, retries: u32) -> Self {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "Accept",
            "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8".parse().unwrap()
        );

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(30)) // Reduced timeout for faster failover/retry
            .pool_idle_timeout(std::time::Duration::from_secs(120))
            .pool_max_idle_per_host(200) // Increased
            .tcp_keepalive(Some(std::time::Duration::from_secs(60)))
            .tcp_nodelay(true)
            .build()
            .unwrap_or_default();

        Self {
            client,
            base_url: base_url.unwrap_or_else(|| "https://registry.npmjs.org".to_string()),
            retries,
            package_cache: moka::future::Cache::builder()
                .max_capacity(2000)
                .time_to_live(std::time::Duration::from_secs(3600))
                .build(),
            inflight: DashMap::new(),
            semaphore: Arc::new(tokio::sync::Semaphore::new(150)), // Increased significantly
            cache_dir: None,
        }
    }

    pub fn set_cache_dir(&mut self, path: std::path::PathBuf) {
        let metadata_dir = path.join("metadata");
        let _ = std::fs::create_dir_all(&metadata_dir);
        self.cache_dir = Some(metadata_dir);
    }

    async fn request_with_retry(&self, url: &str, use_abbreviated: bool) -> Result<reqwest::Response> {
        let _permit = self.semaphore.acquire().await.unwrap();
        let mut last_error = None;
        for attempt in 0..=self.retries {
            let mut req = self.client.get(url);
            if !use_abbreviated {
                // For version metadata or tarballs, we might want full json or default headers
                req = req.header("Accept", "application/json");
            }

            match req.send().await {
                Ok(resp) => {
                     if resp.status().is_success() { return Ok(resp); }
                    last_error = Some(anyhow::anyhow!("HTTP {} for URL: {}", resp.status(), url));
                }
                Err(e) => {
                    last_error = Some(anyhow::anyhow!("Request failed for URL {}: {}", url, e));
                }
            }
            if attempt < self.retries {
                // Exponential backoff
                let sleep_ms = 200 * (2u64.pow(attempt));
                tokio::time::sleep(std::time::Duration::from_millis(sleep_ms)).await;
            }
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
                if let Ok(data) = std::fs::read_to_string(&path) {
                    if let Ok(pkg) = serde_json::from_str::<RegistryPackage>(&data) {
                        let arc_pkg = Arc::new(pkg);
                        self.package_cache.insert(name.to_string(), arc_pkg.clone()).await;
                        return Ok(arc_pkg);
                    }
                }
            }
        }

        // 3. Request Coalescing (Wait for in-flight request)
        let mut rx = {
            if let Some(tx) = self.inflight.get(name) {
                tx.subscribe()
            } else {
                let (tx, _rx) = broadcast::channel(1);
                self.inflight.insert(name.to_string(), tx);
                return self.fetch_package_network(name).await;
            }
        };

        match rx.recv().await {
            Ok(pkg) => Ok(pkg),
            Err(_) => self.fetch_package_network(name).await
        }
    }

    async fn fetch_package_network(&self, name: &str) -> Result<Arc<RegistryPackage>> {
        let url = format!("{}/{}", self.base_url, name);
        let resp_res = self.request_with_retry(&url, true).await;
        let tx_opt = self.inflight.remove(name);

        match resp_res {
            Ok(resp) => {
                let pkg_res = resp.json::<RegistryPackage>().await;
                match pkg_res {
                    Ok(pkg) => {
                        let arc_pkg = Arc::new(pkg);
                        self.package_cache.insert(name.to_string(), arc_pkg.clone()).await;
                        
                        // Save to disk cache
                        if let Some(ref dir) = self.cache_dir {
                            let path = dir.join(format!("{}.json", name.replace("/", "+")));
                            if let Ok(data) = serde_json::to_string(&*arc_pkg) {
                                let _ = std::fs::write(path, data);
                            }
                        }

                        if let Some((_, tx)) = tx_opt {
                            let _ = tx.send(arc_pkg.clone());
                        }
                        Ok(arc_pkg)
                    },
                    Err(e) => Err(anyhow::anyhow!("Failed to parse metadata: {}", e))
                }
            },
            Err(e) => Err(e)
        }
    }

    pub async fn get_version_metadata(&self, name: &str, version: &str) -> Result<Arc<VersionMetadata>> {
        // 1. Check if we already have the full package in cache
        if let Some(pkg) = self.package_cache.get(name).await {
            if let Some(meta) = pkg.versions.get(version) {
                return Ok(Arc::new(meta.clone()));
            }
        }

        // 2. Otherwise fetch specific version (fallback)
        let url = format!("{}/{}/{}", self.base_url, name, version);
        let resp = self.request_with_retry(&url, false).await?;
        let metadata: VersionMetadata = resp.json().await?;
        Ok(Arc::new(metadata))
    }

    pub async fn download_stream(&self, url: &str) -> Result<reqwest::Response> {
        self.request_with_retry(url, false).await
    }
}
