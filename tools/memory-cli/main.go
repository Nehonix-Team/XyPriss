package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

// MemoryInfo represents system memory information
type MemoryInfo struct {
	Platform        string  `json:"platform"`
	TotalMemory     uint64  `json:"totalMemory"`     // Total system memory in bytes
	AvailableMemory uint64  `json:"availableMemory"` // Available memory for applications
	FreeMemory      uint64  `json:"freeMemory"`      // free memory
	UsedMemory      uint64  `json:"usedMemory"`      // Used memory
	UsagePercentage float64 `json:"usagePercentage"` // Memory usage percentage
	BuffersMemory   uint64  `json:"buffersMemory"`   // Buffers (Linux/Unix)
	CachedMemory    uint64  `json:"cachedMemory"`    // Cached memory (Linux/Unix)
	SwapTotal       uint64  `json:"swapTotal"`       // Total swap space
	SwapUsed        uint64  `json:"swapUsed"`        // Used swap space
	SwapFree        uint64  `json:"swapFree"`        // Free swap space
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--help" {
		printHelp()
		return
	}

	memInfo, err := getMemoryInfo()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting memory info: %v\n", err)
		os.Exit(1)
	}

	output, err := json.Marshal(memInfo)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling JSON: %v\n", err)
		os.Exit(1)
	} 

	fmt.Println(string(output))
}

func printHelp() {
	fmt.Println("XyPriss Memory Info CLI")
	fmt.Println("Usage: memory-cli [--help]")
	fmt.Println("")
	fmt.Println("Returns system memory information in JSON format:")
	fmt.Println("- totalMemory: Total system memory in bytes")
	fmt.Println("- availableMemory: Memory available for applications")
	fmt.Println("- freeMemory: Truly free memory")
	fmt.Println("- usedMemory: Currently used memory")
	fmt.Println("- usagePercentage: Memory usage percentage")
	fmt.Println("- buffersMemory: Buffer memory (Linux/Unix)")
	fmt.Println("- cachedMemory: Cached memory (Linux/Unix)")
	fmt.Println("- swapTotal/swapUsed/swapFree: Swap space information")
}

func getMemoryInfo() (*MemoryInfo, error) {
	switch runtime.GOOS {
	case "linux":
		return getLinuxMemoryInfo()
	case "darwin":
		return getDarwinMemoryInfo()
	case "windows":
		return getWindowsMemoryInfo()
	default:
		return getGenericMemoryInfo()
	}
}

// getGenericMemoryInfo provides basic memory info using Go's runtime
func getGenericMemoryInfo() (*MemoryInfo, error) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// This is very basic and not accurate for system memory
	// but provides a fallback for unsupported platforms
	return &MemoryInfo{
		Platform:        runtime.GOOS,
		TotalMemory:     m.Sys,
		AvailableMemory: m.Sys - m.Alloc,
		FreeMemory:      m.Sys - m.Alloc,
		UsedMemory:      m.Alloc,
		UsagePercentage: float64(m.Alloc) / float64(m.Sys) * 100,
		BuffersMemory:   0,
		CachedMemory:    0,
		SwapTotal:       0,
		SwapUsed:        0,
		SwapFree:        0,
	}, nil
}

// parseMemInfoLine parses a line from /proc/meminfo
func parseMemInfoLine(line string) (string, uint64, error) {
	parts := strings.Fields(line)
	if len(parts) < 2 {
		return "", 0, fmt.Errorf("invalid meminfo line: %s", line)
	}

	key := strings.TrimSuffix(parts[0], ":")
	valueStr := parts[1]
	
	value, err := strconv.ParseUint(valueStr, 10, 64)
	if err != nil {
		return "", 0, err
	}

	// Convert from kB to bytes if unit is specified
	if len(parts) >= 3 && parts[2] == "kB" {
		value *= 1024
	}

	return key, value, nil
}

// bytesToMB converts bytes to megabytes for easier reading
func bytesToMB(bytes uint64) float64 {
	return float64(bytes) / 1024 / 1024
}

// calculateUsagePercentage calculates memory usage percentage
func calculateUsagePercentage(used, total uint64) float64 {
	if total == 0 {
		return 0
	}
	return float64(used) / float64(total) * 100
}

// getLinuxMemoryInfo gets memory info on Linux using /proc/meminfo
func getLinuxMemoryInfo() (*MemoryInfo, error) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return nil, fmt.Errorf("failed to read /proc/meminfo: %v", err)
	}

	memInfo := &MemoryInfo{Platform: "linux"}
	lines := strings.Split(string(data), "\n")

	for _, line := range lines {
		if line == "" {
			continue
		}

		key, value, err := parseMemInfoLine(line)
		if err != nil {
			continue // Skip invalid lines
		}

		switch key {
		case "MemTotal":
			memInfo.TotalMemory = value
		case "MemAvailable":
			memInfo.AvailableMemory = value
		case "MemFree":
			memInfo.FreeMemory = value
		case "Buffers":
			memInfo.BuffersMemory = value
		case "Cached":
			memInfo.CachedMemory = value
		case "SwapTotal":
			memInfo.SwapTotal = value
		case "SwapFree":
			memInfo.SwapFree = value
		}
	}

	// Calculate derived values
	memInfo.SwapUsed = memInfo.SwapTotal - memInfo.SwapFree
	memInfo.UsedMemory = memInfo.TotalMemory - memInfo.AvailableMemory
	memInfo.UsagePercentage = calculateUsagePercentage(memInfo.UsedMemory, memInfo.TotalMemory)

	// If MemAvailable is not available, estimate it
	if memInfo.AvailableMemory == 0 {
		memInfo.AvailableMemory = memInfo.FreeMemory + memInfo.BuffersMemory + memInfo.CachedMemory
	}

	return memInfo, nil
}

// getDarwinMemoryInfo gets memory info on macOS using vm_stat and sysctl
func getDarwinMemoryInfo() (*MemoryInfo, error) {
	memInfo := &MemoryInfo{Platform: "darwin"}

	// Get total memory using sysctl
	totalCmd := exec.Command("sysctl", "-n", "hw.memsize")
	totalOutput, err := totalCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get total memory: %v", err)
	}
 
	totalMemory, err := strconv.ParseUint(strings.TrimSpace(string(totalOutput)), 10, 64)
	if err != nil {
		return nil, fmt.Errorf("failed to parse total memory: %v", err)
	}
	memInfo.TotalMemory = totalMemory

	// Get memory statistics using vm_stat
	vmStatCmd := exec.Command("vm_stat")
	vmStatOutput, err := vmStatCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get vm_stat: %v", err)
	}

	// Parse vm_stat output
	lines := strings.Split(string(vmStatOutput), "\n")
	var pageSize uint64 = 4096 // Default page size
	var freePages, inactivePages, speculativePages uint64

	for _, line := range lines {
		if strings.Contains(line, "page size of") {
			// Extract page size
			parts := strings.Fields(line)
			for i, part := range parts {
				if part == "of" && i+1 < len(parts) {
					if size, err := strconv.ParseUint(parts[i+1], 10, 64); err == nil {
						pageSize = size
					}
					break
				}
			}
		} else if strings.Contains(line, "Pages free:") {
			freePages = parseVmStatValue(line)
		} else if strings.Contains(line, "Pages inactive:") {
			inactivePages = parseVmStatValue(line)
		} else if strings.Contains(line, "Pages speculative:") {
			speculativePages = parseVmStatValue(line)
		}
	}

	// Calculate memory values
	memInfo.FreeMemory = freePages * pageSize
	memInfo.AvailableMemory = (freePages + inactivePages + speculativePages) * pageSize
	memInfo.UsedMemory = memInfo.TotalMemory - memInfo.AvailableMemory
	memInfo.UsagePercentage = calculateUsagePercentage(memInfo.UsedMemory, memInfo.TotalMemory)

	// Get swap info using sysctl
	swapUsageCmd := exec.Command("sysctl", "-n", "vm.swapusage")
	if swapOutput, err := swapUsageCmd.Output(); err == nil {
		parseSwapUsage(string(swapOutput), memInfo)
	}

	return memInfo, nil
}

// parseVmStatValue extracts numeric value from vm_stat line
func parseVmStatValue(line string) uint64 {
	parts := strings.Fields(line)
	if len(parts) >= 2 {
		valueStr := strings.TrimSuffix(parts[len(parts)-1], ".")
		if value, err := strconv.ParseUint(valueStr, 10, 64); err == nil {
			return value
		}
	}
	return 0
}

// parseSwapUsage parses macOS swap usage output
func parseSwapUsage(output string, memInfo *MemoryInfo) {
	// Example: "total = 2048.00M  used = 1024.00M  free = 1024.00M  (encrypted)"
	parts := strings.Fields(output)
	for i, part := range parts {
		if part == "total" && i+2 < len(parts) {
			if total := parseMemoryValue(parts[i+2]); total > 0 {
				memInfo.SwapTotal = total
			}
		} else if part == "used" && i+2 < len(parts) {
			if used := parseMemoryValue(parts[i+2]); used > 0 {
				memInfo.SwapUsed = used
			}
		} else if part == "free" && i+2 < len(parts) {
			if free := parseMemoryValue(parts[i+2]); free > 0 {
				memInfo.SwapFree = free
			}
		}
	}
}

// parseMemoryValue parses memory values like "1024.00M" or "2.00G"
func parseMemoryValue(value string) uint64 {
	value = strings.TrimSpace(value)
	if len(value) == 0 {
		return 0
	}

	unit := value[len(value)-1:]
	numStr := value[:len(value)-1]

	num, err := strconv.ParseFloat(numStr, 64)
	if err != nil {
		return 0
	}

	switch unit {
	case "K":
		return uint64(num * 1024)
	case "M":
		return uint64(num * 1024 * 1024)
	case "G":
		return uint64(num * 1024 * 1024 * 1024)
	default:
		// Assume bytes if no unit
		return uint64(num)
	}
}

// getWindowsMemoryInfo gets memory info on Windows using wmic
func getWindowsMemoryInfo() (*MemoryInfo, error) {
	memInfo := &MemoryInfo{Platform: "windows"}

	// Get total physical memory
	totalCmd := exec.Command("wmic", "computersystem", "get", "TotalPhysicalMemory", "/value")
	totalOutput, err := totalCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get total memory: %v", err)
	}

	for _, line := range strings.Split(string(totalOutput), "\n") {
		if strings.Contains(line, "TotalPhysicalMemory=") {
			valueStr := strings.TrimSpace(strings.Split(line, "=")[1])
			if total, err := strconv.ParseUint(valueStr, 10, 64); err == nil {
				memInfo.TotalMemory = total
			}
			break
		}
	}

	// Get available memory
	availCmd := exec.Command("wmic", "OS", "get", "FreePhysicalMemory", "/value")
	availOutput, err := availCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get available memory: %v", err)
	}

	for _, line := range strings.Split(string(availOutput), "\n") {
		if strings.Contains(line, "FreePhysicalMemory=") {
			valueStr := strings.TrimSpace(strings.Split(line, "=")[1])
			if free, err := strconv.ParseUint(valueStr, 10, 64); err == nil {
				memInfo.FreeMemory = free * 1024 // Convert from KB to bytes
				memInfo.AvailableMemory = memInfo.FreeMemory
			}
			break
		}
	}

	// Get more accurate available memory using Performance Counters
	perfCmd := exec.Command("typeperf", "\\Memory\\Available Bytes", "-sc", "1")
	if perfOutput, err := perfCmd.Output(); err == nil {
		lines := strings.Split(string(perfOutput), "\n")
		for _, line := range lines {
			if strings.Contains(line, "Available Bytes") {
				parts := strings.Split(line, ",")
				if len(parts) >= 2 {
					valueStr := strings.Trim(strings.TrimSpace(parts[1]), "\"")
					if avail, err := strconv.ParseFloat(valueStr, 64); err == nil {
						memInfo.AvailableMemory = uint64(avail)
					}
				}
				break
			}
		}
	}

	// Calculate derived values
	memInfo.UsedMemory = memInfo.TotalMemory - memInfo.AvailableMemory
	memInfo.UsagePercentage = calculateUsagePercentage(memInfo.UsedMemory, memInfo.TotalMemory)

	// Get swap/page file info
	swapCmd := exec.Command("wmic", "pagefile", "get", "Size,Usage", "/format:csv")
	if swapOutput, err := swapCmd.Output(); err == nil {
		parseWindowsSwap(string(swapOutput), memInfo)
	}

	return memInfo, nil
}

// parseWindowsSwap parses Windows page file information
func parseWindowsSwap(output string, memInfo *MemoryInfo) {
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		if line == "" || strings.Contains(line, "Node,Size,Usage") {
			continue
		}

		parts := strings.Split(line, ",")
		if len(parts) >= 3 {
			if size, err := strconv.ParseUint(strings.TrimSpace(parts[1]), 10, 64); err == nil {
				memInfo.SwapTotal += size * 1024 * 1024 // Convert MB to bytes
			}
			if usage, err := strconv.ParseUint(strings.TrimSpace(parts[2]), 10, 64); err == nil {
				memInfo.SwapUsed += usage * 1024 * 1024 // Convert MB to bytes
			}
		}
	}
	memInfo.SwapFree = memInfo.SwapTotal - memInfo.SwapUsed
}
