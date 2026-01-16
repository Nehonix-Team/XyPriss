use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use anyhow::{Result, Context};

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
}

impl RegistryClient {
    pub fn new(base_url: Option<String>) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .pool_idle_timeout(std::time::Duration::from_secs(120))
            .build()
            .unwrap_or_default();

        Self {
            client,
            base_url: base_url.unwrap_or_else(|| "https://registry.npmjs.org".to_string()),
        }
    }

    async fn request_with_retry(&self, url: &str) -> Result<reqwest::Response> {
        let mut last_error = None;
        for attempt in 0..3 {
            match self.client.get(url).send().await {
                Ok(resp) if resp.status().is_success() => return Ok(resp),
                Ok(resp) => {
                    last_error = Some(anyhow::anyhow!("HTTP {} for URL: {}", resp.status(), url));
                }
                Err(e) => {
                    last_error = Some(anyhow::anyhow!("Request failed for URL {}: {}", url, e));
                }
            }
            if attempt < 2 {
                tokio::time::sleep(std::time::Duration::from_millis(1000 * (attempt + 1) as u64)).await;
            }
        }
        Err(last_error.unwrap_or_else(|| anyhow::anyhow!("Unknown error during request for {}", url)))
    }

    pub async fn fetch_package(&self, name: &str) -> Result<RegistryPackage> {
        let url = format!("{}/{}", self.base_url, name);
        let resp = self.request_with_retry(&url).await?;
        let pkg: RegistryPackage = resp.json().await?;
        Ok(pkg)
    }

    pub async fn get_version_metadata(&self, name: &str, version: &str) -> Result<VersionMetadata> {
        let url = format!("{}/{}/{}", self.base_url, name, version);
        let resp = self.request_with_retry(&url).await?;
        let metadata: VersionMetadata = resp.json().await?;
        Ok(metadata)
    }

    pub async fn download_stream(&self, url: &str) -> Result<reqwest::Response> {
        self.request_with_retry(url).await
    }
}
