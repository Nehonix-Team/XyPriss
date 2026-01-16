use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use anyhow::{Context, Result};

#[derive(Debug, Serialize, Deserialize)]
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

pub struct Resolver {
    // Resolver state will go here
}

impl Resolver {
    pub fn new() -> Self {
        Self {}
    }

    pub async fn resolve_tree(&self, _root_pkg: &PackageJson) -> Result<()> {
        // Here we will implement the parallel resolution logic
        // for talking to the npm registry.
        Ok(())
    }
}
