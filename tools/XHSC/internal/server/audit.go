package server

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
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
			// log.Printf("[DEBUG] Successfully loaded system configuration from %s", configPath)
		}
	} else {
		log.Printf("WARN: Failed to read %s: %v", configPath, err)
	}

	var internal map[string]interface{}
	if config != nil {
		if iRaw, ok := config["$internal"]; ok {
			internal, _ = iRaw.(map[string]interface{})
		}
	}

	for _, pluginPath := range pluginPaths {
		pkgJsonPath := filepath.Join(pluginPath, "package.json")
		// ... existing revocation check ...
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

		sigPath := filepath.Join(pluginPath, "xypriss.plugin.xsig")
		if info, err := os.Stat(sigPath); err == nil && !info.IsDir() {
			// log.Printf("[DEBUG] Found signature at %s, verifying...", sigPath)
			
			// Extract expected key from $internal
			sigBytes, _ := os.ReadFile(sigPath)
			// Simple line-based name extraction for quick identity lookup
			var pluginName string
			lines := strings.Split(string(sigBytes), "\n")
			for _, l := range lines {
				if strings.HasPrefix(strings.TrimSpace(l), "Manifest:") {
					parts := strings.Split(strings.TrimSpace(l[9:]), "@")
					if len(parts) > 0 {
						pluginName = parts[0]
					}
					break
				}
			}

			var expectedKey string
			if internal != nil {
				if pluginCfg, ok := internal[pluginName].(map[string]interface{}); ok {
					if sigCfg, ok := pluginCfg["signature"].(map[string]interface{}); ok {
						expectedKey, _ = sigCfg["author_key"].(string)
					}
				}
			}

			verifyPlugin(sigPath, expectedKey)
		} else {
			// log.Printf("[DEBUG] No signature found at %s", sigPath)
		}
	}
    
    log.Printf("[SECURITY] Deep Audit complete.")
}

func verifyPlugin(sigPath string, expectedKey string) {
	pluginDir := filepath.Dir(sigPath)
	sigBytes, err := os.ReadFile(sigPath)
	if err != nil {
		return
	}

	sigRaw := string(sigBytes)
	lines := strings.Split(sigRaw, "\n")

	var sigContentLines []string
	var signatureBase64 string
	var inProof bool
	
	type SigData struct {
		Name         string
		Version      string
		MinVersion   string
		ContentHash  string
		PrevSigHash  string
		AuthorKey    string
		ExpiresAt    string
	}
	var sig SigData

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "--- BEGIN CRYPTOGRAPHIC PROOF ---") {
			inProof = true
			continue
		}
		if strings.HasPrefix(trimmed, "--- END XYPRISS SIGNATURE ---") {
			break
		}

		if inProof {
			if strings.HasPrefix(trimmed, "base64:") {
				signatureBase64 = strings.TrimSpace(trimmed[7:])
			}
			continue
		}

		// Collect metadata lines for signature verification
		if trimmed != "" {
			sigContentLines = append(sigContentLines, line)
		}

		if strings.HasPrefix(trimmed, "Manifest:") {
			parts := strings.Split(strings.TrimSpace(trimmed[9:]), "@")
			if len(parts) == 2 {
				sig.Name = parts[0]
				sig.Version = parts[1]
			}
		} else if strings.HasPrefix(trimmed, "Min-Engine:") {
			sig.MinVersion = strings.TrimSpace(trimmed[11:])
		} else if strings.HasPrefix(trimmed, "Fingerprint:") {
			sig.ContentHash = strings.TrimSpace(trimmed[12:])
		} else if strings.HasPrefix(trimmed, "Identity:") {
			sig.AuthorKey = strings.TrimSpace(trimmed[9:])
		} else if strings.HasPrefix(trimmed, "Expires:") {
			sig.ExpiresAt = strings.TrimSpace(trimmed[8:])
		} else if strings.HasPrefix(trimmed, "Revision:") {
			sig.PrevSigHash = strings.TrimSpace(trimmed[9:])
		}
	}

	sigContent := strings.Join(sigContentLines, "\n") + "\n"

	// 1. Identity Check
	if expectedKey == "" || expectedKey != sig.AuthorKey {
		// log.Fatalf("FATAL: Identity mismatch for %s. Expected [%v], got [%v]", sig.Name, expectedKey, sig.AuthorKey)
		log.Fatalf(
			"FATAL: Plugin '%s' failed identity verification (untrusted key). Trust it explicitly with: xfpm plugin trust %s %s",
			sig.Name,
			sig.Name,
			sig.AuthorKey,
		)
	}

	// 2. Expiry Check
	expiresAt, err := time.Parse(time.RFC3339, sig.ExpiresAt)
	if err == nil && time.Now().After(expiresAt) {
		log.Printf("WARN: Plugin %s signature has expired!", sig.Name)
	}

	// 3. Selective Hashing: Load package.json to respect "files" array
	allFilesMap := make(map[string]bool)
	pkgJsonPath := filepath.Join(pluginDir, "package.json")
	
	if data, err := os.ReadFile(pkgJsonPath); err == nil {
		var pkg struct { Files []string `json:"files"` }
		if err := json.Unmarshal(data, &pkg); err == nil && len(pkg.Files) > 0 {
			for _, pattern := range pkg.Files {
				fullPattern := filepath.Join(pluginDir, pattern)
				matches, _ := filepath.Glob(fullPattern)
				for _, m := range matches {
					info, err := os.Stat(m)
					if err != nil { continue }
					if info.IsDir() {
						filepath.Walk(m, func(p string, info os.FileInfo, err error) error {
							if err == nil && !info.IsDir() && info.Name() != "xypriss.plugin.xsig" {
								allFilesMap[p] = true
							}
							return nil
						})
					} else if info.Name() != "xypriss.plugin.xsig" {
						allFilesMap[m] = true
					}
				}
			}
		}
	}

	// If no files found via "files", fallback to wide-walk (Legacy)
	if len(allFilesMap) == 0 {
		filepath.Walk(pluginDir, func(p string, info os.FileInfo, err error) error {
			if err == nil && !info.IsDir() && info.Name() != "xypriss.plugin.xsig" {
				// Normal wide-walk exclusions
				name := info.Name()
				if name == "node_modules" || strings.Contains(p, "node_modules") { return nil }
				allFilesMap[p] = true
			}
			return nil
		})
	}

	// Deterministic Order: Sort by relative paths
	var fileList []string
	for f := range allFilesMap {
		fileList = append(fileList, f)
	}
	sort.Slice(fileList, func(i, j int) bool {
		relI, _ := filepath.Rel(pluginDir, fileList[i])
		relJ, _ := filepath.Rel(pluginDir, fileList[j])
		return relI < relJ
	})

	h := sha256.New()
	for _, p := range fileList {
		f, err := os.Open(p)
		if err == nil {
			defer f.Close()
			io.Copy(h, f)
		}
	}

	computedHash := fmt.Sprintf("sha256:%s", hex.EncodeToString(h.Sum(nil)))
	if computedHash != sig.ContentHash {
		log.Fatalf("FATAL: Content integrity violation for %s. Computed: %s, Manifest: %s", sig.Name, computedHash, sig.ContentHash)
	}

	// 4. Crypto Verification (Ed25519)
	pubKeyHex := strings.Replace(sig.AuthorKey, "ed25519:", "", 1)
	pubKeyBuf, err := hex.DecodeString(pubKeyHex)
	if err == nil && signatureBase64 != "" {
		sigBuf, err := base64.StdEncoding.DecodeString(signatureBase64)
		if err == nil {
			if ed25519.Verify(pubKeyBuf, []byte(sigContent), sigBuf) {
				log.Printf("[SECURITY] Cryptographic proof verified for %s", sig.Name)
			} else {
				log.Fatalf("FATAL: Cryptographic signature verification failed for %s", sig.Name)
			}
		} else {
			log.Fatalf("FATAL: Failed to decode signature for %s: %v", sig.Name, err)
		}
	} else if err != nil {
		log.Fatalf("FATAL: Failed to decode author key for %s: %v", sig.Name, err)
	}

	log.Printf("[SECURITY] VERIFIED: %s@%s (Identity: %s)", sig.Name, sig.Version, sig.AuthorKey)
}
