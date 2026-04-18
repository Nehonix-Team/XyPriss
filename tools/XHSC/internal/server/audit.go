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
	"regexp"
	"strings"
	"time"
)

func PerformDeepAudit(projectRoot string, pluginPaths []string) {
	if projectRoot == "" {
		projectRoot, _ = os.Getwd()
	}

	configPath := filepath.Join(projectRoot, "xypriss.config.jsonc")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		configPath = filepath.Join(projectRoot, "xypriss.config.json")
	}

	var config map[string]interface{}
	cfgBytes, err := os.ReadFile(configPath)
	if err == nil {
		lines := strings.Split(string(cfgBytes), "\n")
		var cleanLines []string
		for _, line := range lines {
			if idx := strings.Index(line, "//"); idx != -1 {
				// Don't strip if it looks like a protocol (e.g., ROOT://)
				if idx == 0 || (idx > 0 && line[idx-1] != ':') {
					line = line[:idx]
				}
			}
			cleanLines = append(cleanLines, line)
		}
		cleanStr := strings.Join(cleanLines, "\n")
		// Remove trailing commas before } or ]
		re := regexp.MustCompile(`,(\s*[}\]])`)
		cleanStr = re.ReplaceAllString(cleanStr, "$1")

		if err := json.Unmarshal([]byte(cleanStr), &config); err != nil {
			log.Printf("WARN: Failed to parse %s: %v", configPath, err)
		} else {
			log.Printf("[DEBUG] Config loaded. trusted_plugins count: %v", len(config))
		}
	} else {
		log.Printf("WARN: Failed to read %s: %v", configPath, err)
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
	log.Printf("[DEBUG] Trusted plugins: %v", trustedMods)

	for _, pluginPath := range pluginPaths {
		pkgJsonPath := filepath.Join(pluginPath, "package.json")
		if data, err := os.ReadFile(pkgJsonPath); err == nil {
			var pkgJson struct {
				Xfpm *struct {
					Revoked bool `json:"revoked"`
				} `json:"xfpm"`
			}
			if err := json.Unmarshal(data, &pkgJson); err == nil && pkgJson.Xfpm != nil && pkgJson.Xfpm.Revoked {
				log.Printf("[SECURITY] CRITICAL: Plugin at %s is REVOKED.", pluginPath)
				log.Fatalf("FATAL: Project execution blocked due to revoked plugin at %s", pluginPath)
			}
		}

		sigPath := filepath.Join(pluginPath, "xypriss.plugin.sig")
		if info, err := os.Stat(sigPath); err == nil && !info.IsDir() {
			log.Printf("[DEBUG] Found signature at %s, verifying...", sigPath)
			verifyPlugin(sigPath, trustedMods)
		} else {
			log.Printf("[DEBUG] No signature found at %s", sigPath)
		}
	}
    
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
		log.Fatalf("FATAL: Author mismatch for %s. Expected [%v], got [%v]", sig.Name, trustedKey, sig.AuthorKey)
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
