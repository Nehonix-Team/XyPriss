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
	"time"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/handlers"
	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/watcher"
	"github.com/spf13/cobra"
)

var fsCmd = &cobra.Command{
	Use:   "fs",
	Short: "FileSystem operations",
}

func getFsHandler() *handlers.FsHandler {
	// Use rootPath from root command
	targetRoot := rootPath
	if targetRoot == "" || targetRoot == "." {
		pwd, _ := os.Getwd()
		targetRoot = pwd
	}
	return handlers.NewFsHandler(targetRoot)
}

var (
	recursive bool
	stats     bool
	bytes     bool
	appendData bool
	parents   bool
	force     bool
	human     bool
	duration  uint64
	diff      bool
	chunkSize int
	hexOutput bool
)

var lsCmd = &cobra.Command{
	Use:   "ls [path]",
	Short: "List directory contents",
	Run: func(cmd *cobra.Command, args []string) {
		path := "."
		if len(args) > 0 {
			path = args[0]
		}
		res, err := getFsHandler().Ls(path, recursive, stats)
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		if jsonOutput {
			data, _ := json.MarshalIndent(res, "", "  ")
			fmt.Println(string(data))
		} else {
			if stats {
				items := res.([][2]interface{})
				for _, item := range items {
					fmt.Printf("%v %+v\n", item[0], item[1])
				}
			} else {
				items := res.([]string)
				for _, item := range items {
					fmt.Println(item)
				}
			}
		}
	},
}

var readCmd = &cobra.Command{
	Use:   "read [path]",
	Short: "Read file content",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getFsHandler().ReadFile(args[0], bytes)
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		if jsonOutput {
			data, _ := json.Marshal(map[string]interface{}{"data": res})
			fmt.Println(string(data))
		} else {
			fmt.Print(res)
		}
	},
}

var writeCmd = &cobra.Command{
	Use:   "write [path] [data]",
	Short: "Write data to file",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		if err := getFsHandler().WriteFile(args[0], args[1], appendData); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var copyCmd = &cobra.Command{
	Use:   "copy [src] [dest]",
	Short: "Copy file or directory",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		if err := getFsHandler().Copy(args[0], args[1]); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var moveCmd = &cobra.Command{
	Use:   "move [src] [dest]",
	Short: "Move or rename file or directory",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		if err := getFsHandler().Move(args[0], args[1]); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var rmCmd = &cobra.Command{
	Use:   "rm [path]",
	Short: "Remove a file or directory",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		if err := getFsHandler().Remove(args[0], force); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var mkdirCmd = &cobra.Command{
	Use:   "mkdir [path]",
	Short: "Create a directory",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		if err := getFsHandler().Mkdir(args[0], parents); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var touchCmd = &cobra.Command{
	Use:   "touch [path]",
	Short: "Create an empty file / Update timestamp",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		if err := getFsHandler().Touch(args[0]); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var statsCmd = &cobra.Command{
	Use:   "stats [path]",
	Short: "Get file statistics",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getFsHandler().Stats(args[0])
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		if jsonOutput {
			data, _ := json.MarshalIndent(res, "", "  ")
			fmt.Println(string(data))
		} else {
			fmt.Printf("%+v\n", res)
		}
	},
}

var hashCmd = &cobra.Command{
	Use:   "hash [path]",
	Short: "Calculate file SHA-256",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getFsHandler().Hash(args[0])
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		if jsonOutput {
			data, _ := json.Marshal(map[string]string{"hash": res})
			fmt.Println(string(data))
		} else {
			fmt.Println(res)
		}
	},
}

var verifyCmd = &cobra.Command{
	Use:   "verify [path] [hash]",
	Short: "Verify file integrity",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getFsHandler().Verify(args[0], args[1])
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		data, _ := json.Marshal(res)
		fmt.Println(string(data))
	},
}

var sizeCmd = &cobra.Command{
	Use:   "size [path]",
	Short: "Get file/directory size",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getFsHandler().Size(args[0], human)
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		if jsonOutput {
			data, _ := json.Marshal(res)
			fmt.Println(string(data))
		} else {
			fmt.Println(res.Formatted)
		}
	},
}

var linkCmd = &cobra.Command{
	Use:   "link [src] [dest]",
	Short: "Create symbolic link",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		if err := getFsHandler().Link(args[0], args[1]); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var checkCmd = &cobra.Command{
	Use:   "check [path]",
	Short: "Check path status",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res := getFsHandler().Check(args[0])
		data, _ := json.Marshal(res)
		fmt.Println(string(data))
	},
}

var chmodCmd = &cobra.Command{
	Use:   "chmod [path] [mode]",
	Short: "Change file permissions",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		if err := getFsHandler().Chmod(args[0], args[1]); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var duCmd = &cobra.Command{
	Use:   "du [path]",
	Short: "Get directory usage",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getFsHandler().Du(args[0])
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		if jsonOutput {
			data, _ := json.MarshalIndent(res, "", "  ")
			fmt.Println(string(data))
		} else {
			fmt.Printf("Size: %d B, Files: %d, Dirs: %d\n", res.Size, res.FileCount, res.DirCount)
		}
	},
}

var syncCmd = &cobra.Command{
	Use:   "sync [src] [dest]",
	Short: "Synchronize directories",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		if err := getFsHandler().Sync(args[0], args[1]); err != nil {
			log.Fatalf("Error: %v", err)
		}
	},
}

var dedupeCmd = &cobra.Command{
	Use:   "dedupe [path]",
	Short: "Find duplicate files",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getFsHandler().Dedupe(args[0])
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		data, _ := json.MarshalIndent(res, "", "  ")
		fmt.Println(string(data))
	},
}

var watchCmd = &cobra.Command{
	Use:   "watch [paths...]",
	Short: "Watch path for changes (real-time)",
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) == 0 {
			args = []string{"."}
		}

		w, err := watcher.NewXyWatcher()
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		defer w.Close()

		done := make(chan bool)
		for _, p := range args {
			// Resolve path to absolute for consistency
			absPath := getFsHandler().Resolve(p)
			err := w.Watch(absPath, func(e watcher.WatchEvent) {
				if jsonOutput {
					data, _ := json.Marshal(e)
					fmt.Println(string(data))
				} else {
					fmt.Printf("%s: %s\n", e.Type, e.Path)
				}
				done <- true
			})
			if err != nil {
				log.Printf("Warning: Failed to watch %s: %v", p, err)
			}
		}

		select {
		case <-done:
			// Event received, exit to trigger JS callback
		case <-time.After(time.Duration(duration) * time.Second):
			// Timeout reached
		}
	},
}

var streamCmd = &cobra.Command{
	Use:   "stream [path]",
	Short: "Stream file content",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := getFsHandler().Stream(args[0], chunkSize, hexOutput)
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		fmt.Print(res)
	},
}

var watchContentCmd = &cobra.Command{
	Use:   "watch-content [paths...]",
	Short: "Watch file content for changes (real-time)",
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) == 0 {
			args = []string{"."}
		}

		w, err := watcher.NewXyWatcher()
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		defer w.Close()

		done := make(chan bool)
		for _, p := range args {
			absPath := getFsHandler().Resolve(p)
			err := w.Watch(absPath, func(e watcher.WatchEvent) {
				if e.Type == watcher.EventModified {
					if jsonOutput {
						data, _ := json.Marshal(e)
						fmt.Println(string(data))
					} else {
						fmt.Printf("%s: %s\n", e.Type, e.Path)
					}
					done <- true
				}
			})
			if err != nil {
				log.Printf("Warning: Failed to watch %s: %v", p, err)
			}
		}

		select {
		case <-done:
		case <-time.After(time.Duration(duration) * time.Second):
		}
	},
}

func init() {
	lsCmd.Flags().BoolVarP(&recursive, "recursive", "r", false, "Recursive listing")
	lsCmd.Flags().BoolVarP(&stats, "stats", "s", false, "Include stats")
	readCmd.Flags().BoolVarP(&bytes, "bytes", "b", false, "Read as bytes")
	writeCmd.Flags().BoolVarP(&appendData, "append", "a", false, "Append data")
	mkdirCmd.Flags().BoolVarP(&parents, "parents", "p", false, "Create parent directories")
	rmCmd.Flags().BoolVarP(&force, "force", "f", false, "Force removal")
	sizeCmd.Flags().BoolVarP(&human, "human", "H", false, "Human readable format")
	watchCmd.Flags().Uint64VarP(&duration, "duration", "d", 60, "Watch duration")
	watchContentCmd.Flags().Uint64VarP(&duration, "duration", "d", 60, "Watch duration")
	watchContentCmd.Flags().BoolVar(&diff, "diff", false, "Show diff (not fully implemented)")
	streamCmd.Flags().IntVarP(&chunkSize, "chunk-size", "c", 8192, "Chunk size")
	streamCmd.Flags().BoolVar(&hexOutput, "hex", false, "Hex output")

	fsCmd.AddCommand(lsCmd)
	fsCmd.AddCommand(readCmd)
	fsCmd.AddCommand(writeCmd)
	fsCmd.AddCommand(copyCmd)
	fsCmd.AddCommand(moveCmd)
	fsCmd.AddCommand(rmCmd)
	fsCmd.AddCommand(mkdirCmd)
	fsCmd.AddCommand(touchCmd)
	fsCmd.AddCommand(statsCmd)
	fsCmd.AddCommand(hashCmd)
	fsCmd.AddCommand(verifyCmd)
	fsCmd.AddCommand(sizeCmd)
	fsCmd.AddCommand(linkCmd)
	fsCmd.AddCommand(checkCmd)
	fsCmd.AddCommand(chmodCmd)
	fsCmd.AddCommand(duCmd)
	fsCmd.AddCommand(syncCmd)
	fsCmd.AddCommand(dedupeCmd)
	fsCmd.AddCommand(watchCmd)
	fsCmd.AddCommand(watchContentCmd)
	fsCmd.AddCommand(streamCmd)
	rootCmd.AddCommand(fsCmd)
}
