use anyhow::{Context, Result};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use serde_json::Value;

pub struct XyPrissFS {
    root: PathBuf,
}

impl XyPrissFS {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

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

    pub fn exists<P: AsRef<Path>>(&self, path: P) -> bool {
        self.resolve(path).exists()
    }

    pub fn is_dir<P: AsRef<Path>>(&self, path: P) -> bool {
        self.resolve(path).is_dir()
    }

    pub fn is_file<P: AsRef<Path>>(&self, path: P) -> bool {
        self.resolve(path).is_file()
    }

    pub fn is_empty<P: AsRef<Path>>(&self, path: P) -> bool {
        let full_path = self.resolve(path);
        if full_path.is_dir() {
            fs::read_dir(full_path).map(|mut d| d.next().is_none()).unwrap_or(true)
        } else {
            fs::metadata(full_path).map(|m| m.len() == 0).unwrap_or(true)
        }
    }

    pub fn read_file<P: AsRef<Path>>(&self, path: P) -> Result<String> {
        let full_path = self.resolve(path);
        fs::read_to_string(&full_path)
            .with_context(|| format!("Failed to read file: {:?}", full_path))
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

    pub fn write_file<P: AsRef<Path>>(&self, path: P, data: &str) -> Result<()> {
        let full_path = self.resolve(path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&full_path, data)
            .with_context(|| format!("Failed to write file: {:?}", full_path))
    }

    pub fn write_json<P: AsRef<Path>>(&self, path: P, data: &Value) -> Result<()> {
        let content = serde_json::to_string_pretty(data)?;
        self.write_file(path.as_ref(), &content)
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
}
