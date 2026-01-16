use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use anyhow::{Result, Context};
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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Dist {
    pub tarball: String,
    pub shasum: String,
    pub integrity: Option<String>,
}

pub struct RegistryClient {
    client: reqwest::Client,
    base_url: String,
    package_cache: DashMap<String, Arc<RegistryPackage>>,
    inflight: DashMap<String, broadcast::Sender<Arc<RegistryPackage>>>,
}

impl RegistryClient {
    pub fn new(base_url: Option<String>) -> Self {
        let mut headers = reqwest::header::HeaderMap::new();
        // Use abbreviated metadata for ultra-fast resolution
        headers.insert(
            "Accept",
            "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8".parse().unwrap()
        );

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(30))
            .pool_idle_timeout(std::time::Duration::from_secs(120))
            .pool_max_idle_per_host(100) // Increase to match resolution concurrency
            .tcp_keepalive(Some(std::time::Duration::from_secs(60)))
            .tcp_nodelay(true)
            .build()
            .unwrap_or_default();

        Self {
            client,
            base_url: base_url.unwrap_or_else(|| "https://registry.npmjs.org".to_string()),
            package_cache: DashMap::new(),
            inflight: DashMap::new(),
        }
    }

    async fn request_with_retry(&self, url: &str, use_abbreviated: bool) -> Result<reqwest::Response> {
        let mut last_error = None;
        for attempt in 0..3 {
            let mut req = self.client.get(url);
            if !use_abbreviated {
                // For version metadata or tarballs, we might want full json or default headers
                req = req.header("Accept", "application/json");
            }

            match req.send().await {
                Ok(resp) if resp.status().is_success() => return Ok(resp),
                Ok(resp) => {
                    last_error = Some(anyhow::anyhow!("HTTP {} for URL: {}", resp.status(), url));
                }
                Err(e) => {
                    last_error = Some(anyhow::anyhow!("Request failed for URL {}: {}", url, e));
                }
            }
            if attempt < 2 {
                tokio::time::sleep(std::time::Duration::from_millis(200 * (attempt + 1) as u64)).await;
            }
        }
        Err(last_error.unwrap_or_else(|| anyhow::anyhow!("Unknown error during request for {}", url)))
    }

    pub async fn fetch_package(&self, name: &str) -> Result<Arc<RegistryPackage>> {
        // 1. Memory Cache
        if let Some(cached) = self.package_cache.get(name) {
            return Ok(cached.clone());
        }

        // 2. Request Coalescing (Wait for in-flight request)
        let mut rx = {
            if let Some(tx) = self.inflight.get(name) {
                tx.subscribe()
            } else {
                let (tx, _rx) = broadcast::channel(1);
                self.inflight.insert(name.to_string(), tx);
                // Return original receiver to the first caller
                return self.fetch_package_network(name).await;
            }
        };

        // If we were a secondary caller, wait for the result
        match rx.recv().await {
            Ok(pkg) => Ok(pkg),
            Err(_) => {
                // The original request failed, try again individually
                self.fetch_package_network(name).await
            }
        }
    }

    async fn fetch_package_network(&self, name: &str) -> Result<Arc<RegistryPackage>> {
        let url = format!("{}/{}", self.base_url, name);
        let resp = self.request_with_retry(&url, true).await?;
        let pkg: RegistryPackage = resp.json().await?;
        let arc_pkg = Arc::new(pkg);
        
        // Update cache
        self.package_cache.insert(name.to_string(), arc_pkg.clone());
        
        // Notify in-flight callers
        if let Some((_, tx)) = self.inflight.remove(name) {
            let _ = tx.send(arc_pkg.clone());
        }
        
        Ok(arc_pkg)
    }

    pub async fn get_version_metadata(&self, name: &str, version: &str) -> Result<Arc<VersionMetadata>> {
        // 1. Check if we already have the full package in cache
        if let Some(pkg) = self.package_cache.get(name) {
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
