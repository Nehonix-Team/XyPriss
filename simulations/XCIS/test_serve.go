package main

import (
	"fmt"
	"path/filepath"
)

func main() {
	filePath := "/home/idevo/Documents/projects/XyPriss/simulations/XCIS/public"
	cleanParam := filepath.Clean("/" + "texte.txt")
	joined := filepath.Join(filePath, cleanParam)
	fmt.Println("cleanParam:", cleanParam)
	fmt.Println("joined:", joined)
}
