use std::path::{Path, PathBuf};
use std::fs;
use std::io::{Read, Write};
use anyhow::{Context, Result};


#[derive(Clone)]
pub struct Cas {
    pub base_path: PathBuf,
    dir_cache: std::sync::Arc<dashmap::DashSet<String>>,
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
        
        Ok(Self { 
            base_path,
            dir_cache: std::sync::Arc::new(dashmap::DashSet::with_capacity(4096)),
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

    pub fn store_stream<R: Read>(&self, reader: R) -> Result<String> {
        let mut reader = std::io::BufReader::with_capacity(128 * 1024, reader);
        // Optimized for small files (common in JS/TS packages)
        let mut buffer = Vec::with_capacity(64 * 1024);
        let mut chunk = [0u8; 16384];
        let mut total_read = 0;
        let small_file_limit = 64 * 1024;

        while total_read < small_file_limit {
            let n = reader.read(&mut chunk)?;
            if n == 0 { break; }
            buffer.extend_from_slice(&chunk[..n]);
            total_read += n;
        }

        if total_read < small_file_limit {
            // Memory path: fast hash + direct write
            let hash = blake3::hash(&buffer);
            let hash_hex = hash.to_hex();
            let dest_path = self.get_file_path(hash_hex.as_str());
            
            if dest_path.exists() {
                return Ok(hash_hex.to_string());
            }
            
            self.ensure_parent_dirs(&hash_hex)?;
            
            fs::write(&dest_path, &buffer)?;
            
            #[cfg(unix)] {
                use std::os::unix::fs::PermissionsExt;
                let _ = fs::set_permissions(&dest_path, fs::Permissions::from_mode(0o444));
            }
            return Ok(hash_hex.to_string());
        }

        // Streaming path for large files (e.g. Bun binary)
        let temp_dir = self.base_path.join("temp");
        let temp_path = temp_dir.join(uuid::Uuid::new_v4().to_string());
        
        let mut temp_file = fs::File::create(&temp_path)?;
        let mut hasher = blake3::Hasher::new();
        
        // Write the first chunk already read
        hasher.update(&buffer);
        temp_file.write_all(&buffer)?;

        let mut streaming_buffer = [0u8; 131072]; // 128KB buffer
        loop {
            let n = reader.read(&mut streaming_buffer)?;
            if n == 0 { break; }
            hasher.update(&streaming_buffer[..n]);
            temp_file.write_all(&streaming_buffer[..n])?;
        }
        
        temp_file.sync_all()?;
        let hash = hasher.finalize().to_hex();
        let dest_path = self.get_file_path(hash.as_str());
        
        if dest_path.exists() {
            let _ = fs::remove_file(&temp_path);
            return Ok(hash.to_string());
        }
        
        self.ensure_parent_dirs(hash.as_str())?;
        
        fs::rename(&temp_path, &dest_path)?;
        
        #[cfg(unix)] {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&dest_path, fs::Permissions::from_mode(0o444));
        }
        
        Ok(hash.to_string())
    }

    fn ensure_parent_dirs(&self, hash: &str) -> Result<()> {
        let prefix = &hash[0..2];
        let sub_prefix = &hash[2..4];
        let key = format!("{}/{}", prefix, sub_prefix);
        
        if !self.dir_cache.contains(&key) {
            let parent = self.base_path.join("files").join(prefix).join(sub_prefix);
            fs::create_dir_all(parent)?;
            self.dir_cache.insert(key);
        }
        Ok(())
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