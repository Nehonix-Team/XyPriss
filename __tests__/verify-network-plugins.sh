#!/bin/bash

# Manual Verification Test Script for Network Plugins
# This script runs actual curl commands and shows you the results

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

PORT=9999
BASE_URL="http://localhost:$PORT"

echo -e "${BOLD}${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   XyPriss Network Plugins - Manual Verification Tests     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to print section
section() {
    echo -e "\n${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}$1${NC}"
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Function to run test
run_test() {
    local name="$1"
    local cmd="$2"
    local check="$3"
    
    echo -e "${YELLOW}📝 Test:${NC} $name"
    echo -e "${CYAN}Command:${NC} $cmd"
    echo ""
    
    # Run the command
    result=$(eval "$cmd" 2>&1)
    
    echo -e "${GREEN}Response:${NC}"
    echo "$result" | head -n 50
    
    # Check if we should verify something
    if [ -n "$check" ]; then
        if echo "$result" | grep -q "$check"; then
            echo -e "\n${GREEN}✓ Verification passed:${NC} Found '$check'"
        else
            echo -e "\n${RED}✗ Verification failed:${NC} Did not find '$check'"
        fi
    fi
    
    echo ""
}

# Wait for server to be ready
echo -e "${YELLOW}⏳ Waiting for server to be ready...${NC}"
sleep 2

# Check if server is running
if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${RED}✗ Server is not running on port $PORT${NC}"
    echo -e "${YELLOW}Please start the demo server first:${NC}"
    echo -e "  bun __tests__/network-plugins-manual-demo.ts"
    exit 1
fi

echo -e "${GREEN}✓ Server is ready!${NC}\n"

# ============================================================================
# TEST 1: Connection Plugin
# ============================================================================
section "TEST 1: Connection Plugin"

run_test \
    "Basic Connection Test" \
    "curl -s '$BASE_URL/test/connection' | jq '.plugin, .status, .features'" \
    "Connection Plugin"

run_test \
    "Check Keep-Alive Headers" \
    "curl -v '$BASE_URL/test/connection' 2>&1 | grep -i 'connection:'" \
    ""

# ============================================================================
# TEST 2: Compression Plugin
# ============================================================================
section "TEST 2: Compression Plugin"

run_test \
    "Small Response (No Compression Expected)" \
    "curl -s -H 'Accept-Encoding: gzip' '$BASE_URL/test/compression' | jq '.plugin, .status, .note'" \
    "Compression Plugin"

echo -e "${YELLOW}📝 Test:${NC} Large Response (Compression Expected)"
echo -e "${CYAN}Command:${NC} curl -v -H 'Accept-Encoding: gzip' '$BASE_URL/test/compression/large' 2>&1 | grep -i 'content-encoding'"
echo ""

compression_header=$(curl -v -H 'Accept-Encoding: gzip' "$BASE_URL/test/compression/large" 2>&1 | grep -i 'content-encoding:' || echo "No compression header found")

echo -e "${GREEN}Response Headers:${NC}"
echo "$compression_header"

if echo "$compression_header" | grep -qi 'gzip\|br\|deflate'; then
    echo -e "\n${GREEN}✓ Compression is working!${NC} Response is compressed"
else
    echo -e "\n${YELLOW}⚠ Compression header not found${NC} (might be handled by Bun runtime)"
fi

echo ""

# Show size comparison
echo -e "${YELLOW}📝 Test:${NC} Size Comparison (Compressed vs Uncompressed)"
echo ""

uncompressed_size=$(curl -s "$BASE_URL/test/compression/large" | wc -c)
compressed_size=$(curl -s -H 'Accept-Encoding: gzip' "$BASE_URL/test/compression/large" | wc -c)

echo -e "${CYAN}Uncompressed size:${NC} $uncompressed_size bytes"
echo -e "${CYAN}Compressed size:${NC} $compressed_size bytes"

if [ "$compressed_size" -lt "$uncompressed_size" ]; then
    reduction=$((100 - (compressed_size * 100 / uncompressed_size)))
    echo -e "${GREEN}✓ Compression working!${NC} Size reduced by ~${reduction}%"
else
    echo -e "${YELLOW}⚠ No size reduction detected${NC}"
fi

echo ""

# ============================================================================
# TEST 3: Rate Limiting Plugin
# ============================================================================
section "TEST 3: Rate Limiting Plugin"

run_test \
    "First Request (Should Succeed)" \
    "curl -s '$BASE_URL/test/ratelimit' | jq '.plugin, .status, .requestNumber'" \
    "Rate Limiting Plugin"

echo -e "${YELLOW}📝 Test:${NC} Rate Limit Headers"
echo -e "${CYAN}Command:${NC} curl -v '$BASE_URL/test/ratelimit' 2>&1 | grep -i 'ratelimit'"
echo ""

ratelimit_headers=$(curl -v "$BASE_URL/test/ratelimit" 2>&1 | grep -i 'ratelimit' || echo "No rate limit headers found")
echo -e "${GREEN}Rate Limit Headers:${NC}"
echo "$ratelimit_headers"
echo ""

echo -e "${YELLOW}📝 Test:${NC} Multiple Requests (Testing Rate Limiting)"
echo -e "${CYAN}Sending 25 requests rapidly...${NC}"
echo ""

success_count=0
limited_count=0

for i in {1..25}; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/test/ratelimit")
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}Request $i: 200 OK${NC}"
        success_count=$((success_count + 1))
    elif [ "$status" = "429" ]; then
        echo -e "${RED}Request $i: 429 Too Many Requests (RATE LIMITED)${NC}"
        limited_count=$((limited_count + 1))
    else
        echo -e "${YELLOW}Request $i: $status${NC}"
    fi
    sleep 0.1
done

echo ""
echo -e "${CYAN}Results:${NC}"
echo -e "  Successful: $success_count"
echo -e "  Rate Limited: $limited_count"

if [ "$limited_count" -gt 0 ]; then
    echo -e "${GREEN}✓ Rate limiting is working!${NC}"
else
    echo -e "${YELLOW}⚠ No rate limiting detected${NC} (limit might be higher than 25)"
fi

echo ""

# ============================================================================
# TEST 4: All Plugins Together
# ============================================================================
section "TEST 4: All Plugins Combined"

run_test \
    "All Plugins Active" \
    "curl -s -H 'Accept-Encoding: gzip' '$BASE_URL/test/all' | jq '.message, .plugins'" \
    "Testing all network plugins"

# ============================================================================
# TEST 5: Headers Inspection
# ============================================================================
section "TEST 5: Headers Inspection"

echo -e "${YELLOW}📝 Test:${NC} Full Response Headers"
echo -e "${CYAN}Command:${NC} curl -v '$BASE_URL/test/headers' 2>&1 | grep '^<'"
echo ""

headers=$(curl -v "$BASE_URL/test/headers" 2>&1 | grep '^<' | head -n 20)
echo -e "${GREEN}Response Headers:${NC}"
echo "$headers"

echo ""
echo -e "${CYAN}Looking for plugin-specific headers:${NC}"
echo "$headers" | grep -i 'content-encoding' && echo -e "${GREEN}✓ Compression header found${NC}" || echo -e "${YELLOW}⚠ No compression header${NC}"
echo "$headers" | grep -i 'connection' && echo -e "${GREEN}✓ Connection header found${NC}" || echo -e "${YELLOW}⚠ No connection header${NC}"
echo "$headers" | grep -i 'ratelimit' && echo -e "${GREEN}✓ Rate limit headers found${NC}" || echo -e "${YELLOW}⚠ No rate limit headers${NC}"

echo ""

# ============================================================================
# TEST 6: Server Statistics
# ============================================================================
section "TEST 6: Server Statistics"

run_test \
    "Server Stats" \
    "curl -s '$BASE_URL/stats' | jq '.plugins, .requests'" \
    ""

# ============================================================================
# Summary
# ============================================================================
echo -e "\n${BOLD}${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Verification Complete                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${GREEN}✓ All manual tests completed!${NC}\n"
echo -e "${CYAN}Summary:${NC}"
echo -e "  • Connection Plugin: Manages HTTP connections with keep-alive"
echo -e "  • Compression Plugin: Compresses large responses (>100 bytes)"
echo -e "  • Rate Limiting Plugin: Limits requests per IP (20/min)"
echo -e "  • All plugins can work together simultaneously"
echo ""
echo -e "${YELLOW}💡 Tip:${NC} Review the output above to verify each plugin is working as expected"
echo ""
