use std::process::Command;
use colored::Colorize;
use anyhow::{Result, Context};

pub async fn run() -> Result<()> {
    println!("{} Starting development server...", "🏃".green());
    let status = Command::new("npm")
        .arg("run")
        .arg("dev")
        .status()
        .context("Failed to start server (npm run dev)")?;

    if !status.success() {
        std::process::exit(status.code().unwrap_or(1));
    }

    Ok(())
}
