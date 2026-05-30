package main
import (
	"fmt"
	"path/filepath"
)
func main() {
	fmt.Println(filepath.Join("/var/www", "/etc/passwd"))
}
