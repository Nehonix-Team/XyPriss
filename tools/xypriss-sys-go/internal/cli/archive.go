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
	"log"
	"os"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/handlers"
	"github.com/spf13/cobra"
)

var archiveCmd = &cobra.Command{
	Use:   "archive",
	Short: "Archive and compression operations",
}

func getArchiveHandler() *handlers.ArchiveHandler {
	targetRoot := rootPath
	if targetRoot == "" || targetRoot == "." {
		pwd, _ := os.Getwd()
		targetRoot = pwd
	}
	return handlers.NewArchiveHandler(targetRoot)
}

var (
	srcFile     string
	destFile    string
	dirPath     string
	outputFile  string
	archiveFile string
	extractDest string
)

var compressCmd = &cobra.Command{
	Use:   "compress",
	Short: "Compress file (Gzip)",
	Run: func(cmd *cobra.Command, args []string) {
		if err := getArchiveHandler().Compress(srcFile, destFile); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var decompressCmd = &cobra.Command{
	Use:   "decompress",
	Short: "Decompress file (Gzip)",
	Run: func(cmd *cobra.Command, args []string) {
		if err := getArchiveHandler().Decompress(srcFile, destFile); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var tarCmd = &cobra.Command{
	Use:   "tar",
	Short: "Create TAR archive",
	Run: func(cmd *cobra.Command, args []string) {
		if err := getArchiveHandler().Tar(outputFile, []string{dirPath}); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var untarCmd = &cobra.Command{
	Use:   "untar",
	Short: "Extract TAR archive",
	Run: func(cmd *cobra.Command, args []string) {
		if err := getArchiveHandler().Untar(archiveFile, extractDest); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var zipCmd = &cobra.Command{
	Use:   "zip [dest] [src...]",
	Short: "Create ZIP archive",
	Args:  cobra.MinimumNArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		if err := getArchiveHandler().Zip(args[0], args[1:]); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var unzipCmd = &cobra.Command{
	Use:   "unzip [src] [dest]",
	Short: "Extract ZIP archive",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		if err := getArchiveHandler().Unzip(args[0], args[1]); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

func init() {
	compressCmd.Flags().StringVarP(&srcFile, "src", "s", "", "Source file")
	compressCmd.Flags().StringVarP(&destFile, "dest", "d", "", "Destination file")
	decompressCmd.Flags().StringVarP(&srcFile, "src", "s", "", "Source file")
	decompressCmd.Flags().StringVarP(&destFile, "dest", "d", "", "Destination file")
	tarCmd.Flags().StringVarP(&dirPath, "dir", "d", "", "Directory to archive")
	tarCmd.Flags().StringVarP(&outputFile, "output", "o", "", "Output file")
	untarCmd.Flags().StringVarP(&archiveFile, "archive", "a", "", "Archive file")
	untarCmd.Flags().StringVarP(&extractDest, "dest", "d", "", "Destination directory")

	archiveCmd.AddCommand(compressCmd)
	archiveCmd.AddCommand(decompressCmd)
	archiveCmd.AddCommand(tarCmd)
	archiveCmd.AddCommand(untarCmd)
	archiveCmd.AddCommand(zipCmd)
	archiveCmd.AddCommand(unzipCmd)
	rootCmd.AddCommand(archiveCmd)
}
