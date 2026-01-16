use std::path::{Path, PathBuf};
use std::fs;
use std::io::{Read, Write};
use anyhow::{Context, Result};

pub struct Cas {
    pub base_path: PathBuf,
}

impl Cas {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let base_path = path.as_ref().to_path_buf();
        if !base_path.exists() {
            fs::create_dir_all(&base_path).context("Failed to create CAS base directory")?;
            fs::create_dir_all(base_path.join("files")).context("Failed to create CAS files directory")?;
            fs::create_dir_all(base_path.join("indices")).context("Failed to create CAS indices directory")?;
            fs::create_dir_all(base_path.join("temp")).context("Failed to create CAS temp directory")?;
        }
        Ok(Self { base_path })
    }

    pub fn get_file_path(&self, hash: &str) -> PathBuf {
        // Sharding for filesystem performance
        let (prefix, rest) = hash.split_at(2);
        let (sub_prefix, final_hash) = rest.split_at(2);
        self.base_path
            .join("files")
            .join(prefix)
            .join(sub_prefix)
            .join(final_hash)
    }

    pub fn store_stream<R: Read>(&self, mut reader: R) -> Result<String> {
        let temp_dir = self.base_path.join("temp");
        let temp_path = temp_dir.join(uuid::Uuid::new_v4().to_string());
        
        // Write to temp while hashing with ultra-fast Blake3
        let mut temp_file = fs::File::create(&temp_path)?;
        let mut hasher = blake3::Hasher::new();
        let mut buffer = [0u8; 16384]; // Larger buffer for speed
        
        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 { break; }
            temp_file.write_all(&buffer[..n])?;
            hasher.update(&buffer[..n]);
        }
        temp_file.flush()?;

        let hash = hasher.finalize().to_hex().to_string();
        let dest_path = self.get_file_path(&hash);

        if dest_path.exists() {
            fs::remove_file(&temp_path)?;
        } else {
            if let Some(parent) = dest_path.parent() {
                // Ignore error if directory was created by someone else
                let _ = fs::create_dir_all(parent);
            }
            // Use rename (atomic in most cases)
            if let Err(_) = fs::rename(&temp_path, &dest_path) {
                // If rename fails (maybe concurrent rename), check if dest exists
                if !dest_path.exists() {
                    // Actual error
                    return Err(anyhow::anyhow!("Failed to move file to CAS"));
                } else {
                    let _ = fs::remove_file(&temp_path);
                }
            }
            
            #[cfg(unix)] {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&dest_path)?.permissions();
                perms.set_mode(0o444); // Read-only
                let _ = fs::set_permissions(&dest_path, perms);
            }
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
