use std::path::{Path, PathBuf};
use std::fs;
use anyhow::{Context, Result};
use sha2::{Sha256, Digest};

pub struct Cas {
    base_path: PathBuf,
}

impl Cas {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let base_path = path.as_ref().to_path_buf();
        if !base_path.exists() {
            fs::create_dir_all(&base_path).context("Failed to create CAS base directory")?;
            fs::create_dir_all(base_path.join("files")).context("Failed to create CAS files directory")?;
            fs::create_dir_all(base_path.join("indices")).context("Failed to create CAS indices directory")?;
        }
        Ok(Self { base_path })
    }

    pub fn get_file_path(&self, hash: &str) -> PathBuf {
        let (prefix, rest) = hash.split_at(2);
        let (sub_prefix, final_hash) = rest.split_at(2);
        self.base_path
            .join("files")
            .join(prefix)
            .join(sub_prefix)
            .join(final_hash)
    }

    pub fn store_file(&self, data: &[u8]) -> Result<String> {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let hash = hex::encode(hasher.finalize());
        let dest_path = self.get_file_path(&hash);

        if !dest_path.exists() {
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(&dest_path, data)?;
            // Make file read-only to prevent accidental modification in проектов
            let mut perms = fs::metadata(&dest_path)?.permissions();
            perms.set_readonly(true);
            fs::set_permissions(&dest_path, perms)?;
        }

        Ok(hash)
    }

    pub fn contains(&self, hash: &str) -> bool {
        self.get_file_path(hash).exists()
    }
}
