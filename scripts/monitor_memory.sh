#!/bin/bash

set -euo pipefail

readonly BLUE='\033[0;34m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly RED='\033[0;31m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

log_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$*${NC}"
    echo -e "${BLUE}========================================${NC}"
}

get_xsys_pid() {
    pgrep -f "xsys server start" | head -n 1 || echo ""
}

bytes_to_mb() {
    echo "scale=2; $1 / 1024" | bc
}

bytes_to_gb() {
    echo "scale=2; $1 / 1024 / 1024" | bc
}

check_memory_lock() {
    local pid=$1
    local locked_kb=0
    
    if [ -f "/proc/$pid/status" ]; then
        locked_kb=$(grep VmLck "/proc/$pid/status" | awk '{print $2}')
        if [ -n "$locked_kb" ] && [ "$locked_kb" -gt 0 ]; then
            local locked_mb=$(bytes_to_mb "$locked_kb")
            echo -e "${GREEN}✓ Memory locked (mlock): ${locked_mb} MB${NC}"
            return 0
        fi
    fi
    echo -e "${YELLOW}⚠ Memory not locked (mlock not active or no privileges)${NC}"
    return 1
}

analyze_pre_allocation() {
    local parent_rss_mb=$1
    local expected_prealloc=4096  # 25% of 16GB
    
    echo -e "\n${CYAN}Pre-allocation Analysis:${NC}"
    echo "  Expected: ${expected_prealloc} MB (25% of 16GB)"
    echo "  Actual RSS: ${parent_rss_mb} MB"
    
    local diff=$(echo "$parent_rss_mb - $expected_prealloc" | bc)
    local percent_match=$(echo "scale=1; ($parent_rss_mb / $expected_prealloc) * 100" | bc)
    
    if (( $(echo "$percent_match >= 95 && $percent_match <= 105" | bc -l) )); then
        echo -e "  ${GREEN}✓ Pre-allocation CONFIRMED (${percent_match}% match)${NC}"
        return 0
    elif (( $(echo "$parent_rss_mb > 3000" | bc -l) )); then
        echo -e "  ${YELLOW}⚠ Partial allocation detected (${percent_match}% match)${NC}"
        return 1
    else
        echo -e "  ${RED}✗ Pre-allocation NOT detected${NC}"
        return 2
    fi
}

calculate_rescue_capacity() {
    local parent_rss_mb=$1
    local workers_total_rss_mb=$2
    local max_mem_mb=16384  # 16GB
    
    echo -e "\n${CYAN}Rescue Mode Capacity:${NC}"
    
    local available_if_released=$(echo "$parent_rss_mb * 0.95" | bc)  # 95% can be released
    local current_usage=$(echo "$workers_total_rss_mb + $parent_rss_mb" | bc)
    local usage_percent=$(echo "scale=1; ($current_usage / $max_mem_mb) * 100" | bc)
    
    echo "  Current total usage: ${current_usage} MB (${usage_percent}%)"
    echo "  Releasable reserve: ~${available_if_released} MB"
    
    if (( $(echo "$usage_percent > 90" | bc -l) )); then
        echo -e "  ${RED}⚠ CRITICAL: Would trigger reserve release at 90%${NC}"
    elif (( $(echo "$usage_percent > 75" | bc -l) )); then
        echo -e "  ${YELLOW}⚠ WARNING: Would trigger GC at 75%${NC}"
    else
        echo -e "  ${GREEN}✓ Memory usage healthy${NC}"
    fi
}

monitor_memory() {
    local xsys_pid
    xsys_pid=$(get_xsys_pid)
    
    if [ -z "$xsys_pid" ]; then
        echo -e "${RED}✗ xsys process not found${NC}"
        exit 1
    fi
    
    log_section "XyPriss Intelligence Memory Monitor"
    
    echo -e "${GREEN}Parent Process (PID: $xsys_pid)${NC}"
    ps -p "$xsys_pid" -o pid,%mem,rss,vsz,cmd --no-headers | while read -r line; do
        local pid=$(echo "$line" | awk '{print $1}')
        local mem_percent=$(echo "$line" | awk '{print $2}')
        local rss=$(echo "$line" | awk '{print $3}')
        local vsz=$(echo "$line" | awk '{print $4}')
        local cmd=$(echo "$line" | awk '{$1=$2=$3=$4=""; print $0}' | xargs)
        
        local rss_mb=$(bytes_to_mb "$rss")
        local vsz_mb=$(bytes_to_mb "$vsz")
        local rss_gb=$(bytes_to_gb "$rss")
        
        printf "  PID: %-8s | MEM: %6s%% | RSS: %8s MB (%.2f GB) | VSZ: %8s MB\n" \
            "$pid" "$mem_percent" "$rss_mb" "$rss_gb" "$vsz_mb"
        printf "  CMD: %s\n" "$cmd"
        
        # Check memory locking
        echo ""
        check_memory_lock "$pid"
        
        # Analyze pre-allocation
        analyze_pre_allocation "$rss_mb"
    done
    
    echo ""
    echo -e "${GREEN}Worker Processes${NC}"
    
    local worker_pids
    worker_pids=$(pgrep -P "$xsys_pid" 2>/dev/null || true)
    
    if [ -z "$worker_pids" ]; then
        echo -e "  ${YELLOW}⚠ No worker processes found (rescue mode likely active)${NC}"
    else
        local worker_count=0
        local total_rss=0
        
        printf "  %-8s | %-8s | %-12s | %-12s | %-10s\n" "PID" "MEM %" "RSS (MB)" "VSZ (MB)" "STATUS"
        echo "  --------------------------------------------------------------------------------"
        
        ps --ppid "$xsys_pid" -o pid,%mem,rss,vsz --no-headers | while read -r pid mem rss vsz; do
            local rss_mb=$(bytes_to_mb "$rss")
            local vsz_mb=$(bytes_to_mb "$vsz")
            
            local status="RUNNING"
            if (( $(echo "$rss_mb > 500" | bc -l) )); then
                status="${RED}HIGH MEM${NC}"
            fi
            
            printf "  %-8s | %6s%% | %10s   | %10s   | %b\n" \
                "$pid" "$mem" "$rss_mb" "$vsz_mb" "$status"
            
            worker_count=$((worker_count + 1))
            total_rss=$((total_rss + rss))
        done
        
        local worker_count=$(echo "$worker_pids" | wc -w)
        local total_rss=$(ps --ppid "$xsys_pid" -o rss --no-headers | awk '{sum+=$1} END {print sum}')
        local total_rss_mb=$(bytes_to_mb "$total_rss")
        local avg_rss=$(echo "scale=2; $total_rss_mb / $worker_count" | bc)
        
        echo "  --------------------------------------------------------------------------------"
        printf "  ${YELLOW}Total: %d workers | Total RSS: %s MB | Avg: %s MB/worker${NC}\n" \
            "$worker_count" "$total_rss_mb" "$avg_rss"
        
        # Calculate rescue capacity
        local parent_rss=$(ps -p "$xsys_pid" -o rss --no-headers)
        local parent_rss_mb=$(bytes_to_mb "$parent_rss")
        calculate_rescue_capacity "$parent_rss_mb" "$total_rss_mb"
    fi
    
    log_section "System Memory Overview"
    
    free -h | grep -E "(total|Mem|Swap)"
    
    echo ""
    echo -e "${CYAN}Memory Pressure Indicators:${NC}"
    if [ -f /proc/pressure/memory ]; then
        echo "  PSI Memory Pressure:"
        grep -E "some|full" /proc/pressure/memory | sed 's/^/    /'
    else
        echo "  PSI not available on this system"
    fi
    
    log_section "Top 10 Memory Consumers (System-wide)"
    
    printf "%-8s %-10s %8s %12s %s\n" "PID" "USER" "MEM%" "RSS (MB)" "COMMAND"
    echo "--------------------------------------------------------------------------------"
    ps aux --sort=-%mem | head -11 | tail -10 | while read -r line; do
        local user=$(echo "$line" | awk '{print $1}')
        local pid=$(echo "$line" | awk '{print $2}')
        local mem=$(echo "$line" | awk '{print $4}')
        local rss=$(echo "$line" | awk '{print $6}')
        local cmd=$(echo "$line" | awk '{print $11}')
        
        local rss_mb=$(bytes_to_mb "$rss")
        
        local color=""
        if echo "$line" | grep -q "xsys"; then
            color="${GREEN}"
        fi
        
        printf "%b%-8s %-10s %7s%% %10s   %s%b\n" \
            "$color" "$pid" "$user" "$mem" "$rss_mb" "$cmd" "$NC"
    done
    
    log_section "Intelligence Manager Status"
    
    echo "  Configuration:"
    echo "    • Max Memory: 16 GB"
    echo "    • Expected Pre-allocation: 4 GB (25%)"
    echo "    • GC Trigger: 75% (12 GB)"
    echo "    • Reserve Release: 90% (14.4 GB)"
    echo "    • Rescue Mode: Enabled"
    
    local parent_rss=$(ps -p "$xsys_pid" -o rss --no-headers 2>/dev/null || echo "0")
    local parent_rss_mb=$(bytes_to_mb "$parent_rss")
    
    echo ""
    echo "  Runtime Status:"
    if (( $(echo "$parent_rss_mb > 3000" | bc -l) )); then
        echo -e "    ${GREEN}✓ Intelligence system active${NC}"
        echo -e "    ${GREEN}✓ Reserve memory allocated${NC}"
        echo -e "    ${GREEN}✓ Rescue mode ready${NC}"
    else
        echo -e "    ${YELLOW}⚠ Pre-allocation may not be active${NC}"
    fi
}

watch_memory_trends() {
    local xsys_pid
    xsys_pid=$(get_xsys_pid)
    
    if [ -z "$xsys_pid" ]; then
        echo "xsys process not found"
        exit 1
    fi
    
    local samples=10
    local interval=2
    
    echo -e "${BLUE}Memory Trend Analysis (${samples} samples, ${interval}s interval)${NC}\n"
    printf "%-8s | %-12s | %-12s | %-12s\n" "Time" "Parent RSS" "Workers RSS" "Total"
    echo "----------------------------------------------------------------"
    
    for i in $(seq 1 $samples); do
        local timestamp=$(date +%H:%M:%S)
        local parent_rss=$(ps -p "$xsys_pid" -o rss --no-headers 2>/dev/null || echo "0")
        local workers_rss=$(ps --ppid "$xsys_pid" -o rss --no-headers 2>/dev/null | awk '{sum+=$1} END {print sum}')
        
        local parent_mb=$(bytes_to_mb "$parent_rss")
        local workers_mb=$(bytes_to_mb "${workers_rss:-0}")
        local total_mb=$(echo "$parent_mb + $workers_mb" | bc)
        
        printf "%-8s | %10s MB | %10s MB | %10s MB\n" \
            "$timestamp" "$parent_mb" "$workers_mb" "$total_mb"
        
        [ $i -lt $samples ] && sleep $interval
    done
}

continuous_monitor() {
    while true; do
        clear
        monitor_memory
        echo ""
        echo -e "${YELLOW}Press Ctrl+C to stop. Refreshing in 3 seconds...${NC}"
        sleep 3
    done
}

show_help() {
    cat << EOF
XyPriss Intelligence Memory Monitor

Usage: $0 [OPTION]

Options:
    -c, --continuous    Continuous monitoring (refresh every 3s)
    -t, --trend        Memory trend analysis (10 samples)
    -h, --help         Show this help message

Examples:
    $0                 Single snapshot
    $0 -c              Continuous monitoring
    $0 -t              Trend analysis
EOF
}

case "${1:-}" in
    -c|--continuous)
        continuous_monitor
        ;;
    -t|--trend)
        watch_memory_trends
        ;;
    -h|--help)
        show_help
        ;;
    "")
        monitor_memory
        echo ""
        echo "Tip: Use '$0 --help' for more options"
        ;;
    *)
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
esac