use anyhow::Result;
use crate::fs;
use crate::cli::{Cli, PathAction};
use crate::utils::print_output;

pub fn handle(action: PathAction, xfs: &fs::XyPrissFS, cli: &Cli) -> Result<()> {
    match action {
        PathAction::Resolve { paths } => {
            let mut result = xfs.get_root().clone();
            for p in paths {
                result = result.join(p);
            }
            let resolved = if result.exists() {
                result.canonicalize().unwrap_or(result)
            } else {
                result
            };
            print_output(&resolved.to_string_lossy(), cli.json, "path")?;
        }
        PathAction::Join { paths } => {
            let mut result = std::path::PathBuf::new();
            for p in paths {
                result.push(p);
            }
            print_output(&result.to_string_lossy(), cli.json, "path")?;
        }
        PathAction::Dirname { path } => {
            let p = std::path::Path::new(&path);
            let result = p.parent().map(|p| p.to_string_lossy()).unwrap_or_default().into_owned();
            print_output(&result, cli.json, "path")?;
        }
        PathAction::Basename { path, suffix } => {
            let p = std::path::Path::new(&path);
            let mut result = p.file_name().map(|s| s.to_string_lossy()).unwrap_or_default().into_owned();
            if let Some(s) = suffix {
                if result.ends_with(&s) {
                    result = result[..result.len() - s.len()].to_string();
                }
            }
            print_output(&result, cli.json, "path")?;
        }
        PathAction::Extname { path } => {
            let p = std::path::Path::new(&path);
            let result = p.extension().map(|s| format!(".{}", s.to_string_lossy())).unwrap_or_default();
            print_output(&result, cli.json, "path")?;
        }
        PathAction::Relative { from, to } => {
            let from_p = xfs.resolve(from);
            let to_p = xfs.resolve(to);
            let result = pathdiff::diff_paths(to_p, from_p).map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
            print_output(&result, cli.json, "path")?;
        }
        PathAction::Normalize { path } => {
            use std::path::Component;
            let p = std::path::Path::new(&path);
            let mut stack = Vec::new();
            for component in p.components() {
                match component {
                    Component::CurDir => {},
                    Component::ParentDir => { stack.pop(); },
                    Component::Normal(c) => { stack.push(c); },
                    _ => { stack.push(component.as_os_str()); }
                }
            }
            let result: std::path::PathBuf = stack.iter().collect();
            print_output(&result.to_string_lossy(), cli.json, "path")?;
        }
    }
    Ok(())
}
