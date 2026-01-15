use anyhow::Result;
use colored::*;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};
use crate::fs;
use crate::cli::{Cli, SearchAction};
use crate::utils::{print_output, success_msg, create_progress_bar};

pub fn handle(action: SearchAction, root: PathBuf, cli: &Cli) -> Result<()> {
    let xfs = fs::XyPrissFS::new(root)?;

    match action {
        SearchAction::Find { path, pattern } => {
            let results = xfs.find(&path, &pattern)?;
            print_output(&results, cli.json, "results")?;
        }
        
        SearchAction::Ext { path, extension } => {
            let results = xfs.find_by_extension(&path, &extension);
            print_output(&results, cli.json, "results")?;
        }
        
        SearchAction::Modified { path, hours } => {
            let since = SystemTime::now() - Duration::from_secs(hours * 3600);
            let results = xfs.find_modified_since(&path, since);
            print_output(&results, cli.json, "results")?;
        }
        
        SearchAction::Grep { path, pattern, ignore_case } => {
            let pattern = if ignore_case {
                format!("(?i){}", pattern)
            } else {
                pattern
            };
            let results = xfs.grep(&path, &pattern)?;
            print_output(&results, cli.json, "grep")?;
            if !cli.json {
                for (file, lines) in results {
                    println!("\n{}", file.display().to_string().cyan().bold());
                    for line in lines {
                        println!("  {}", line);
                    }
                }
            }
        }
        
        SearchAction::Rename { path, pattern, replacement, dry_run } => {
            if dry_run {
                println!("{} Dry run - no changes will be made", "ℹ".blue());
                let changes = xfs.preview_batch_rename(&path, &pattern, &replacement)?;
                if cli.json {
                    println!("{}", serde_json::to_string_pretty(&changes)?);
                } else {
                    for (old, new) in changes {
                        println!("  {} -> {}", 
                            old.display().to_string().red(), 
                            new.display().to_string().green());
                    }
                }
            } else {
                let pb = create_progress_bar("Renaming files");
                let count = xfs.batch_rename(&path, &pattern, &replacement)?;
                pb.finish_and_clear();
                success_msg(&format!("Successfully renamed {} files", count), cli)?;
            }
        }
    }

    Ok(())
}
