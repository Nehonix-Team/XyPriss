use std::io::Read;
use anyhow::{Result, Context};
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
    pub fn extract<R: Read>(&self, reader: R) -> Result<std::collections::HashMap<String, String>> {
        let gz = GzDecoder::new(reader);
        let mut archive = Archive::new(gz);
        let mut file_map = std::collections::HashMap::new();

        for entry in archive.entries()? {
            let mut entry = entry?;
            let path = entry.path()?.to_string_lossy().to_string();
            
            // Skip directories and other non-regular files for CAS
            if !entry.header().entry_type().is_file() {
                continue;
            }

            // Store in CAS using streaming
            let hash = self.cas.store_stream(&mut entry)?;
            
            file_map.insert(path, hash);
        }

        Ok(file_map)
    }
}
