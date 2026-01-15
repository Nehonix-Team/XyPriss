use anyhow::Result;
use std::path::PathBuf;
use crate::fs;
use crate::cli::{Cli, ArchiveAction};
use crate::utils::create_progress_bar;

pub fn handle(action: ArchiveAction, root: PathBuf, _cli: &Cli) -> Result<()> {
    let xfs = fs::XyPrissFS::new(root)?;

    match action {
        ArchiveAction::Compress { src, dest } => {
            let pb = create_progress_bar("Compressing");
            xfs.compress_gzip(&src, &dest)?;
            pb.finish_with_message("✓ Compression complete");
        }
        
        ArchiveAction::Decompress { src, dest } => {
            let pb = create_progress_bar("Decompressing");
            xfs.decompress_gzip(&src, &dest)?;
            pb.finish_with_message("✓ Decompression complete");
        }
        
        ArchiveAction::Tar { dir, output } => {
            let pb = create_progress_bar("Creating archive");
            xfs.create_tar(&dir, &output)?;
            pb.finish_with_message("✓ Archive created");
        }
        
        ArchiveAction::Untar { archive, dest } => {
            let pb = create_progress_bar("Extracting");
            xfs.extract_tar(&archive, &dest)?;
            pb.finish_with_message("✓ Extraction complete");
        }
    }

    Ok(())
}
