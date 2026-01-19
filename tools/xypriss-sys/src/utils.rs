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

use anyhow::Result; 
use colored::*;
use indicatif::{ProgressBar, ProgressStyle};
use serde_json::json;
use std::time::Duration;
use crate::sys;
use crate::cli::Cli;

pub fn print_output<T: serde::Serialize>(data: &T, json: bool, _key: &str) -> Result<()> {
    if json {
        println!("{}", serde_json::to_string_pretty(&json!({ "status": "ok", "data": data }))?);
    } else {
        println!("{}", serde_json::to_string_pretty(data)?);
    }
    Ok(())
}

pub fn success_msg(msg: &str, cli: &Cli) -> Result<()> {
    if cli.json {
        println!("{}", json!({ "status": "ok", "message": msg }));
    } else if !cli.quiet {
        println!("{} {}", "✓".green().bold(), msg);
    }
    Ok(())
}

pub fn format_bool(b: bool) -> String {
    if b {
        "✓".green().to_string()
    } else {
        "✗".red().to_string()
    }
}

pub fn create_progress_bar(msg: &str) -> ProgressBar {
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.cyan} {msg}")
            .unwrap()
    );
    pb.set_message(msg.to_string());
    pb.enable_steady_tick(Duration::from_millis(100));
    pb
}

pub fn print_system_info(info: &sys::SysInfo, extended: bool) {
    println!("\n{}", "System Information".bold().cyan());
    println!("  Hostname:     {}", info.hostname.yellow());
    println!("  OS:           {} {}", info.os_name, info.os_version);
    println!("  Kernel:       {}", info.kernel_version);
    println!("  Architecture: {}", info.architecture);
    println!("  CPU:          {} ({} cores @ {} MHz)", 
        info.cpu_brand, info.cpu_count, info.cpu_frequency);
    println!("  Memory:       {} / {}", 
        sys::format_bytes(info.used_memory).yellow(),
        sys::format_bytes(info.total_memory));
    println!("  Uptime:       {}", sys::format_duration(info.uptime).green());
    
    if extended {
        println!("  Load Avg:     {:.2} {:.2} {:.2}", 
            info.load_average.one, 
            info.load_average.five, 
            info.load_average.fifteen);
    }
}

pub fn print_disk_info(disk: &sys::DiskInfo) {
    println!("\n{} {}", "💾".cyan(), disk.name.bold());
    println!("  Mount:      {}", disk.mount_point);
    println!("  Type:       {}", disk.file_system);
    println!("  Total:      {}", sys::format_bytes(disk.total_space));
    println!("  Used:       {} ({:.1}%)", 
        sys::format_bytes(disk.used_space).yellow(),
        disk.usage_percent);
    println!("  Available:  {}", sys::format_bytes(disk.available_space).green());
}

pub fn print_cpu_bar(core: usize, usage: f32) {
    let width = 30;
    let filled = ((usage / 100.0) * width as f32) as usize;
    let bar = "█".repeat(filled) + &"░".repeat(width - filled);
    
    let color = if usage > 80.0 { "red" } else if usage > 50.0 { "yellow" } else { "green" };
    println!("  Core {}: [{}] {:.1}%", core, bar.color(color), usage);
}
