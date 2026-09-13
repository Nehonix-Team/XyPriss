package main

import (
	"bufio"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// Ce script démontre comment le superviseur Go (xfpm/XHSC) orchestre la protection :
// 1. Avant le démarrage : .env contient vos vrais secrets.
// 2. Pendant que le serveur tourne : .env est remplacé par le leurre (falsifié).
// 3. À l'arrêt (Ctrl+C ou fin de process) : le vrai .env est immédiatement restauré !
func main() {
	dir, err := os.Getwd()
	if err != nil {
		fmt.Printf("Erreur: %v\n", err)
		return
	}

	envFile := filepath.Join(dir, ".env")
	realSecretFile := filepath.Join(dir, "real_secret.env")
	decoyFile := filepath.Join(dir, "falsified_decoy.env")

	// S'assurer que le fichier réel existe
	realBytes, err := os.ReadFile(realSecretFile)
	if err != nil {
		fmt.Printf("Erreur lecture vrai secret: %v\n", err)
		return
	}

	decoyBytes, err := os.ReadFile(decoyFile)
	if err != nil {
		fmt.Printf("Erreur lecture decoy: %v\n", err)
		return
	}

	// Étape 0 : Initialiser le vrai .env
	os.WriteFile(envFile, realBytes, 0644)
	fmt.Println("==================================================")
	fmt.Println("🚀 SUPERVISEUR Go XHSC / XFPM - SIMULATION CYCLE DE VIE")
	fmt.Println("==================================================")
	fmt.Println("1. État INITIAL au repos :")
	fmt.Println("   .env est sur le disque avec vos VRAIS secrets.")
	fmt.Println("   (Vous pouvez l'ouvrir dans VS Code pour vérifier).")
	fmt.Println()

	// Étape 1 : Le superviseur lit les secrets dans sa mémoire vive (RAM Go)
	inMemoryStore := parseEnv(string(realBytes))
	fmt.Println("2. DÉMARRAGE DU SERVEUR :")
	fmt.Printf("   ✓ XHSC a chargé %d secrets dans sa mémoire vive RAM (en Go).\n", len(inMemoryStore))

	// Étape 2 : Permutation atomique sur le disque -> On place le LEURRE
	err = os.WriteFile(envFile, decoyBytes, 0644)
	if err != nil {
		fmt.Printf("Erreur écriture leurre: %v\n", err)
		return
	}
	fmt.Println("   🛡️ .env sur le disque a été remplacé par le LEURRE falsifié !")
	fmt.Println("   👉 Tout binaire (Go, C, script) qui fait 'cat .env' lira le faux fichier !")
	fmt.Println("   👉 Votre serveur légitime lit les vraies valeurs depuis la RAM de XHSC.")
	fmt.Println("--------------------------------------------------")
	fmt.Println("⏳ LE SERVEUR EST EN COURS D'EXÉCUTION...")
	fmt.Println("   Allez dans un autre terminal et faites : cat scratch/symlink_test/.env")
	fmt.Println("   Ou regardez le fichier .env dans votre éditeur.")
	fmt.Println("--------------------------------------------------")
	fmt.Println("Appuyez sur [ENTRÉE] (ou Ctrl+C) pour arrêter le serveur et tester la restauration...")

	// Gestion de l'arrêt propre (Ctrl+C ou signal OS)
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	done := make(chan bool)
	go func() {
		reader := bufio.NewReader(os.Stdin)
		reader.ReadString('\n')
		done <- true
	}()

	select {
	case <-sigChan:
		fmt.Println("\n\n🛑 Signal d'arrêt reçu (Ctrl+C)...")
	case <-done:
		fmt.Println("\n🛑 Arrêt demandé par l'utilisateur...")
	}

	// Étape 3 : Restauration immédiate des vrais secrets
	fmt.Println("3. RESTAURATION POST-EXÉCUTION :")
	time.Sleep(100 * time.Millisecond)
	err = os.WriteFile(envFile, realBytes, 0644)
	if err != nil {
		fmt.Printf("❌ Erreur restauration: %v\n", err)
	} else {
		fmt.Println("   ✅ Le vrai fichier .env d'origine a été restauré sur le disque !")
		fmt.Println("   Vos vrais secrets sont à nouveau disponibles.")
	}
	fmt.Println("==================================================")
}

func parseEnv(content string) map[string]string {
	result := make(map[string]string)
	lines := strings.Split(content, "\n")
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if l == "" || strings.HasPrefix(l, "#") {
			continue
		}
		parts := strings.SplitN(l, "=", 2)
		if len(parts) == 2 {
			result[strings.TrimSpace(parts[0])] = strings.Trim(strings.TrimSpace(parts[1]), `"'`)
		}
	}
	return result
}
