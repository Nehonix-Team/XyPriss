use std::path::{Path, PathBuf};
use std::fs;
use std::io::{Read, Write};
use anyhow::{Context, Result};
use sha2::{Sha256, Digest};

pub struct Cas {
    base_path: PathBuf,
    storage_mutex: std::sync::Mutex<()>,
}

impl Cas {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let base_path = path.as_ref().to_path_buf();
        if !base_path.exists() {
            fs::create_dir_all(&base_path).context("Failed to create CAS base directory")?;
            fs::create_dir_all(base_path.join("files")).context("Failed to create CAS files directory")?;
            fs::create_dir_all(base_path.join("indices")).context("Failed to create CAS indices directory")?;
        }
        Ok(Self { 
            base_path,
            storage_mutex: std::sync::Mutex::new(()),
        })
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

    pub fn store_stream<R: Read>(&self, mut reader: R) -> Result<String> {
        // We need the hash before we know the final path
        // So we write to a temp file, compute hash, and then rename
        let temp_dir = self.base_path.join("temp");
        {
            let _lock = self.storage_mutex.lock().unwrap();
            if !temp_dir.exists() {
                fs::create_dir_all(&temp_dir)?;
            }
        }

        let temp_path = temp_dir.join(uuid::Uuid::new_v4().to_string());
        let mut temp_file = fs::File::create(&temp_path)?;
        let mut hasher = Sha256::new();

        let mut buffer = [0u8; 8192];
        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 { break; }
            temp_file.write_all(&buffer[..n])?;
            hasher.update(&buffer[..n]);
        }
        temp_file.flush()?;

        let hash = hex::encode(hasher.finalize());
        let dest_path = self.get_file_path(&hash);

        let _lock = self.storage_mutex.lock().unwrap();
        if dest_path.exists() {
            fs::remove_file(&temp_path)?;
        } else {
            if let Some(parent) = dest_path.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)?;
                }
            }
            fs::rename(&temp_path, &dest_path)?;
            let mut perms = fs::metadata(&dest_path)?.permissions();
            perms.set_readonly(true);
            fs::set_permissions(&dest_path, perms)?;
        }

        Ok(hash)
    }

    pub fn contains(&self, hash: &str) -> bool {
        self.get_file_path(hash).exists()
    }

    pub fn store_index(&self, name: &str, version: &str, index: &std::collections::HashMap<String, String>) -> Result<()> {
        let path = self.base_path.join("indices").join(format!("{}@{}.json", name, version));
        if let Some(parent) = path.parent() {
             fs::create_dir_all(parent)?;
        }
        let data = serde_json::to_string_pretty(index)?;
        fs::write(path, data)?;
        Ok(())
    }

    pub fn get_index(&self, name: &str, version: &str) -> Result<Option<std::collections::HashMap<String, String>>> {
        let path = self.base_path.join("indices").join(format!("{}@{}.json", name, version));
        if !path.exists() {
            return Ok(None);
        }
        let data = fs::read_to_string(path)?;
        let index = serde_json::from_str(&data)?;
        Ok(Some(index))
    }
}
