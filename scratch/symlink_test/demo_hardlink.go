package main

import (
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	dir, err := os.Getwd()
	if err != nil {
		fmt.Printf("Erreur getwd: %v\n", err)
		return
	}

	decoyFile := filepath.Join(dir, "falsified_decoy.env")
	envFile := filepath.Join(dir, ".env")

	// 1. Supprimer l'ancien lien s'il existe
	os.Remove(envFile)

	// 2. Créer un Hard Link au lieu d'un lien symbolique
	// Un Hardlink pointe directement sur le même inode sur le disque
	err = os.Link(decoyFile, envFile)
	if err != nil {
		fmt.Printf("❌ Erreur création Hardlink: %v\n", err)
		return
	}

	fmt.Println("=== TEST 1 : COMPORTEMENT DU HARD LINK ===")
	fmt.Printf("Fichier créé : %s\n\n", envFile)

	// Inspection du fichier
	fi, err := os.Lstat(envFile)
	if err != nil {
		fmt.Printf("Erreur lstat: %v\n", err)
		return
	}

	isSymlink := fi.Mode()&os.ModeSymlink != 0
	fmt.Printf("1. Est-ce un lien symbolique pour l'OS ? -> %v\n", isSymlink)

	target, readlinkErr := os.Readlink(envFile)
	if readlinkErr != nil {
		fmt.Printf("2. Lecture du lien (readlink)           -> ÉCHOUÉE (%v)\n", readlinkErr)
		fmt.Println("   👉 Pour l'OS et n'importe quel binaire, c'est un VRAI fichier ordinaire !")
	} else {
		fmt.Printf("2. Cible du lien                       -> %s\n", target)
	}

	// Lecture du contenu
	data, _ := os.ReadFile(envFile)
	fmt.Printf("\n3. Contenu lu par n'importe quel binaire :\n")
	fmt.Println("--------------------------------------------------")
	fmt.Println(string(data))
	fmt.Println("--------------------------------------------------")
}
