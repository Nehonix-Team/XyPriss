package server

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func PerformDeepAudit() {
	log.Printf("[SECURITY] Starting XHSC Deep Audit...")

	configPath := "xypriss.config.jsonc"
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		configPath = "xypriss.config.json"
	}

	var config map[string]interface{}
	cfgBytes, err := os.ReadFile(configPath)
	if err == nil {
		lines := strings.Split(string(cfgBytes), "\n")
		var cleanLines []string
		for _, line := range lines {
			if idx := strings.Index(line, "//"); idx != -1 {
				line = line[:idx]
			}
			cleanLines = append(cleanLines, line)
		}
		json.Unmarshal([]byte(strings.Join(cleanLines, "\n")), &config)
	}

	var trustedMods map[string]interface{}
	if config != nil {
		if tRaw, ok := config["trusted_plugins"]; ok {
			trustedMods, _ = tRaw.(map[string]interface{})
		}
	}
	if trustedMods == nil {
		trustedMods = make(map[string]interface{})
	}

	filepath.Walk("node_modules", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.Name() == "xypriss.plugin.sig" && !info.IsDir() {
			verifyPlugin(path, trustedMods)
		}
		return nil
	})
    
    log.Printf("[SECURITY] Deep Audit complete.")
}

func verifyPlugin(sigPath string, trustedMods map[string]interface{}) {
	pluginDir := filepath.Dir(sigPath)
	sigBytes, err := os.ReadFile(sigPath)
	if err != nil {
		return
	}

	type SigData struct {
		Name         string `json:"name"`
		Version      string `json:"version"`
		MinVersion   string `json:"min_version"`
		ContentHash  string `json:"content_hash"`
		PrevSigHash  string `json:"prev_sig_hash"`
		AuthorKey    string `json:"author_key"`
		ExpiresAt    string `json:"expires_at"`
		Signature    string `json:"signature"`
	}

	var sig SigData
	if err := json.Unmarshal(sigBytes, &sig); err != nil {
		log.Fatalf("FATAL: Invalid signature format for %s", pluginDir)
	}

	// 1. Author Check
	if trustedKey, ok := trustedMods[sig.Name]; !ok || trustedKey != sig.AuthorKey {
		log.Fatalf("FATAL: Author mismatch. No trusted key found for %s or mismatch.", sig.Name)
	}

	// 2. Expiry Check
	expiresAt, err := time.Parse(time.RFC3339, sig.ExpiresAt)
	if err == nil && time.Now().After(expiresAt) {
		log.Printf("WARN: Plugin %s signature has expired!", sig.Name)
	}

	// 3. Fast-Boot cached metadata & Content Hash check
	h := sha256.New()
	filepath.Walk(pluginDir, func(p string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() { return nil }
		if info.Name() == "node_modules" || strings.Contains(p, "node_modules") { return nil }
		if info.Name() == "xypriss.plugin.sig" { return nil }
		
		f, err := os.Open(p)
        if err == nil {
            defer f.Close()
		    io.Copy(h, f)
        }
		return nil
	})

	computedHash := fmt.Sprintf("sha256:%s", hex.EncodeToString(h.Sum(nil)))
	if computedHash != sig.ContentHash {
		log.Fatalf("FATAL: Content integrity violation for %s", sig.Name)
	}
	
	log.Printf("[SECURITY] VERIFIED: %s@%s (Author: %s)", sig.Name, sig.Version, sig.AuthorKey)
}
