package main

import (
	"log"
	"net/http"
	"path/filepath"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Req path: %s", r.URL.Path)
		filePath := "/chemin/vers/XyPriss/simulations/XCIS/public"
		filepathParam := "texte.txt" // Mocked params["filepath"]
		cleanParam := filepath.Clean("/" + filepathParam)
		filePath = filepath.Join(filePath, cleanParam)
		log.Printf("Serving: %s", filePath)
		http.ServeFile(w, r, filePath)
	})
	log.Println("Listening on :8099")
	http.ListenAndServe(":8099", nil)
}
