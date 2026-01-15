use anyhow::Result;
use colored::*;
use std::path::PathBuf;
use std::time::Duration;
use crate::fs;
use crate::sys;
use crate::advanced_watcher;
use crate::cli::{Cli, FsAction};
use crate::utils::{print_output, success_msg, create_progress_bar, format_bool};
use serde_json::json;

pub fn handle(action: FsAction, root: PathBuf, cli: &Cli) -> Result<()> {
    let mut xfs = fs::XyPrissFS::new(root)?;

    match action {
        FsAction::Ls { path, stats, recursive } => {
            if recursive {
                let entries = xfs.ls_recursive(&path);
                print_output(&entries, cli.json, "files")?;
            } else if stats {
                let entries = xfs.ls_with_stats(&path)?;
                print_output(&entries, cli.json, "stats")?;
                if !cli.json {
                    for (name, stat) in entries {
                        let size = sys::format_bytes(stat.size);
                        let dt = chrono::DateTime::from_timestamp(stat.modified as i64, 0).unwrap();
                        let modified = chrono::DateTime::<chrono::Local>::from(dt).format("%Y-%m-%d %H:%M:%S").to_string();
                        println!("{:<30} {:>12} {}", name.cyan(), size.yellow(), modified.dimmed());
                    }
                }
            } else {
                let entries = xfs.ls(&path)?;
                print_output(&entries, cli.json, "files")?;
            }
        }
        
        FsAction::Read { path, bytes } => {
            if bytes {
                let data = xfs.read_bytes(&path)?;
                print_output(&data, cli.json, "bytes")?;
                if !cli.json {
                    for chunk in data.chunks(16) {
                        for byte in chunk {
                            print!("{:02x} ", byte);
                        }
                        println!();
                    }
                }
            } else {
                let content = xfs.read_file(&path)?;
                print_output(&content, cli.json, "content")?;
            }
        }
        
        FsAction::Write { path, data, append } => {
            if append {
                xfs.append(&path, &data)?;
            } else {
                xfs.write_file(&path, &data)?;
            }
            success_msg("File written successfully", cli)?;
        }
        
        FsAction::Copy { src, dest, progress } => {
            if progress && !cli.json {
                let pb = create_progress_bar("Copying");
                xfs.copy(&src, &dest)?;
                pb.finish_with_message("✓ Copy complete");
            } else {
                xfs.copy(&src, &dest)?;
                success_msg("File copied successfully", cli)?;
            }
        }
        
        FsAction::Move { src, dest } => {
            xfs.move_item(&src, &dest)?;
            success_msg("File moved successfully", cli)?;
        }
        
        FsAction::Rm { path, force } => {
            if !force && !cli.json {
                print!("{} Remove '{}'? [y/N]: ", "⚠️".yellow(), path);
                use std::io::{self, Write};
                io::stdout().flush()?;
                let mut input = String::new();
                io::stdin().read_line(&mut input)?;
                if !input.trim().eq_ignore_ascii_case("y") {
                    println!("Cancelled");
                    return Ok(());
                }
            }
            xfs.remove(&path)?;
            success_msg("File removed successfully", cli)?;
        }
        
        FsAction::Mkdir { path, parents } => {
            if parents || true { // mkdir -p by default
                xfs.mkdir(&path)?;
            }
            success_msg("Directory created", cli)?;
        }
        
        FsAction::Touch { path } => {
            xfs.touch(&path)?;
            success_msg("File touched", cli)?;
        }
        
        FsAction::Stats { path } => {
            let stats = xfs.stats(&path)?;
            print_output(&stats, cli.json, "stats")?;
            if !cli.json {
                println!("{}", "File Statistics".bold().cyan());
                println!("  Size:        {}", sys::format_bytes(stats.size).yellow());
                println!("  Type:        {}", if stats.is_dir { "Directory" } else { "File" });
                
                let fmt_date = |ts: u64| -> String {
                    let dt = chrono::DateTime::from_timestamp(ts as i64, 0).unwrap();
                    chrono::DateTime::<chrono::Local>::from(dt).format("%Y-%m-%d %H:%M:%S").to_string()
                };

                println!("  Modified:    {}", fmt_date(stats.modified));
                println!("  Created:     {}", fmt_date(stats.created));
                println!("  Accessed:    {}", fmt_date(stats.accessed));
                println!("  Permissions: {:o}", stats.permissions);
                println!("  Symlink:     {}", stats.is_symlink);
            }
        }
        
        FsAction::Hash { path } => {
            if !cli.quiet {
                let pb = create_progress_bar("Hashing");
                let hash = xfs.hash_file(&path)?;
                pb.finish_and_clear();
                print_output(&hash, cli.json, "hash")?;
            } else {
                let hash = xfs.hash_file(&path)?;
                print_output(&hash, cli.json, "hash")?;
            }
        }
        
        FsAction::Verify { path, hash } => {
            let valid = xfs.verify_hash(&path, &hash)?;
            if cli.json {
                println!("{}", json!({ "valid": valid }));
            } else {
                if valid {
                    println!("{} Hash verified!", "✓".green().bold());
                } else {
                    println!("{} Hash mismatch!", "✗".red().bold());
                }
            }
        }
        
        FsAction::Size { path, human } => {
            let size = xfs.size(&path)?;
            if cli.json {
                println!("{}", json!({ "bytes": size, "formatted": sys::format_bytes(size) }));
            } else {
                if human {
                    println!("{}", sys::format_bytes(size).yellow().bold());
                } else {
                    println!("{} bytes", size);
                }
            }
        }
        
        FsAction::Link { src, dest } => {
            xfs.symlink(&src, &dest)?;
            success_msg("Symbolic link created", cli)?;
        }
        
        FsAction::Check { path } => {
            let exists = xfs.exists(&path);
            let readable = xfs.is_readable(&path);
            let writable = xfs.is_writable(&path);
            
            if cli.json {
                print_output(&json!({
                    "exists": exists,
                    "readable": readable,
                    "writable": writable
                }), true, "check")?;
            } else {
                println!("{} Exists:   {}", "•".cyan(), format_bool(exists));
                println!("{} Readable: {}", "•".cyan(), format_bool(readable));
                println!("{} Writable: {}", "•".cyan(), format_bool(writable));
            }
        }
        
        #[cfg(unix)]
        FsAction::Chmod { path, mode } => {
            let mode_num = u32::from_str_radix(&mode, 8)?;
            xfs.chmod(&path, mode_num)?;
            success_msg(&format!("Permissions changed to {}", mode), cli)?;
        }
        
        FsAction::Watch { paths, duration } => {
            let is_json = cli.json;
            if !is_json {
                println!("{} Watching {} paths for {} seconds...", "👁️".cyan(), paths.len(), duration);
            }
            
            let mut watch_ids = Vec::new();
            
            for path in &paths {
                let watch_id = xfs.watch(path, move |event| {
                    if is_json {
                        let (event_type, path_str, old_path) = match event {
                            fs::WatchEventType::Created(p) => ("created", p.to_string_lossy().to_string(), None),
                            fs::WatchEventType::Modified(p) => ("modified", p.to_string_lossy().to_string(), None),
                            fs::WatchEventType::Deleted(p) => ("deleted", p.to_string_lossy().to_string(), None),
                            fs::WatchEventType::Renamed(old, new) => ("renamed", new.to_string_lossy().to_string(), Some(old.to_string_lossy().to_string())),
                        };
                        
                        println!("{}", serde_json::json!({
                            "event": event_type,
                            "path": path_str,
                            "old_path": old_path,
                            "timestamp": chrono::Local::now().to_rfc3339()
                        }));
                    } else {
                        match event {
                            fs::WatchEventType::Created(p) => {
                                println!("{} Created: {}", "✓".green(), p.display());
                            }
                            fs::WatchEventType::Modified(p) => {
                                println!("{} Modified: {}", "~".yellow(), p.display());
                            }
                            fs::WatchEventType::Deleted(p) => {
                                println!("{} Deleted: {}", "✗".red(), p.display());
                            }
                            fs::WatchEventType::Renamed(old, new) => {
                                println!("{} Renamed: {} -> {}", "→".blue(), old.display(), new.display());
                            }
                        }
                    }
                })?;
                watch_ids.push(watch_id);
            }
            
            std::thread::sleep(Duration::from_secs(duration));
            
            for id in watch_ids {
                let _ = xfs.unwatch(&id);
            }
            
            if !cli.json {
                println!("{} Watch ended", "✓".green());
            }
        }
        
        FsAction::WatchContent { paths, duration, diff } => {
            let config = advanced_watcher::WatchConfig {
                duration,
                show_diff: diff,
                is_json: cli.json,
                ..Default::default()
            };
            
            let mut handles = Vec::new();
            for path in paths {
                let cfg = config.clone();
                let handle = std::thread::spawn(move || {
                    let _ = advanced_watcher::watch_content(path, cfg);
                });
                handles.push(handle);
            }
            
            for handle in handles {
                let _ = handle.join();
            }
        }
        
        FsAction::Stream { path, chunk_size, hex } => {
            use std::io::Read;
            
            if !cli.quiet {
                println!("{} Streaming '{}' (chunk size: {} bytes)...", 
                    "📡".cyan(), path, chunk_size);
            }
            
            let mut reader = xfs.read_stream(&path)?;
            let mut buffer = vec![0u8; chunk_size];
            let mut total_bytes = 0u64;
            let mut chunk_count = 0usize;
            
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        total_bytes += n as u64;
                        chunk_count += 1;
                        
                        if cli.json {
                            let chunk_data = if hex {
                                buffer[..n].iter()
                                    .map(|b| format!("{:02x}", b))
                                    .collect::<Vec<_>>()
                                    .join(" ")
                            } else {
                                String::from_utf8_lossy(&buffer[..n]).to_string()
                            };
                            
                            println!("{}", serde_json::json!({
                                "chunk": chunk_count,
                                "size": n,
                                "data": chunk_data
                            }));
                        } else {
                            if hex {
                                for (i, byte) in buffer[..n].iter().enumerate() {
                                    if i % 16 == 0 && i > 0 {
                                        println!();
                                    }
                                    print!("{:02x} ", byte);
                                }
                                if n % 16 != 0 {
                                    println!();
                                }
                            } else {
                                print!("{}", String::from_utf8_lossy(&buffer[..n]));
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("{} Stream error: {}", "✗".red(), e);
                        break;
                    }
                }
            }
            
            if !cli.quiet && !cli.json {
                println!("\n{} Streamed {} bytes in {} chunks", 
                    "✓".green(), total_bytes, chunk_count);
            }
        }
        
        FsAction::Du { path } => {
            let info = xfs.du(&path)?;
            print_output(&info, cli.json, "du")?;
            if !cli.json {
                println!("{} Path: {}", "📂".cyan(), info.path);
                println!("   Size: {}", sys::format_bytes(info.size).yellow());
                println!("   Files: {} | Dirs: {}", info.file_count, info.dir_count);
            }
        }
        
        FsAction::Sync { src, dest } => {
            xfs.mirror(&src, &dest)?;
            success_msg("Sync complete", cli)?;
        }
        
        FsAction::Dedupe { path } => {
            let groups = xfs.find_duplicates(&path)?;
            print_output(&groups, cli.json, "duplicates")?;
            if !cli.json {
                if groups.is_empty() {
                    println!("{} No duplicates found.", "✓".green());
                } else {
                    for group in groups {
                        println!("\n{} Hash: {}", "📝".yellow(), group.hash.dimmed());
                        println!("   Size: {}", sys::format_bytes(group.size));
                        for p in group.paths {
                            println!("   - {}", p);
                        }
                    }
                }
            }
        }
    }

    Ok(())
}
