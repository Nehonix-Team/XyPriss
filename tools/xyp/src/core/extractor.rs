use std::io::Read;
use anyhow::Result;
use flate2::read::GzDecoder;
use tar::Archive;
use crate::core::cas::Cas;

pub struct StreamingExtractor<'a> {
    cas: &'a Cas,
}

impl<'a> StreamingExtractor<'a> {
    pub fn new(cas: &'a Cas) -> Self {
        Self { cas }
    }

    /// Extracts a .tgz stream into the CAS and returns a map of filenames to their hashes
    /// Uses flate2 with pure Rust backend for maximum portability
    pub fn extract<R: Read>(&self, reader: R) -> Result<std::collections::HashMap<String, String>> {
        use std::io::BufReader;
        
        // Large buffer for optimal decompression speed
        let buf_reader = BufReader::with_capacity(4 * 1024 * 1024, reader); // 4MB buffer
        
        // GzDecoder with pure Rust backend
        let gz = GzDecoder::new(buf_reader);
        let mut archive = Archive::new(gz);
        let mut file_map = std::collections::HashMap::with_capacity(512);
        
        for entry in archive.entries()? {
            let mut entry = entry?;
            
            if !entry.header().entry_type().is_file() {
                continue;
            }
            
            let path = entry.path()?.to_string_lossy().to_string();
            let is_executable = entry.header().mode().ok()
                .map(|mode| (mode & 0o111) != 0)
                .unwrap_or(false);
            
            // Store in CAS
            let hash = self.cas.store_stream(&mut entry, is_executable)?;
            file_map.insert(path, hash);
        }

        Ok(file_map)
    }

    /// Alternative: Extract with immediate callback for eager processing
    pub fn extract_with_callback<R, F>(&self, reader: R, mut callback: F) -> Result<std::collections::HashMap<String, String>>
    where
        R: Read,
        F: FnMut(&str, &str), // (path, hash) callback for eager processing
    {
        use std::io::BufReader;
        
        let buf_reader = BufReader::with_capacity(4 * 1024 * 1024, reader);
        let gz = GzDecoder::new(buf_reader);
        let mut archive = Archive::new(gz);
        let mut file_map = std::collections::HashMap::with_capacity(512);

        for entry in archive.entries()? {
            let mut entry = entry?;
            
            if !entry.header().entry_type().is_file() {
                continue;
            }

            let path = entry.path()?.to_string_lossy().to_string();
            let is_executable = entry.header().mode()
                .ok()
                .map(|mode| (mode & 0o111) != 0)
                .unwrap_or(false);

            let hash = self.cas.store_stream(&mut entry, is_executable)?;
            
            // Immediate callback for eager consumers
            callback(&path, &hash);
            
            file_map.insert(path, hash);
        }

        Ok(file_map)
    }
}
