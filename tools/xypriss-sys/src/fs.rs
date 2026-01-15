/* *****************************************************************************
 * Nehonix XyPriss FileSystem Module
 * 
 * ACCESS RESTRICTIONS:
 * - This software is exclusively for use by Authorized Personnel of NEHONIX
 * - Intended for Internal Use only within NEHONIX operations
 * - No rights granted to unauthorized individuals or entities
 * - All modifications are works made for hire assigned to NEHONIX
 *
 * PROHIBITED ACTIVITIES:
 * - Copying, distributing, or sublicensing without written permission
 * - Reverse engineering, decompiling, or disassembling
 * - Creating derivative works without explicit authorization
 * - External use or commercial distribution outside NEHONIX
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * For questions or permissions, contact:
 * NEHONIX Legal Department
 * Email: legal@nehonix.com
 * Website: www.nehonix.com
 ***************************************************************************** */

use anyhow::{Context, Result, anyhow};
use std::fs::{self, OpenOptions};
use std::io::{Write, Read, BufReader, BufWriter};
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use walkdir::WalkDir;
use serde_json::Value;
use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::sync::mpsc::channel;
use std::collections::HashMap;
use regex::Regex;
use rayon::prelude::*;
use flate2::Compression;
use flate2::write::GzEncoder;
use flate2::read::GzDecoder;
use tar::{Archive, Builder};
use sha2::{Sha256, Digest};
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct FileStats {
    pub size: u64,
    pub created: u64,
    pub modified: u64,
    pub accessed: u64,
    pub is_dir: bool,
    pub is_file: bool,
    pub is_symlink: bool,
    pub permissions: u32,
}


#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct DiskUsage {
    pub total: u64,
    pub used: u64,
    pub available: u64,
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct DuInfo {
    pub path: String,
    pub size: u64,
    pub file_count: u64,
    pub dir_count: u64,
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct DuplicateGroup {
    pub hash: String,
    pub paths: Vec<String>,
    pub size: u64,
}

pub enum WatchEventType {
    Created(PathBuf),
    Modified(PathBuf),
    Deleted(PathBuf),
    Renamed(PathBuf, PathBuf),
}

pub struct XyPrissFS {
    root: PathBuf,
    watchers: HashMap<String, Box<dyn Watcher + Send>>,
}

impl XyPrissFS {
    pub fn new(root: PathBuf) -> Result<Self> {
        let root = fs::canonicalize(root)?;
        Ok(Self { 
            root,
            watchers: HashMap::new(),
        })
    }

    pub fn get_root(&self) -> &PathBuf {
        &self.root
    }

    // ============ PATH OPERATIONS ============
    
    pub fn resolve<P: AsRef<Path>>(&self, path: P) -> PathBuf {
        if path.as_ref().is_absolute() {
            path.as_ref().to_path_buf()
        } else {
            self.root.join(path)
        }
    }

    pub fn join<P: AsRef<Path>, Q: AsRef<Path>>(&self, a: P, b: Q) -> PathBuf {
        a.as_ref().join(b)
    }

    pub fn dirname<P: AsRef<Path>>(&self, path: P) -> Option<PathBuf> {
        path.as_ref().parent().map(|p| p.to_path_buf())
    }

    pub fn basename<P: AsRef<Path>>(&self, path: P) -> Option<String> {
        path.as_ref().file_name().map(|s| s.to_string_lossy().into_owned())
    }

    pub fn extname<P: AsRef<Path>>(&self, path: P) -> String {
        path.as_ref().extension()
            .map(|s| format!(".{}", s.to_string_lossy()))
            .unwrap_or_default()
    }

    pub fn normalize<P: AsRef<Path>>(&self, path: P) -> PathBuf {
        use std::path::Component;
        let mut normalized = PathBuf::new();
        for component in path.as_ref().components() {
            match component {
                Component::CurDir => {},
                Component::ParentDir => { normalized.pop(); },
                c => normalized.push(c),
            }
        }
        normalized
    }

    pub fn relative_path<P: AsRef<Path>, Q: AsRef<Path>>(&self, from: P, to: Q) -> Result<PathBuf> {
        pathdiff::diff_paths(to.as_ref(), from.as_ref())
            .ok_or_else(|| anyhow!("Cannot compute relative path"))
    }

    pub fn absolute_path<P: AsRef<Path>>(&self, path: P) -> Result<PathBuf> {
        let full_path = self.resolve(path);
        fs::canonicalize(full_path).context("Failed to get absolute path")
    }

    // ============ FILE CHECKS ============
    
    pub fn exists<P: AsRef<Path>>(&self, path: P) -> bool {
        self.resolve(path).exists()
    }

    pub fn is_dir<P: AsRef<Path>>(&self, path: P) -> bool {
        self.resolve(path).is_dir()
    }

    pub fn is_file<P: AsRef<Path>>(&self, path: P) -> bool {
        self.resolve(path).is_file()
    }

    pub fn is_symlink<P: AsRef<Path>>(&self, path: P) -> bool {
        self.resolve(path).symlink_metadata()
            .map(|m| m.file_type().is_symlink())
            .unwrap_or(false)
    }

    pub fn is_empty<P: AsRef<Path>>(&self, path: P) -> bool {
        let full_path = self.resolve(path);
        if full_path.is_dir() {
            fs::read_dir(full_path).map(|mut d| d.next().is_none()).unwrap_or(true)
        } else {
            fs::metadata(full_path).map(|m| m.len() == 0).unwrap_or(true)
        }
    }

    pub fn is_readable<P: AsRef<Path>>(&self, path: P) -> bool {
        let full_path = self.resolve(path);
        fs::File::open(full_path).is_ok()
    }

    pub fn is_writable<P: AsRef<Path>>(&self, path: P) -> bool {
        let full_path = self.resolve(path);
        fs::OpenOptions::new().write(true).open(full_path).is_ok()
    }

    // ============ FILE STATS ============

    pub fn stats<P: AsRef<Path>>(&self, path: P) -> Result<FileStats> {
        let full_path = self.resolve(path);
        let metadata = fs::metadata(&full_path)?;
        
        let to_timestamp = |t: std::io::Result<SystemTime>| -> u64 {
            t.ok()
                .and_then(|time| time.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|dur| dur.as_secs()) // or as_millis() if we want ms precision
                .unwrap_or(0)
        };

        Ok(FileStats {
            size: metadata.len(),
            created: to_timestamp(metadata.created()),
            modified: to_timestamp(metadata.modified()),
            accessed: to_timestamp(metadata.accessed()),
            is_dir: metadata.is_dir(),
            is_file: metadata.is_file(),
            is_symlink: metadata.file_type().is_symlink(),
            permissions: {
                #[cfg(unix)] { 
                    use std::os::unix::fs::PermissionsExt;
                    metadata.permissions().mode() 
                }
                #[cfg(not(unix))] { 
                    if metadata.permissions().readonly() { 0o444 } else { 0o666 } 
                }
            },
        })
    }

    pub fn size<P: AsRef<Path>>(&self, path: P) -> Result<u64> {
        let full_path = self.resolve(path);
        if full_path.is_file() {
            Ok(fs::metadata(full_path)?.len())
        } else if full_path.is_dir() {
            Ok(self.dir_size(&full_path)?)
        } else {
            Err(anyhow!("Path is neither file nor directory"))
        }
    }

    fn dir_size(&self, path: &Path) -> Result<u64> {
        let mut total = 0u64;
        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                total += entry.metadata()?.len();
            }
        }
        Ok(total)
    }

    // ============ READ OPERATIONS ============
    
    pub fn read_file<P: AsRef<Path>>(&self, path: P) -> Result<String> {
        let full_path = self.resolve(path);
        fs::read_to_string(&full_path)
            .with_context(|| format!("Failed to read file: {:?}", full_path))
    }

    pub fn read_bytes<P: AsRef<Path>>(&self, path: P) -> Result<Vec<u8>> {
        let full_path = self.resolve(path);
        fs::read(&full_path)
            .with_context(|| format!("Failed to read bytes: {:?}", full_path))
    }

    pub fn read_json<P: AsRef<Path>>(&self, path: P) -> Result<Value> {
        let content = self.read_file(path)?;
        serde_json::from_str(&content).context("Failed to parse JSON")
    }

    pub fn read_json_safe<P: AsRef<Path>>(&self, path: P, default: Value) -> Value {
        self.read_json(path.as_ref()).unwrap_or(default)
    }

    pub fn read_lines<P: AsRef<Path>>(&self, path: P) -> Result<Vec<String>> {
        let content = self.read_file(path)?;
        Ok(content.lines().map(|s| s.to_string()).collect())
    }

    pub fn read_stream<P: AsRef<Path>>(&self, path: P) -> Result<BufReader<fs::File>> {
        let full_path = self.resolve(path);
        let file = fs::File::open(&full_path)?;
        Ok(BufReader::new(file))
    }

    // ============ WRITE OPERATIONS ============
    
    pub fn write_file<P: AsRef<Path>>(&self, path: P, data: &str) -> Result<()> {
        let full_path = self.resolve(path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&full_path, data)
            .with_context(|| format!("Failed to write file: {:?}", full_path))
    }

    pub fn write_bytes<P: AsRef<Path>>(&self, path: P, data: &[u8]) -> Result<()> {
        let full_path = self.resolve(path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&full_path, data)
            .with_context(|| format!("Failed to write bytes: {:?}", full_path))
    }

    pub fn write_json<P: AsRef<Path>>(&self, path: P, data: &Value) -> Result<()> {
        let content = serde_json::to_string_pretty(data)?;
        self.write_file(path.as_ref(), &content)
    }

    pub fn write_json_compact<P: AsRef<Path>>(&self, path: P, data: &Value) -> Result<()> {
        let content = serde_json::to_string(data)?;
        self.write_file(path.as_ref(), &content)
    }

    pub fn write_stream<P: AsRef<Path>>(&self, path: P) -> Result<BufWriter<fs::File>> {
        let full_path = self.resolve(path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let file = fs::File::create(&full_path)?;
        Ok(BufWriter::new(file))
    }

    pub fn append<P: AsRef<Path>>(&self, path: P, data: &str) -> Result<()> {
        let full_path = self.resolve(path);
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&full_path)?;
        file.write_all(data.as_bytes())?;
        Ok(())
    }

    pub fn append_line<P: AsRef<Path>>(&self, path: P, line: &str) -> Result<()> {
        self.append(path.as_ref(), &format!("{}\n", line))
    }

    pub fn append_bytes<P: AsRef<Path>>(&self, path: P, data: &[u8]) -> Result<()> {
        let full_path = self.resolve(path);
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&full_path)?;
        file.write_all(data)?;
        Ok(())
    }

    // ============ DIRECTORY OPERATIONS ============
    
    pub fn mkdir<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let full_path = self.resolve(path);
        fs::create_dir_all(&full_path)
            .with_context(|| format!("Failed to create directory: {:?}", full_path))
    }

    pub fn ls<P: AsRef<Path>>(&self, path: P) -> Result<Vec<String>> {
        let full_path = self.resolve(path);
        let mut entries = Vec::new();
        for entry in fs::read_dir(full_path)? {
            let entry = entry?;
            entries.push(entry.file_name().to_string_lossy().into_owned());
        }
        Ok(entries)
    }

    pub fn ls_full_path<P: AsRef<Path>>(&self, path: P) -> Result<Vec<PathBuf>> {
        let full_path = self.resolve(path);
        let mut entries = Vec::new();
        for entry in fs::read_dir(full_path)? {
            let entry = entry?;
            entries.push(entry.path());
        }
        Ok(entries)
    }

    pub fn ls_recursive<P: AsRef<Path>>(&self, path: P) -> Vec<PathBuf> {
        let full_path = self.resolve(path);
        let mut results = Vec::new();
        for entry in WalkDir::new(full_path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                results.push(entry.path().to_path_buf());
            }
        }
        results
    }

    pub fn ls_with_stats<P: AsRef<Path>>(&self, path: P) -> Result<Vec<(String, FileStats)>> {
        let full_path = self.resolve(path);
        let mut entries = Vec::new();
        for entry in fs::read_dir(full_path)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let stats = self.stats(entry.path())?;
            entries.push((name, stats));
        }
        Ok(entries)
    }

    // ============ SEARCH & FILTER ============
    
    pub fn find<P: AsRef<Path>>(&self, path: P, pattern: &str) -> Result<Vec<PathBuf>> {
        let re = Regex::new(pattern)?;
        let full_path = self.resolve(path);
        let mut results = Vec::new();
        
        for entry in WalkDir::new(full_path).into_iter().filter_map(|e| e.ok()) {
            if let Some(name) = entry.file_name().to_str() {
                if re.is_match(name) {
                    results.push(entry.path().to_path_buf());
                }
            }
        }
        Ok(results)
    }

    pub fn find_by_extension<P: AsRef<Path>>(&self, path: P, ext: &str) -> Vec<PathBuf> {
        let full_path = self.resolve(path);
        let ext = ext.trim_start_matches('.');
        
        WalkDir::new(full_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                e.path().extension()
                    .and_then(|s| s.to_str())
                    .map(|s| s == ext)
                    .unwrap_or(false)
            })
            .map(|e| e.path().to_path_buf())
            .collect()
    }

    pub fn find_modified_since<P: AsRef<Path>>(&self, path: P, since: SystemTime) -> Vec<PathBuf> {
        let full_path = self.resolve(path);
        
        WalkDir::new(full_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                e.metadata()
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .map(|t| t > since)
                    .unwrap_or(false)
            })
            .map(|e| e.path().to_path_buf())
            .collect()
    }

    pub fn grep<P: AsRef<Path>>(&self, path: P, pattern: &str) -> Result<HashMap<PathBuf, Vec<String>>> {
        let re = Regex::new(pattern)?;
        let full_path = self.resolve(path);
        let mut results = HashMap::new();
        
        for entry in WalkDir::new(full_path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    let matches: Vec<String> = content.lines()
                        .filter(|line| re.is_match(line))
                        .map(|s| s.to_string())
                        .collect();
                    
                    if !matches.is_empty() {
                        results.insert(entry.path().to_path_buf(), matches);
                    }
                }
            }
        }
        Ok(results)
    }

    // ============ FILE OPERATIONS ============
    
    pub fn copy<P: AsRef<Path>, Q: AsRef<Path>>(&self, src: P, dest: Q) -> Result<()> {
        let full_src = self.resolve(src);
        let full_dest = self.resolve(dest);
        
        if full_src.is_dir() {
            let mut options = fs_extra::dir::CopyOptions::new();
            options.overwrite = true;
            options.copy_inside = true;
            fs_extra::dir::copy(&full_src, &full_dest, &options)?;
        } else {
            if let Some(parent) = full_dest.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&full_src, &full_dest)?;
        }
        Ok(())
    }

    pub fn move_item<P: AsRef<Path>, Q: AsRef<Path>>(&self, src: P, dest: Q) -> Result<()> {
        let full_src = self.resolve(src);
        let full_dest = self.resolve(dest);
        if let Some(parent) = full_dest.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::rename(&full_src, &full_dest)
            .with_context(|| format!("Failed to move from {:?} to {:?}", full_src, full_dest))
    }

    pub fn remove<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let full_path = self.resolve(path);
        if full_path.is_dir() {
            fs::remove_dir_all(&full_path)?;
        } else {
            fs::remove_file(&full_path)?;
        }
        Ok(())
    }

    pub fn touch<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let full_path = self.resolve(path.as_ref());
        if full_path.exists() {
            let now = filetime::FileTime::now();
            filetime::set_file_times(&full_path, now, now)?;
        } else {
            self.write_file(path.as_ref(), "")?;
        }
        Ok(())
    }

    pub fn symlink<P: AsRef<Path>, Q: AsRef<Path>>(&self, src: P, dest: Q) -> Result<()> {
        let full_src = self.resolve(src);
        let full_dest = self.resolve(dest);
        
        #[cfg(unix)]
        std::os::unix::fs::symlink(&full_src, &full_dest)?;
        
        #[cfg(windows)]
        {
            if full_src.is_dir() {
                std::os::windows::fs::symlink_dir(&full_src, &full_dest)?;
            } else {
                std::os::windows::fs::symlink_file(&full_src, &full_dest)?;
            }
        }
        
        Ok(())
    }

    // ============ HASH & CHECKSUM ============
    
    pub fn hash_file<P: AsRef<Path>>(&self, path: P) -> Result<String> {
        let full_path = self.resolve(path);
        let mut file = fs::File::open(&full_path)?;
        let mut hasher = Sha256::new();
        let mut buffer = [0; 8192];
        
        loop {
            let n = file.read(&mut buffer)?;
            if n == 0 { break; }
            hasher.update(&buffer[..n]);
        }
        
        Ok(format!("{:x}", hasher.finalize()))
    }

    pub fn verify_hash<P: AsRef<Path>>(&self, path: P, expected_hash: &str) -> Result<bool> {
        let actual_hash = self.hash_file(path)?;
        Ok(actual_hash == expected_hash)
    }

    // ============ COMPRESSION ============
    
    pub fn compress_gzip<P: AsRef<Path>, Q: AsRef<Path>>(&self, src: P, dest: Q) -> Result<()> {
        let full_src = self.resolve(src);
        let full_dest = self.resolve(dest);
        
        let input = fs::File::open(&full_src)?;
        let output = fs::File::create(&full_dest)?;
        let mut encoder = GzEncoder::new(output, Compression::default());
        
        let mut reader = BufReader::new(input);
        std::io::copy(&mut reader, &mut encoder)?;
        encoder.finish()?;
        
        Ok(())
    }

    pub fn decompress_gzip<P: AsRef<Path>, Q: AsRef<Path>>(&self, src: P, dest: Q) -> Result<()> {
        let full_src = self.resolve(src);
        let full_dest = self.resolve(dest);
        
        let input = fs::File::open(&full_src)?;
        let mut decoder = GzDecoder::new(BufReader::new(input));
        let mut output = fs::File::create(&full_dest)?;
        
        std::io::copy(&mut decoder, &mut output)?;
        
        Ok(())
    }

    pub fn create_tar<P: AsRef<Path>, Q: AsRef<Path>>(&self, dir: P, dest: Q) -> Result<()> {
        let full_dir = self.resolve(dir);
        let full_dest = self.resolve(dest);
        
        let file = fs::File::create(&full_dest)?;
        let mut archive = Builder::new(file);
        archive.append_dir_all(".", &full_dir)?;
        archive.finish()?;
        
        Ok(())
    }

    pub fn extract_tar<P: AsRef<Path>, Q: AsRef<Path>>(&self, src: P, dest: Q) -> Result<()> {
        let full_src = self.resolve(src);
        let full_dest = self.resolve(dest);
        
        let file = fs::File::open(&full_src)?;
        let mut archive = Archive::new(file);
        archive.unpack(&full_dest)?;
        
        Ok(())
    }

    // ============ FILE WATCHING ============
    
    pub fn watch<P: AsRef<Path>, F>(&mut self, path: P, callback: F) -> Result<String>
    where
        F: Fn(WatchEventType) + Send + 'static,
    {
        let full_path = self.resolve(path);
        let (tx, rx) = channel();
        
        let mut watcher = notify::recommended_watcher(move |res: Result<Event, _>| {
            if let Ok(event) = res {
                let _ = tx.send(event);
            }
        })?;
        
        watcher.watch(&full_path, RecursiveMode::Recursive)?;
        
        let watch_id = uuid::Uuid::new_v4().to_string();
        
        std::thread::spawn(move || {
            while let Ok(event) = rx.recv() {
                match event.kind {
                    EventKind::Create(_) => {
                        for path in event.paths {
                            callback(WatchEventType::Created(path));
                        }
                    },
                    EventKind::Modify(_) => {
                        for path in event.paths {
                            callback(WatchEventType::Modified(path));
                        }
                    },
                    EventKind::Remove(_) => {
                        for path in event.paths {
                            callback(WatchEventType::Deleted(path));
                        }
                    },
                    _ => {}
                }
            }
        });
        
        self.watchers.insert(watch_id.clone(), Box::new(watcher));
        Ok(watch_id)
    }

    pub fn unwatch(&mut self, watch_id: &str) -> Result<()> {
        self.watchers.remove(watch_id)
            .ok_or_else(|| anyhow!("Watch ID not found"))?;
        Ok(())
    }

    // ============ PARALLEL OPERATIONS ============
    
    pub fn parallel_process_files<P, F>(&self, path: P, processor: F) -> Result<()>
    where
        P: AsRef<Path>,
        F: Fn(&Path) -> Result<()> + Sync + Send,
    {
        let files = self.ls_recursive(path);
        
        files.par_iter()
            .try_for_each(|file| processor(file))?;
        
        Ok(())
    }

    pub fn preview_batch_rename<P: AsRef<Path>>(&self, path: P, pattern: &str, replacement: &str) -> Result<Vec<(PathBuf, PathBuf)>> {
        let re = Regex::new(pattern)?;
        let full_path = self.resolve(path);
        let mut changes = Vec::new();
        
        for entry in WalkDir::new(full_path).into_iter().filter_map(|e| e.ok()) {
            if let Some(name) = entry.file_name().to_str() {
                if re.is_match(name) {
                    let new_name = re.replace(name, replacement);
                    let new_path = entry.path().with_file_name(new_name.as_ref());
                    changes.push((entry.path().to_path_buf(), new_path));
                }
            }
        }
        
        Ok(changes)
    }

    pub fn batch_rename<P: AsRef<Path>>(&self, path: P, pattern: &str, replacement: &str) -> Result<usize> {
        let changes = self.preview_batch_rename(path, pattern, replacement)?;
        let count = changes.len();
        
        for (old, new) in changes {
            fs::rename(old, new)?;
        }
        
        Ok(count)
    }

    // ============ PERMISSIONS ============
    
    #[cfg(unix)]
    pub fn chmod<P: AsRef<Path>>(&self, path: P, mode: u32) -> Result<()> {
        let full_path = self.resolve(path);
        let permissions = fs::Permissions::from_mode(mode);
        fs::set_permissions(&full_path, permissions)?;
        Ok(())
    }

    // ============ DISK USAGE ============
    
    pub fn disk_usage<P: AsRef<Path>>(&self, path: P) -> Result<DiskUsage> {
        let full_path = self.resolve(path);
        
        #[cfg(unix)]
        {
            let stat = nix::sys::statvfs::statvfs(&full_path)?;
            let total = stat.blocks() as u64 * stat.block_size() as u64;
            let available = stat.blocks_available() as u64 * stat.block_size() as u64;
            let used = total - available;
            
            Ok(DiskUsage {
                total,
                used,
                available,
            })
        }
        
        #[cfg(windows)]
        {
            let sys = sysinfo::System::new();
            let disks = sysinfo::Disks::new_with_refreshed_list();
            
            // Normalize path for comparison
            let full_path_str = full_path.to_string_lossy().to_lowercase();
            
            for disk in &disks {
                let mount_str = disk.mount_point().to_string_lossy().to_lowercase();
                if full_path_str.starts_with(&mount_str) {
                    let total = disk.total_space();
                    let available = disk.available_space();
                    return Ok(DiskUsage {
                        total,
                        used: total - available,
                        available,
                    });
                }
            }
            
            Err(anyhow::anyhow!("Could not determine disk usage for path: {:?}", full_path))
        }
        
        #[cfg(not(any(unix, windows)))]
        return Err(anyhow!("Disk usage not supported on this platform"));
    }

    // ============ ADVANCED OPERATIONS ============

    /// Extremely fast parallel directory usage calculation
    pub fn du<P: AsRef<Path>>(&self, path: P) -> Result<DuInfo> {
        let full_path = self.resolve(path);
        let entries: Vec<_> = WalkDir::new(&full_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .collect();

        let stats: (u64, u64, u64) = entries.par_iter().fold(
            || (0u64, 0u64, 0u64),
            |(mut size, mut files, mut dirs), entry| {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_dir() {
                        dirs += 1;
                    } else {
                        size += meta.len();
                        files += 1;
                    }
                }
                (size, files, dirs)
            },
        ).reduce(
            || (0, 0, 0),
            |a, b| (a.0 + b.0, a.1 + b.1, a.2 + b.2),
        );

        Ok(DuInfo {
            path: full_path.to_string_lossy().into_owned(),
            size: stats.0,
            file_count: stats.1,
            dir_count: stats.2,
        })
    }

    /// Mirrors source to destination (synchronize)
    pub fn mirror<P: AsRef<Path>, Q: AsRef<Path>>(&self, src: P, dest: Q) -> Result<()> {
        let source = self.resolve(src);
        let destination = self.resolve(dest);

        if !source.exists() {
            return Err(anyhow!("Source path does not exist"));
        }

        let mut options = fs_extra::dir::CopyOptions::new();
        options.overwrite = true;
        options.content_only = true;

        if source.is_dir() {
            if !destination.exists() {
                fs::create_dir_all(&destination)?;
            }
            fs_extra::dir::copy(&source, &destination, &options)?;
        } else {
            fs::copy(&source, &destination)?;
        }

        Ok(())
    }

    /// Finds duplicate files by hashing their content
    pub fn find_duplicates<P: AsRef<Path>>(&self, path: P) -> Result<Vec<DuplicateGroup>> {
        let full_path = self.resolve(path);
        let mut files_by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();

        for entry in WalkDir::new(&full_path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                if let Ok(meta) = entry.metadata() {
                    files_by_size.entry(meta.len()).or_default().push(entry.path().to_path_buf());
                }
            }
        }

        // Only hash files that have the same size
        let potential_duplicates: Vec<_> = files_by_size.into_values()
            .filter(|v| v.len() > 1)
            .flatten()
            .collect();

        // Capture only what is needed and make sure it is Send/Sync
        let hashes: Vec<(String, PathBuf, u64)> = potential_duplicates.par_iter()
            .filter_map(|p| {
                // Static-like hash calculation to avoid capturing self
                let hash = (|| -> Result<String> {
                    let mut file = fs::File::open(p)?;
                    let mut hasher = Sha256::new();
                    let mut buffer = [0; 8192];
                    loop {
                        let n = file.read(&mut buffer)?;
                        if n == 0 { break; }
                        hasher.update(&buffer[..n]);
                    }
                    Ok(format!("{:x}", hasher.finalize()))
                })().ok()?;

                let size = fs::metadata(p).ok()?.len();
                Some((hash, p.clone(), size))
            })
            .collect();

        let mut groups: HashMap<String, DuplicateGroup> = HashMap::new();
        for (hash, path, size) in hashes {
            let group = groups.entry(hash.clone()).or_insert(DuplicateGroup {
                hash,
                paths: Vec::new(),
                size,
            });
            group.paths.push(path.to_string_lossy().into_owned());
        }

        Ok(groups.into_values().filter(|g| g.paths.len() > 1).collect())
    }
}
