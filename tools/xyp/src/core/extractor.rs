use std::io::Read;
use anyhow::Result;
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
    /// ULTRA-OPTIMIZED: Uses libdeflater (2-3x faster than flate2) for decompression
    pub fn extract<R: Read>(&self, reader: R) -> Result<std::collections::HashMap<String, String>> {
        use std::io::BufReader;
        
        // Step 1: Decompress the entire tarball using libdeflater (2-3x faster than flate2)
        let buf_reader = BufReader::with_capacity(2 * 1024 * 1024, reader);
        let decompressed = decompress_gzip_fast(buf_reader)?;
        
        // Step 2: Extract tar entries sequentially (tar format requires sequential access)
        let mut archive = Archive::new(&decompressed[..]);
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
        
        let buf_reader = BufReader::with_capacity(2 * 1024 * 1024, reader);
        let decompressed = decompress_gzip_fast(buf_reader)?;
        
        let mut archive = Archive::new(&decompressed[..]);
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

/// Ultra-fast gzip decompression using libdeflater (2-3x faster than flate2)
fn decompress_gzip_fast<R: Read>(mut reader: R) -> Result<Vec<u8>> {
    // Read the entire compressed stream into memory
    let mut compressed = Vec::with_capacity(4 * 1024 * 1024); // Start with 4MB
    reader.read_to_end(&mut compressed)?;
    
    // Parse gzip header (10 bytes minimum)
    if compressed.len() < 10 {
        anyhow::bail!("Invalid gzip data: too short");
    }
    
    // Skip gzip header and use libdeflater for raw deflate decompression
    // gzip format: 10-byte header + deflate data + 8-byte trailer
    let deflate_data = if compressed[0] == 0x1f && compressed[1] == 0x8b {
        // Standard gzip header
        &compressed[10..compressed.len().saturating_sub(8)]
    } else {
        &compressed[..]
    };
    
    // Use libdeflater for maximum speed
    let mut decompressor = libdeflater::Decompressor::new();
    let decompressed_size = compressed.len() * 4; // Estimate 4x expansion ratio
    let mut decompressed = vec![0u8; decompressed_size];
    
    match decompressor.deflate_decompress(deflate_data, &mut decompressed) {
        Ok(actual_size) => {
            decompressed.truncate(actual_size);
            Ok(decompressed)
        }
        Err(_) => {
            // Fallback to flate2 if libdeflater fails (different compression format)
            use flate2::read::GzDecoder;
            let mut decompressed = Vec::new();
            let mut decoder = GzDecoder::new(&compressed[..]);
            decoder.read_to_end(&mut decompressed)?;
            Ok(decompressed)
        }
    }
}
