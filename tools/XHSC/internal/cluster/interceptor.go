/* *****************************************************************************
 * Nehonix XyPriss System CLI
 * Console Interception System (Go implementation)
 ***************************************************************************** */

package cluster

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"regexp"
	"sync"
	"time"

	"github.com/fatih/color"
)

type ConsoleConfig struct {
	Enabled                   bool     `json:"enabled"`
	MaxInterceptionsPerSecond int      `json:"max_interceptions_per_second"`
	Methods                   []string `json:"methods"`
	Encryption                struct {
		Enabled bool   `json:"enabled"`
		Key     string `json:"key"`
	} `json:"encryption"`
	Filters struct {
		MinLevel        string   `json:"min_level"`
		MaxLength       int      `json:"max_length"`
		IncludePatterns []string `json:"include_patterns"`
		ExcludePatterns []string `json:"exclude_patterns"`
		UserAppPatterns []string `json:"user_app_patterns"`
		SystemPatterns  []string `json:"system_patterns"`
	} `json:"filters"`
}

type Interceptor struct {
	config ConsoleConfig
	mu     sync.RWMutex

	includeRegex []*regexp.Regexp
	excludeRegex []*regexp.Regexp
	userAppRegex []*regexp.Regexp
	systemRegex  []*regexp.Regexp

	rateLimitCounter int
	rateLimitWindow  time.Time

	// Encryption
	block cipher.Block
	gcm   cipher.AEAD

	stats struct {
		TotalInterceptions uint64 `json:"total_interceptions"`
		EncryptedMessages  uint64 `json:"encrypted_messages"`
		DroppedMessages    uint64 `json:"dropped_messages"`
	}
}

func NewInterceptor(config ConsoleConfig) (*Interceptor, error) {
	i := &Interceptor{
		config:          config,
		rateLimitWindow: time.Now(),
	}

	i.compileRegex()

	if config.Encryption.Enabled && config.Encryption.Key != "" {
		key := []byte(config.Encryption.Key)
		// Ensure key length is 16, 24, or 32 bytes for AES
		if len(key) != 16 && len(key) != 24 && len(key) != 32 {
			return nil, fmt.Errorf("invalid encryption key length: must be 16, 24, or 32 bytes")
		}

		block, err := aes.NewCipher(key)
		if err != nil {
			return nil, err
		}
		gcm, err := cipher.NewGCM(block)
		if err != nil {
			return nil, err
		}
		i.block = block
		i.gcm = gcm
	}

	return i, nil
}

func (i *Interceptor) UpdateConfig(config ConsoleConfig) {
	i.mu.Lock()
	defer i.mu.Unlock()

	i.config = config
	i.compileRegex()

	if config.Encryption.Enabled && config.Encryption.Key != "" {
		key := []byte(config.Encryption.Key)
		if len(key) == 16 || len(key) == 24 || len(key) == 32 {
			block, _ := aes.NewCipher(key)
			gcm, _ := cipher.NewGCM(block)
			i.block = block
			i.gcm = gcm
		}
	} else {
		i.block = nil
		i.gcm = nil
	}
}

func (i *Interceptor) GetStats() interface{} {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.stats
}

func (i *Interceptor) compileRegex() {
	i.includeRegex = compilePatterns(i.config.Filters.IncludePatterns)
	i.excludeRegex = compilePatterns(i.config.Filters.ExcludePatterns)
	i.userAppRegex = compilePatterns(i.config.Filters.UserAppPatterns)
	i.systemRegex = compilePatterns(i.config.Filters.SystemPatterns)
}

func compilePatterns(patterns []string) []*regexp.Regexp {
	var res []*regexp.Regexp
	for _, p := range patterns {
		if re, err := regexp.Compile(p); err == nil {
			res = append(res, re)
		}
	}
	return res
}

func (i *Interceptor) ProcessLog(workerID int, rawMessage string) string {
	i.mu.Lock()
	defer i.mu.Unlock()

	// Rate limiting
	now := time.Now()
	if now.Sub(i.rateLimitWindow) >= time.Second {
		i.rateLimitCounter = 0
		i.rateLimitWindow = now
	}
	i.rateLimitCounter++
	if i.rateLimitCounter > i.config.MaxInterceptionsPerSecond {
		i.stats.DroppedMessages++
		return "" // Suppress
	}

	i.stats.TotalInterceptions++

	// Filtering
	if i.shouldExclude(rawMessage) {
		i.stats.DroppedMessages++
		return ""
	}

	// Categorization
	category := i.categorize(rawMessage)

	// Encryption
	message := rawMessage
	if i.config.Encryption.Enabled && i.gcm != nil {
		encrypted, err := i.encrypt(rawMessage)
		if err == nil {
			message = encrypted
			i.stats.EncryptedMessages++
		}
	}

	// Formatting
	return i.format(workerID, category, message)
}

func (i *Interceptor) shouldExclude(msg string) bool {
	for _, re := range i.excludeRegex {
		if re.MatchString(msg) {
			return true
		}
	}
	return false
}

func (i *Interceptor) categorize(msg string) string {
	for _, re := range i.userAppRegex {
		if re.MatchString(msg) {
			return "USERAPP"
		}
	}
	for _, re := range i.systemRegex {
		if re.MatchString(msg) {
			return "SYSTEM"
		}
	}
	return "OTHER"
}

func (i *Interceptor) encrypt(plaintext string) (string, error) {
	nonce := make([]byte, i.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := i.gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (i *Interceptor) format(workerID int, category, message string) string {
	timestamp := time.Now().Format("15:04:05.000")
	gray := color.New(color.FgHiBlack).SprintFunc()
	white := color.New(color.FgWhite).SprintFunc()
	bold := color.New(color.Bold).SprintFunc()

	var catColor func(a ...interface{}) string
	switch category {
	case "USERAPP":
		catColor = color.New(color.FgHiBlue).SprintFunc()
	case "SYSTEM":
		catColor = color.New(color.FgHiGreen).SprintFunc()
	default:
		catColor = white
	}

	prefix := gray(timestamp) + " " + catColor(bold(fmt.Sprintf("[%s][W%d]", category, workerID)))
	return prefix + " " + white(message)
}
