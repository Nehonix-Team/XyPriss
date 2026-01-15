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

use std::path::{Path, PathBuf};
use std::time::Duration;
use anyhow::{Result, Context};
use colored::*;
use notify::{Watcher, RecursiveMode, EventKind, Event};
use std::fs;
use std::sync::mpsc::{channel, RecvTimeoutError};
use similar::{ChangeTag, TextDiff};

/// Représente un changement dans le contenu d'un fichier
#[derive(serde::Serialize, Debug, Clone)]
#[serde(tag = "type", content = "data")]
pub enum ContentChange {
    #[serde(rename = "added")]
    Added(String),
    #[serde(rename = "removed")]
    Removed(String),
    #[serde(rename = "modified")]
    Modified { 
        old_line: String, 
        new_line: String,
        line_number: usize 
    },
}

/// Configuration pour le watcher de contenu
#[derive(Debug, Clone)]
pub struct WatchConfig {
    pub duration: u64,
    pub show_diff: bool,
    pub is_json: bool,
    pub detailed_diff: bool,
    pub ignore_whitespace: bool,
    pub context_lines: usize,
}

impl Default for WatchConfig {
    fn default() -> Self {
        Self {
            duration: 60,
            show_diff: true,
            is_json: false,
            detailed_diff: true,
            ignore_whitespace: false,
            context_lines: 3,
        }
    }
}

/// Surveille les changements de contenu d'un fichier
pub fn watch_content<P: AsRef<Path>>(path: P, config: WatchConfig) -> Result<()> {
    let path = path.as_ref();
    
    validate_path(path)?;

    let mut old_content = read_file_safely(path)?;
    
    if !config.is_json {
        print_header(path, config.duration);
    }

    let (tx, rx) = channel();
    let path_clone = path.to_path_buf();
    
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        if let Ok(event) = res {
            let _ = tx.send(event);
        }
    })
    .context("Failed to create file watcher")?;

    watcher.watch(path, RecursiveMode::NonRecursive)
        .context("Failed to start watching file")?;

    let timeout = Duration::from_secs(config.duration);
    let start = std::time::Instant::now();
    let poll_interval = Duration::from_millis(100);

    let mut change_count = 0;

    while start.elapsed() < timeout {
        match rx.recv_timeout(poll_interval) {
            Ok(event) => {
                if should_process_event(&event) {
                    match process_file_change(
                        &path_clone,
                        &mut old_content,
                        &config,
                        &mut change_count
                    ) {
                        Ok(_) => {},
                        Err(e) => {
                            if !config.is_json {
                                eprintln!("{} Error processing change: {}", "⚠".yellow(), e);
                            }
                        }
                    }
                }
            }
            Err(RecvTimeoutError::Timeout) => continue,
            Err(RecvTimeoutError::Disconnected) => {
                return Err(anyhow::anyhow!("Watcher channel disconnected unexpectedly"));
            }
        }
    }

    if !config.is_json {
        println!("\n{} Content watch session ended ({} changes detected)", 
            "✓".green(), change_count);
    }

    Ok(())
}

/// Valide que le chemin est un fichier valide
fn validate_path(path: &Path) -> Result<()> {
    if !path.exists() {
        return Err(anyhow::anyhow!("Path does not exist: {}", path.display()));
    }
    
    if !path.is_file() {
        return Err(anyhow::anyhow!("Target must be a file for content watching: {}", path.display()));
    }
    
    Ok(())
}

/// Lit le fichier de manière sécurisée avec gestion d'erreurs
fn read_file_safely(path: &Path) -> Result<String> {
    fs::read_to_string(path)
        .with_context(|| format!("Failed to read file: {}", path.display()))
}

/// Affiche l'en-tête de la session de surveillance
fn print_header(path: &Path, duration: u64) {
    println!("{}", "═".repeat(60).cyan());
    println!("{} {} {}", 
        "📝".cyan(), 
        "File Content Watcher".bold().cyan(),
        "📝".cyan()
    );
    println!("{}", "═".repeat(60).cyan());
    println!("{}  {}", "File:".bold(), path.display());
    println!("{}  {}s", "Duration:".bold(), duration);
    println!("{}", "─".repeat(60).cyan());
    println!();
}

/// Détermine si un événement doit être traité
fn should_process_event(event: &Event) -> bool {
    matches!(event.kind, 
        EventKind::Modify(_) | 
        EventKind::Create(_) | 
        EventKind::Remove(_)
    )
}

/// Traite un changement de fichier détecté
fn process_file_change(
    path: &PathBuf,
    old_content: &mut String,
    config: &WatchConfig,
    change_count: &mut usize,
) -> Result<()> {
    // Petit délai pour laisser le système de fichiers se stabiliser (sauvegardes atomiques)
    std::thread::sleep(Duration::from_millis(50));
    
    let mut new_content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return Ok(()), // Le fichier peut être temporairement inaccessible
    };

    // Si le contenu est vide alors qu'il ne l'était pas, on attend encore un peu
    if new_content.is_empty() && !old_content.is_empty() {
        std::thread::sleep(Duration::from_millis(150));
        if let Ok(c) = fs::read_to_string(path) {
            if !c.is_empty() {
                new_content = c;
            }
        }
    }

    if content_differs(&old_content, &new_content, config.ignore_whitespace) {
        *change_count += 1;
        
        if config.show_diff && config.detailed_diff {
            display_detailed_diff(old_content, &new_content, config)?;
        } else if config.show_diff {
            display_simple_diff(old_content, &new_content, config)?;
        } else {
            display_change_notification(path, config)?;
        }
        
        *old_content = new_content;
    }
    
    Ok(())
}

/// Vérifie si deux contenus diffèrent
fn content_differs(old: &str, new: &str, ignore_whitespace: bool) -> bool {
    if ignore_whitespace {
        normalize_whitespace(old) != normalize_whitespace(new)
    } else {
        old != new
    }
}

/// Normalise les espaces blancs pour comparaison
fn normalize_whitespace(s: &str) -> String {
    s.lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

/// Affiche un diff détaillé utilisant l'algorithme Myers
fn display_detailed_diff(old: &str, new: &str, config: &WatchConfig) -> Result<()> {
    let diff = TextDiff::from_lines(old, new);
    
    if config.is_json {
        let changes = extract_changes_from_diff(&diff);
        for change in changes {
            println!("{}", serde_json::json!({
                "event": "content_change",
                "change": change,
                "timestamp": chrono::Local::now().to_rfc3339()
            }));
        }
    } else {
        println!("\n{}", "Changes detected:".bold().cyan());
        println!("{}", "─".repeat(60).dimmed());
        
        for change in diff.iter_all_changes() {
            let sign = match change.tag() {
                ChangeTag::Delete => "-",
                ChangeTag::Insert => "+",
                ChangeTag::Equal => " ",
            };
            
            match change.tag() {
                ChangeTag::Delete => {
                    print!("{}", format!("{} {}", sign, change).red());
                },
                ChangeTag::Insert => {
                    print!("{}", format!("{} {}", sign, change).green());
                },
                ChangeTag::Equal => {
                    // Les lignes inchangées s'affichent en BLEU comme demandé
                    print!("{}", format!("  {}", change).blue());
                }
            };
        }
        println!("{}", "─".repeat(60).dimmed());
        println!();
    }
    
    Ok(())
}

/// Extrait les changements d'un diff pour le format JSON
fn extract_changes_from_diff<'a>(diff: &TextDiff<'a, 'a, 'a, str>) -> Vec<ContentChange> {
    let mut changes = Vec::new();
    for change in diff.iter_all_changes() {
        match change.tag() {
            ChangeTag::Delete => {
                changes.push(ContentChange::Removed(change.to_string().trim_end().to_string()));
            }
            ChangeTag::Insert => {
                changes.push(ContentChange::Added(change.to_string().trim_end().to_string()));
            }
            ChangeTag::Equal => {}
        }
    }
    
    changes
}

/// Affiche un diff simple (ajout/suppression basique)
fn display_simple_diff(old: &str, new: &str, config: &WatchConfig) -> Result<()> {
    let changes = compute_simple_changes(old, new);
    
    for change in &changes {
        if config.is_json {
            println!("{}", serde_json::json!({
                "event": "content_change",
                "change": change,
                "timestamp": chrono::Local::now().to_rfc3339()
            }));
        } else {
            match change {
                ContentChange::Added(s) => {
                    println!("{} Added: {}", "+".green().bold(), s.trim());
                }
                ContentChange::Removed(s) => {
                    println!("{} Removed: {}", "-".red().bold(), s.trim());
                }
                ContentChange::Modified { old_line, new_line, line_number } => {
                    println!("{} Line {}: {} → {}", 
                        "~".yellow().bold(), 
                        line_number, 
                        old_line.trim().dimmed(), 
                        new_line.trim().cyan()
                    );
                }
            }
        }
    }
    
    Ok(())
}

/// Calcule les changements simples entre deux contenus
fn compute_simple_changes(old: &str, new: &str) -> Vec<ContentChange> {
    let mut changes = Vec::new();
    
    if new.len() > old.len() && new.starts_with(old) {
        changes.push(ContentChange::Added(new[old.len()..].to_string()));
    } else if old.len() > new.len() && old.starts_with(new) {
        changes.push(ContentChange::Removed(old[new.len()..].to_string()));
    } else {
        let old_lines: Vec<&str> = old.lines().collect();
        let new_lines: Vec<&str> = new.lines().collect();
        
        let min_len = old_lines.len().min(new_lines.len());
        
        for i in 0..min_len {
            if old_lines[i] != new_lines[i] {
                changes.push(ContentChange::Modified {
                    old_line: old_lines[i].to_string(),
                    new_line: new_lines[i].to_string(),
                    line_number: i + 1,
                });
            }
        }
        
        if new_lines.len() > old_lines.len() {
            changes.push(ContentChange::Added(
                new_lines[old_lines.len()..].join("\n")
            ));
        } else if old_lines.len() > new_lines.len() {
            changes.push(ContentChange::Removed(
                old_lines[new_lines.len()..].join("\n")
            ));
        }
    }
    
    changes
}

/// Affiche une simple notification de changement
fn display_change_notification(path: &PathBuf, config: &WatchConfig) -> Result<()> {
    if config.is_json {
        println!("{}", serde_json::json!({
            "event": "modified",
            "path": path.to_string_lossy(),
            "timestamp": chrono::Local::now().to_rfc3339()
        }));
    } else {
        println!("{} {} Content updated at {}", 
            "~".yellow().bold(),
            path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("file"),
            chrono::Local::now().format("%H:%M:%S").to_string().dimmed()
        );
    }
    
    Ok(())
}
