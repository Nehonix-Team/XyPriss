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

package cli

import (
	"fmt"
	"os"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
)

const XyPrissLogo = `
  __   __      ____       _               
  \ \ / /_   _|  _ \ _ __(_)___ ___       
   \ V /| | | | |_) | '__| / __/ __|      
    | | | |_| |  __/| |  | \__ \__ \      
    |_|  \__, |_|   |_|  |_|___/___/      
         |___/                            
`

const RestrictedWarning = `*******************************************************************************
* NEHONIX INTERNAL TOOL - RESTRICTED ACCESS                                     *
* This software is the exclusive property of NEHONIX operations.              *
* Unauthorized use, distribution, or analysis is strictly prohibited.         *
*******************************************************************************`

func PrintRestrictedWarning() {
	red := color.New(color.FgRed, color.Bold)
	cyan := color.New(color.FgCyan, color.Bold)
	
	cyan.Fprint(os.Stderr, XyPrissLogo)
	red.Fprintln(os.Stderr, RestrictedWarning)
}

const InternalSignature = "b3f8e9a2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0"

var (
	jsonOutput bool
	rootPath   string
	verbose    bool
	quiet      bool
	signature  string
)

var rootCmd = &cobra.Command{
	Use:           "xsys-go",
	Short:         "XyPriss System (Go Implementation)",
	Long:          `A high-performance rewrite of the XyPriss System Core in Golang.`,
	SilenceErrors: true,
	SilenceUsage:  true,
}

func Execute() error {
	// Pre-parse flags manually to check for signature before Cobra Execute
	// This is because we want to know IF we should show the banner even on usage errors
	isInternal := false
	for i, arg := range os.Args {
		if (arg == "--signature") && i+1 < len(os.Args) {
			if os.Args[i+1] == InternalSignature {
				isInternal = true
			}
		}
	}

	rootCmd.SetHelpFunc(func(command *cobra.Command, strings []string) {
		if !isInternal {
			PrintRestrictedWarning()
			os.Exit(1)
		}
		command.Usage()
	})

	// Intercept lack of arguments or empty args
	if len(os.Args) <= 1 {
		if !isInternal {
			PrintRestrictedWarning()
			os.Exit(1)
		}
	}

	// Intercept --help or -h
	for _, arg := range os.Args {
		if arg == "--help" || arg == "-h" {
			if !isInternal {
				PrintRestrictedWarning()
				os.Exit(1)
			}
		}
	}

	if err := rootCmd.Execute(); err != nil {
		if !isInternal {
			// For public access, any error (even usage) triggers the warning banner
			PrintRestrictedWarning()
			fmt.Fprintf(os.Stderr, "\nError: %v\n", err)
		} else {
			// For internal access, just print the clean error
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		}
		os.Exit(1)
	}

	return nil
}

func init() {
	rootCmd.PersistentFlags().BoolVarP(&jsonOutput, "json", "j", false, "Output in JSON format")
	rootCmd.PersistentFlags().StringVar(&rootPath, "root", ".", "Root directory for operations")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose output")
	rootCmd.PersistentFlags().BoolVarP(&quiet, "quiet", "q", false, "Silence non-essential output")
	rootCmd.PersistentFlags().StringVar(&signature, "signature", "", "Internal access signature")
}
