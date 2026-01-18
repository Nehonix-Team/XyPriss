use std::path::{Path, PathBuf};
use std::fs;
use std::io::{Read, Write};
use anyhow::{Context, Result};


#[derive(Clone)]
pub struct Cas {
    pub base_path: PathBuf,
}

impl Cas {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let base_path = path.as_ref().to_path_buf();
        if !base_path.exists() {
            fs::create_dir_all(&base_path).context("Failed to create CAS base directory")?;
        }
        fs::create_dir_all(base_path.join("files")).context("Failed to create XCAS files directory")?;
        fs::create_dir_all(base_path.join("indices")).context("Failed to create XCAS indices directory")?;
        fs::create_dir_all(base_path.join("metadata")).context("Failed to create XCAS metadata directory")?;
        fs::create_dir_all(base_path.join("temp")).context("Failed to create XCAS temp directory")?;
        fs::create_dir_all(base_path.join("virtual_store")).context("Failed to create XCAS virtual_store directory")?;
        
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

    pub fn store_stream<R: Read>(&self, mut reader: R) -> Result<String> {
        // Augmenté à 2MB pour les gros fichiers
        let mut buffer = Vec::with_capacity(2 * 1024 * 1024);
        let mut chunk = [0u8; 131072]; // 128KB chunks pour lecture plus rapide
        let mut total_read = 0;
        let max_mem_size = 2 * 1024 * 1024; // 2MB limite mémoire
        
        while total_read < max_mem_size {
            let n = reader.read(&mut chunk)?;
            if n == 0 { break; }
            buffer.extend_from_slice(&chunk[..n]);
            total_read += n;
        }

        if total_read < max_mem_size {
            let hash = blake3::hash(&buffer).to_hex().to_string();
            let dest_path = self.get_file_path(&hash);
            
            if dest_path.exists() {
                return Ok(hash);
            }
            
            if let Some(parent) = dest_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            
            let temp_dir = self.base_path.join("temp");
            let temp_path = temp_dir.join(uuid::Uuid::new_v4().to_string());
            fs::write(&temp_path, &buffer)?;
            
            if let Err(_) = fs::rename(&temp_path, &dest_path) {
                if !dest_path.exists() {
                    return Err(anyhow::anyhow!("Failed to move small file to CAS"));
                } else {
                    let _ = fs::remove_file(&temp_path);
                }
            }
            
            #[cfg(unix)] {
                use std::os::unix::fs::PermissionsExt;
                if let Ok(meta) = fs::metadata(&dest_path) {
                    let mut perms = meta.permissions();
                    perms.set_mode(0o444);
                    let _ = fs::set_permissions(&dest_path, perms);
                }
            }
            return Ok(hash);
        }

        // Gros fichiers: streaming optimisé avec buffer plus grand
        let temp_dir = self.base_path.join("temp");
        let temp_path = temp_dir.join(uuid::Uuid::new_v4().to_string());
        
        let mut temp_file = fs::File::create(&temp_path)?;
        let mut hasher = blake3::Hasher::new();
        
        temp_file.write_all(&buffer)?;
        hasher.update(&buffer);
        
        // Buffer 256KB pour streaming ultra-rapide
        let mut buffer_chunk = [0u8; 262144];
        while let Ok(n) = reader.read(&mut buffer_chunk) {
            if n == 0 { break; }
            temp_file.write_all(&buffer_chunk[..n])?;
            hasher.update(&buffer_chunk[..n]);
        }
        temp_file.flush()?;

        let hash = hasher.finalize().to_hex().to_string();
        let dest_path = self.get_file_path(&hash);

        if dest_path.exists() {
            fs::remove_file(&temp_path)?;
        } else {
            if let Some(parent) = dest_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if let Err(_) = fs::rename(&temp_path, &dest_path) {
                if !dest_path.exists() {
                    return Err(anyhow::anyhow!("Failed to move large file to CAS"));
                } else {
                    let _ = fs::remove_file(&temp_path);
                }
            }
            
            #[cfg(unix)] {
                use std::os::unix::fs::PermissionsExt;
                if let Ok(meta) = fs::metadata(&dest_path) {
                    let mut perms = meta.permissions();
                    perms.set_mode(0o444);
                    let _ = fs::set_permissions(&dest_path, perms);
                }
            }
        }

        Ok(hash)
    }



    pub fn store_index(&self, name: &str, version: &str, index: &std::collections::HashMap<String, String>) -> Result<()> {
        let path = self.base_path.join("indices").join(format!("{}@{}.json", name.replace("/", "+"), version));
        if let Some(parent) = path.parent() {
             fs::create_dir_all(parent)?;
        }
        let data = serde_json::to_string_pretty(index)?;
        fs::write(path, data)?;
        Ok(())
    }

    pub fn get_index(&self, name: &str, version: &str) -> Result<Option<std::collections::HashMap<String, String>>> {
        let path = self.base_path.join("indices").join(format!("{}@{}.json", name.replace("/", "+"), version));
        if !path.exists() {
            return Ok(None);
        }
        let data = fs::read_to_string(path)?;
        let index = serde_json::from_str(&data)?;
        Ok(Some(index))
    }

    pub fn store_metadata(&self, name: &str, version: &str, metadata: &serde_json::Value) -> Result<()> {
        let path = self.base_path.join("metadata").join(format!("{}@{}.json", name.replace("/", "+"), version));
        if let Some(parent) = path.parent() {
             fs::create_dir_all(parent)?;
        }
        let data = serde_json::to_string_pretty(metadata)?;
        fs::write(path, data)?;
        Ok(())
    }

    pub fn get_metadata(&self, name: &str, version: &str) -> Result<Option<serde_json::Value>> {
        let path = self.base_path.join("metadata").join(format!("{}@{}.json", name.replace("/", "+"), version));
        if !path.exists() {
            return Ok(None);
        }
        let data = fs::read_to_string(path)?;
        let metadata = serde_json::from_str(&data)?;
        Ok(Some(metadata))
    }
}