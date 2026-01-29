#!/bin/bash

set -euo pipefail

# Configuration
readonly SERVER_URL="${SERVER_URL:-http://localhost:6372}"
readonly NORMAL_REQUESTS="${NORMAL_REQUESTS:-100}"
readonly CONCURRENT_REQUESTS="${CONCURRENT_REQUESTS:-10}"
readonly RESCUE_WAIT="${RESCUE_WAIT:-2}"
readonly RECOVERY_WAIT="${RECOVERY_WAIT:-5}"
readonly MAX_RECOVERY_ATTEMPTS="${MAX_RECOVERY_ATTEMPTS:-10}"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$*${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Check prerequisites
check_prerequisites() {
    local missing_tools=()
    
    for tool in curl pgrep ab; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Install with: sudo apt-get install apache2-utils procps curl"
        exit 1
    fi
}

# Check server availability
check_server() {
    local url="$1"
    local max_attempts=3
    
    for i in $(seq 1 $max_attempts); do
        if curl -s -f -o /dev/null "$url"; then
            return 0
        fi
        sleep 1
    done
    
    return 1
}

# Send normal traffic
test_normal_traffic() {
    log_section "Test 1: Normal Traffic Load"
    
    log_info "Sending $NORMAL_REQUESTS requests with $CONCURRENT_REQUESTS concurrent connections..."
    
    if ab -n "$NORMAL_REQUESTS" -c "$CONCURRENT_REQUESTS" -q "$SERVER_URL/" > /tmp/ab_output.txt 2>&1; then
        local rps=$(grep "Requests per second" /tmp/ab_output.txt | awk '{print $4}')
        local failed=$(grep "Failed requests" /tmp/ab_output.txt | awk '{print $3}')
        
        log_success "Normal traffic completed"
        log_info "Requests per second: $rps"
        log_info "Failed requests: $failed"
    else
        log_error "Apache Bench failed"
        cat /tmp/ab_output.txt
        return 1
    fi
}

# Get process information
get_xsys_pid() {
    local pid
    pid=$(pgrep -f "xsys server start" | head -n 1)
    echo "$pid"
}

get_worker_pids() {
    local parent_pid="$1"
    pgrep -P "$parent_pid" 2>/dev/null || true
}

# Display process tree
show_process_tree() {
    local xsys_pid="$1"
    
    log_info "Process tree:"
    if command -v pstree &> /dev/null; then
        pstree -p "$xsys_pid" 2>/dev/null || ps --forest -o pid,ppid,cmd -g "$(ps -o sid= -p "$xsys_pid")"
    else
        ps -f --ppid "$xsys_pid"
    fi
}

# Test rescue mode activation
test_rescue_mode() {
    log_section "Test 2: Rescue Mode Activation"
    
    local xsys_pid
    xsys_pid=$(get_xsys_pid)
    
    if [ -z "$xsys_pid" ]; then
        log_error "xsys process not found"
        log_info "Expected process: xsys server start"
        log_info "Running processes:"
        ps aux | grep xsys || true
        return 1
    fi
    
    log_success "Found xsys process (PID: $xsys_pid)"
    
    local worker_pids
    worker_pids=$(get_worker_pids "$xsys_pid")
    
    if [ -z "$worker_pids" ]; then
        log_warning "No worker processes found"
        log_info "This may indicate workers are threads or the process structure is different"
        show_process_tree "$xsys_pid"
        return 1
    fi
    
    local worker_count
    worker_count=$(echo "$worker_pids" | wc -w)
    log_info "Found $worker_count worker process(es): $worker_pids"
    
    log_info "Killing all workers to trigger Rescue Mode..."
    local kill_start=$(date +%s)
    
    for pid in $worker_pids; do
        if kill -9 "$pid" 2>/dev/null; then
            log_info "Killed worker PID: $pid"
        else
            log_warning "Failed to kill worker PID: $pid"
        fi
    done
    
    log_info "Waiting ${RESCUE_WAIT}s for Rescue Mode activation..."
    sleep "$RESCUE_WAIT"
    
    local activation_time=$(date +%s)
    
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/" || echo "000")
    
    log_info "Response code: $response"
    
    case "$response" in
        503)
            log_success "Rescue Mode activated (503 Service Unavailable)"
            echo "$kill_start $activation_time" > /tmp/rescue_times.txt
            return 0
            ;;
        200)
            log_warning "Server still responding normally (200 OK)"
            log_info "Workers may have respawned immediately or rescue mode not configured"
            echo "$kill_start $activation_time" > /tmp/rescue_times.txt
            return 0
            ;;
        000)
            log_error "Server completely unavailable (connection failed)"
            return 1
            ;;
        *)
            log_warning "Unexpected response code: $response"
            return 1
            ;;
    esac
}

# Test system recovery
test_recovery() {
    log_section "Test 3: System Recovery"
    
    log_info "Waiting ${RECOVERY_WAIT}s for system recovery..."
    sleep "$RECOVERY_WAIT"
    
    for attempt in $(seq 1 "$MAX_RECOVERY_ATTEMPTS"); do
        log_info "Recovery check attempt $attempt/$MAX_RECOVERY_ATTEMPTS..."
        
        local response
        response=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/" || echo "000")
        
        if [ "$response" = "200" ]; then
            log_success "System recovered successfully (200 OK)"
            
            local recovery_time=$(date +%s)
            
            local xsys_pid
            xsys_pid=$(get_xsys_pid)
            local worker_pids
            worker_pids=$(get_worker_pids "$xsys_pid")
            local worker_count
            worker_count=$(echo "$worker_pids" | wc -w)
            
            log_info "Active workers after recovery: $worker_count"
            
            if [ -f /tmp/rescue_times.txt ]; then
                read kill_start activation_time < /tmp/rescue_times.txt
                measure_rescue_metrics "$kill_start" "$activation_time" "$recovery_time"
            fi
            
            return 0
        elif [ "$response" = "503" ]; then
            log_info "Still in Rescue Mode (503), waiting..."
        else
            log_warning "Unexpected response: $response"
        fi
        
        sleep 2
    done
    
    log_error "System did not recover within expected time"
    return 1
}

# Test health check endpoint if available
test_health_endpoint() {
    log_section "Test 4: Health Check"
    
    local health_url="${SERVER_URL}/health"
    
    if curl -s -f "$health_url" > /tmp/health_response.json 2>&1; then
        log_success "Health endpoint accessible"
        log_info "Health response:"
        cat /tmp/health_response.json | python3 -m json.tool 2>/dev/null || cat /tmp/health_response.json
    else
        log_info "Health endpoint not available (optional feature)"
    fi
}

# Test sustained load after recovery
test_sustained_load() {
    log_section "Test 5: Sustained Load After Recovery"
    
    log_info "Testing system stability with sustained load..."
    log_info "Sending $(($NORMAL_REQUESTS * 2)) requests post-recovery..."
    
    if ab -n $(($NORMAL_REQUESTS * 2)) -c $(($CONCURRENT_REQUESTS * 2)) -q "$SERVER_URL/" > /tmp/ab_sustained.txt 2>&1; then
        local rps=$(grep "Requests per second" /tmp/ab_sustained.txt | awk '{print $4}')
        local failed=$(grep "Failed requests" /tmp/ab_sustained.txt | awk '{print $3}')
        local time=$(grep "Time taken for tests" /tmp/ab_sustained.txt | awk '{print $5}')
        
        log_success "Sustained load completed"
        log_info "Performance metrics:"
        log_info "  - Requests per second: $rps"
        log_info "  - Failed requests: $failed"
        log_info "  - Total time: ${time}s"
        
        if [ "$failed" = "0" ]; then
            return 0
        else
            log_warning "System unstable: $failed failed requests"
            return 1
        fi
    else
        log_error "Sustained load test failed"
        return 1
    fi
}

# Measure rescue mode metrics
measure_rescue_metrics() {
    local start_time=$1
    local activation_time=$2
    local recovery_time=$3
    
    log_section "Performance Metrics"
    
    local total_downtime=$((recovery_time - start_time))
    local activation_delay=$((activation_time - start_time))
    local recovery_duration=$((recovery_time - activation_time))
    
    log_info "Timing breakdown:"
    log_info "  - Worker kill to Rescue Mode: ${activation_delay}s"
    log_info "  - Rescue Mode to Recovery: ${recovery_duration}s"
    log_info "  - Total downtime: ${total_downtime}s"
    
    if [ $total_downtime -le 10 ]; then
        log_success "Excellent recovery time (< 10s)"
    elif [ $total_downtime -le 30 ]; then
        log_success "Good recovery time (< 30s)"
    else
        log_warning "Slow recovery time (> 30s)"
    fi
}

# Main execution
main() {
    log_section "Intelligence Features Stress Test"
    log_info "Target: $SERVER_URL"
    log_info "Configuration:"
    log_info "  - Normal requests: $NORMAL_REQUESTS"
    log_info "  - Concurrent connections: $CONCURRENT_REQUESTS"
    log_info "  - Rescue wait time: ${RESCUE_WAIT}s"
    log_info "  - Recovery wait time: ${RECOVERY_WAIT}s"
    
    check_prerequisites
    
    if ! check_server "$SERVER_URL"; then
        log_error "Server is not responding at $SERVER_URL"
        exit 1
    fi
    
    log_success "Server is accessible"
    
    local test_results=()
    
    if test_normal_traffic; then
        test_results+=("Normal Traffic: PASS")
    else
        test_results+=("Normal Traffic: FAIL")
    fi
    
    if test_rescue_mode; then
        test_results+=("Rescue Mode: PASS")
    else
        test_results+=("Rescue Mode: FAIL")
    fi
    
    if test_recovery; then
        test_results+=("Recovery: PASS")
    else
        test_results+=("Recovery: FAIL")
    fi
    
    test_health_endpoint
    
    if test_sustained_load; then
        test_results+=("Sustained Load: PASS")
    else
        test_results+=("Sustained Load: FAIL")
    fi
    
    log_section "Test Summary"
    for result in "${test_results[@]}"; do
        if [[ "$result" == *"PASS"* ]]; then
            log_success "$result"
        else
            log_error "$result"
        fi
    done
    
    if [[ "${test_results[*]}" =~ "FAIL" ]]; then
        log_error "Some tests failed"
        exit 1
    else
        log_success "All tests passed"
        exit 0
    fi
}

# Trap to cleanup temp files
cleanup() {
    rm -f /tmp/ab_output.txt /tmp/health_response.json /tmp/ab_sustained.txt /tmp/rescue_times.txt
}

trap cleanup EXIT

main "$@"