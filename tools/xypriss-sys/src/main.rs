/* *****************************************************************************
 * Nehonix XyPriss System CLI
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

mod fs;
mod sys;
mod advanced_watcher;
mod server;
mod cli;
mod utils;
mod handlers;

use clap::Parser;
use anyhow::Result;
use cli::{Cli, Commands, print_restricted_warning};

fn main() -> Result<()> {
    let cli_result = Cli::try_parse();

    match cli_result {
        Ok(cli) => {
            let root = cli.root.clone().unwrap_or_else(|| std::env::current_dir().unwrap());
            
            match cli.command.clone() {
                Commands::Fs { action } => handlers::fs::handle(action, root, &cli)?,
                Commands::Sys { action } => handlers::sys::handle(action, &cli)?,
                Commands::Search { action } => handlers::search::handle(action, root, &cli)?,
                Commands::Monitor { action } => handlers::monitor::handle(action, &cli)?,
                Commands::Archive { action } => handlers::archive::handle(action, root, &cli)?,
                Commands::Path { action } => {
                    let xfs = fs::XyPrissFS::new(root)?;
                    handlers::path::handle(action, &xfs, &cli)?;
                },
                Commands::Server { action } => {
                    server::handle_server_action(action, root, &cli)?;
                }
            }
        },
        Err(_) => {
            // Replaces ALL help/usage/error output from clap with our warning
            print_restricted_warning();
            std::process::exit(1);
        }
    }

    Ok(())
}
