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
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/handlers"
	"github.com/spf13/cobra"
)

var searchCmd = &cobra.Command{
	Use:   "search",
	Short: "File search and manipulation",
}

func getSearchHandler() *handlers.SearchHandler {
	targetRoot := rootPath
	if targetRoot == "" || targetRoot == "." {
		pwd, _ := os.Getwd()
		targetRoot = pwd
	}
	return handlers.NewSearchHandler(targetRoot)
}

var (
	pattern     string
	hours       uint64
	ignoreCase  bool
	replacement string
	dryRun      bool
)

var findCmd = &cobra.Command{
	Use:   "find [path]",
	Short: "Find files matching pattern",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		results, err := getSearchHandler().Find(args[0], pattern)
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		if jsonOutput {
			data, _ := json.MarshalIndent(results, "", "  ")
			fmt.Println(string(data))
		} else {
			for _, r := range results {
				fmt.Println(r)
			}
		}
	},
}

var grepCmd = &cobra.Command{
	Use:   "grep [path] [pattern]",
	Short: "Search for pattern inside files",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		// Currently ignoreCase is not implemented in core but could be added to regex
		results, err := getSearchHandler().Grep(args[0], args[1])
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		if jsonOutput {
			data, _ := json.MarshalIndent(results, "", "  ")
			fmt.Println(string(data))
		} else {
			for file, lines := range results {
				fmt.Printf("\n%s:\n", file)
				for _, line := range lines {
					fmt.Printf("  %s\n", line)
				}
			}
		}
	},
}

var modifiedCmd = &cobra.Command{
	Use:   "modified [path]",
	Short: "Find modified files",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		results, err := getSearchHandler().ModifiedSince(args[0], hours)
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		if jsonOutput {
			data, _ := json.MarshalIndent(results, "", "  ")
			fmt.Println(string(data))
		} else {
			for _, r := range results {
				fmt.Println(r)
			}
		}
	},
}

var renameCmd = &cobra.Command{
	Use:   "rename [path] [pattern] [replacement]",
	Short: "Batch rename files",
	Args:  cobra.ExactArgs(3),
	Run: func(cmd *cobra.Command, args []string) {
		count, err := getSearchHandler().Rename(args[0], args[1], args[2])
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		if jsonOutput {
			fmt.Printf("{\"renamed\": %d}\n", count)
		} else {
			fmt.Printf("Renamed %d files\n", count)
		}
	},
}

func init() {
	findCmd.Flags().StringVarP(&pattern, "pattern", "p", "", "Regex pattern")
	modifiedCmd.Flags().Uint64VarP(&hours, "hours", "H", 24, "Hours ago")
	grepCmd.Flags().BoolVarP(&ignoreCase, "ignore-case", "i", false, "Ignore case")
	renameCmd.Flags().BoolVarP(&dryRun, "dry-run", "n", false, "Dry run")

	searchCmd.AddCommand(findCmd)
	searchCmd.AddCommand(grepCmd)
	searchCmd.AddCommand(modifiedCmd)
	searchCmd.AddCommand(renameCmd)
	rootCmd.AddCommand(searchCmd)
}
