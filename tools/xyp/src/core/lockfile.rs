use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LockfilePackage {
    pub version: String,
    pub resolved: String,
    #[serde(default)]
    pub dependencies: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Lockfile {
    #[serde(rename = "lockfileVersion")]
    pub lockfile_version: u32,
    #[serde(default)]
    pub packages: HashMap<String, LockfilePackage>,
}

impl Lockfile {
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let content = fs::read_to_string(path.as_ref())
            .context("Failed to read lockfile")?;
        let lockfile: Lockfile = serde_json::from_str(&content)
            .context("Failed to parse lockfile")?;
        Ok(lockfile)
    }

    pub fn write_to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let content = serde_json::to_string_pretty(self)?;
        fs::write(path.as_ref(), content)
            .context("Failed to write lockfile")?;
        Ok(())
    }

    pub fn get_package(&self, name: &str) -> Option<&LockfilePackage> {
        self.packages.get(name)
    }

    pub fn add_package(&mut self, name: String, pkg: LockfilePackage) {
        self.packages.insert(name, pkg);
    }

    pub fn is_satisfied(&self, name: &str, version_req: &str) -> bool {
        if let Some(locked_pkg) = self.get_package(name) {
            // Parse the locked version and check if it satisfies the requirement
            if let Ok(locked_ver) = semver::Version::parse(&locked_pkg.version) {
                if let Ok(req) = semver::VersionReq::parse(version_req) {
                    return req.matches(&locked_ver);
                }
            }
        }
        false
    }

    pub fn new() -> Self {
        Self {
            lockfile_version: 1,
            packages: HashMap::new(),
        }
    }
}
