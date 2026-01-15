#!/bin/bash

set -euo pipefail

readonly BLUE='\033[0;34m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
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

monitor_memory() {
    local xsys_pid
    xsys_pid=$(get_xsys_pid)
    
    if [ -z "$xsys_pid" ]; then
        echo "xsys process not found"
        exit 1
    fi
    
    log_section "XyPriss Memory Usage Monitor"
    
    echo -e "${GREEN}Parent Process (PID: $xsys_pid)${NC}"
    ps -p "$xsys_pid" -o pid,%mem,rss,vsz,cmd --no-headers | while read -r line; do
        local pid=$(echo "$line" | awk '{print $1}')
        local mem_percent=$(echo "$line" | awk '{print $2}')
        local rss=$(echo "$line" | awk '{print $3}')
        local vsz=$(echo "$line" | awk '{print $4}')
        local cmd=$(echo "$line" | awk '{$1=$2=$3=$4=""; print $0}' | xargs)
        
        local rss_mb=$(bytes_to_mb "$rss")
        local vsz_mb=$(bytes_to_mb "$vsz")
        
        printf "  PID: %-8s | MEM: %6s%% | RSS: %8s MB | VSZ: %8s MB\n" \
            "$pid" "$mem_percent" "$rss_mb" "$vsz_mb"
        printf "  CMD: %s\n" "$cmd"
    done
    
    echo ""
    echo -e "${GREEN}Worker Processes${NC}"
    
    local worker_pids
    worker_pids=$(pgrep -P "$xsys_pid" 2>/dev/null || true)
    
    if [ -z "$worker_pids" ]; then
        echo "  No worker processes found"
    else
        local worker_count=0
        local total_rss=0
        
        printf "  %-8s | %-8s | %-12s | %-12s\n" "PID" "MEM %" "RSS (MB)" "VSZ (MB)"
        echo "  ----------------------------------------------------------------"
        
        ps --ppid "$xsys_pid" -o pid,%mem,rss,vsz --no-headers | while read -r pid mem rss vsz; do
            local rss_mb=$(bytes_to_mb "$rss")
            local vsz_mb=$(bytes_to_mb "$vsz")
            
            printf "  %-8s | %6s%% | %10s   | %10s\n" \
                "$pid" "$mem" "$rss_mb" "$vsz_mb"
            
            worker_count=$((worker_count + 1))
            total_rss=$((total_rss + rss))
        done
        
        local worker_count=$(echo "$worker_pids" | wc -w)
        local total_rss=$(ps --ppid "$xsys_pid" -o rss --no-headers | awk '{sum+=$1} END {print sum}')
        local total_rss_mb=$(bytes_to_mb "$total_rss")
        
        echo "  ----------------------------------------------------------------"
        printf "  ${YELLOW}Total: %d workers | Total RSS: %s MB${NC}\n" \
            "$worker_count" "$total_rss_mb"
    fi
    
    log_section "System Memory Overview"
    
    free -h | grep -E "(total|Mem|Swap)"
    
    log_section "Pre-allocated Memory Check"
    
    local parent_rss=$(ps -p "$xsys_pid" -o rss --no-headers)
    local parent_rss_mb=$(bytes_to_mb "$parent_rss")
    
    echo "Parent process RSS: ${parent_rss_mb} MB"
    
    if (( $(echo "$parent_rss_mb > 100" | bc -l) )); then
        echo -e "${GREEN}✓ Parent has significant memory footprint (pre-allocation likely active)${NC}"
    else
        echo -e "${YELLOW}⚠ Parent has low memory footprint (pre-allocation may not be active)${NC}"
    fi
    
    log_section "Top 10 Memory Consumers (System-wide)"
    
    ps aux --sort=-%mem | head -11 | awk 'NR==1 || /xsys/ || NR<=11 {print}' | \
        awk '{printf "%-8s %-8s %6s%% %10s %s\n", $2, $1, $4, $6, $11}'
}

continuous_monitor() {
    while true; do
        clear
        monitor_memory
        echo ""
        echo "Press Ctrl+C to stop. Refreshing in 3 seconds..."
        sleep 3
    done
}

if [ "${1:-}" = "-c" ] || [ "${1:-}" = "--continuous" ]; then
    continuous_monitor
else
    monitor_memory
    echo ""
    echo "Tip: Use './monitor_memory.sh -c' for continuous monitoring"
fi
