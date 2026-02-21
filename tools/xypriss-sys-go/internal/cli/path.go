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
	"log"
	"os"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/handlers"
	"github.com/spf13/cobra"
)

var pathCmd = &cobra.Command{
	Use:   "path",
	Short: "Path manipulation utilities",
}

func getPathHandler() *handlers.PathHandler {
	targetRoot := rootPath
	if targetRoot == "" || targetRoot == "." {
		pwd, _ := os.Getwd()
		targetRoot = pwd
	}
	return handlers.NewPathHandler(targetRoot)
}

var (
	suffix string
	from   string
	to     string
)

var resolveCmd = &cobra.Command{
	Use:   "resolve [paths...]",
	Short: "Resolve absolute path",
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getPathHandler().Resolve(args...)
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		fmt.Println(res)
	},
}

var joinCmd = &cobra.Command{
	Use:   "join [paths...]",
	Short: "Join path segments",
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getPathHandler().Join(args...)
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		fmt.Println(res)
	},
}

var basenameCmd = &cobra.Command{
	Use:   "basename [path] [suffix]",
	Short: "Get base name",
	Args:  cobra.RangeArgs(1, 2),
	Run: func(cmd *cobra.Command, args []string) {
		p := args[0]
		s := suffix
		if len(args) > 1 {
			s = args[1]
		}
		res, err := getPathHandler().Basename(p, s)
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		fmt.Println(res)
	},
}

var dirnameCmd = &cobra.Command{
	Use:   "dirname [path]",
	Short: "Get directory name",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getPathHandler().Dirname(args[0])
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		fmt.Println(res)
	},
}

var extnameCmd = &cobra.Command{
	Use:   "extname [path]",
	Short: "Get file extension",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getPathHandler().Extname(args[0])
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		fmt.Println(res)
	},
}

var relativeCmd = &cobra.Command{
	Use:   "relative [from] [to]",
	Short: "Get relative path",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getPathHandler().Relative(args[0], args[1])
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		fmt.Println(res)
	},
}

var normalizeCmd = &cobra.Command{
	Use:   "normalize [path]",
	Short: "Normalize path",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getPathHandler().Normalize(args[0])
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		fmt.Println(res)
	},
}

func init() {
	basenameCmd.Flags().StringVarP(&suffix, "suffix", "s", "", "Suffix to remove")

	pathCmd.AddCommand(resolveCmd)
	pathCmd.AddCommand(joinCmd)
	pathCmd.AddCommand(basenameCmd)
	pathCmd.AddCommand(dirnameCmd)
	pathCmd.AddCommand(extnameCmd)
	pathCmd.AddCommand(relativeCmd)
	pathCmd.AddCommand(normalizeCmd)
	rootCmd.AddCommand(pathCmd)
}
