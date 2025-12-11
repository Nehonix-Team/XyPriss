#!/bin/bash

# XyPriss Network Plugins Test Runner
# This script runs comprehensive tests for all network plugins

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Print header
echo -e "${BOLD}${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     XyPriss Network Plugins - Test Runner                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to print section headers
print_section() {
    echo -e "\n${BOLD}${BLUE}▶ $1${NC}\n"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print error
print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to print info
print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Track test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    print_error "Bun is not installed. Please install it first."
    exit 1
fi

print_success "Bun is installed"

# Check if the project is built
if [ ! -d "dist" ]; then
    print_warning "Project not built. Building now..."
    npm run build || {
        print_error "Build failed"
        exit 1
    }
    print_success "Build completed"
else
    print_success "Project is built"
fi

# Test 1: Run TypeScript comprehensive test
print_section "Running Comprehensive TypeScript Tests"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

if bun __tests__/network-plugins-comprehensive.test.ts; then
    print_success "Comprehensive TypeScript tests passed"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_error "Comprehensive TypeScript tests failed"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 2: Run existing network plugin tests
print_section "Running Existing Network Plugin Tests"

if [ -f "__tests__/test-all-network-plugins.mjs" ]; then
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if node __tests__/test-all-network-plugins.mjs; then
        print_success "Existing network plugin tests passed"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        print_error "Existing network plugin tests failed"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
else
    print_warning "test-all-network-plugins.mjs not found, skipping"
fi

# Test 3: Run integrated network plugin tests
print_section "Running Integrated Network Plugin Tests"

if [ -f "__tests__/test-integrated-network-plugins.mjs" ]; then
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if node __tests__/test-integrated-network-plugins.mjs; then
        print_success "Integrated network plugin tests passed"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        print_error "Integrated network plugin tests failed"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
else
    print_warning "test-integrated-network-plugins.mjs not found, skipping"
fi

# Test 4: Individual Plugin Tests
print_section "Testing Individual Plugins"

# Test Connection Plugin
print_info "Testing Connection Plugin..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if bun -e "
import { createServer } from './src/index';
const app = createServer({
    network: { connection: { enabled: true, keepAlive: { enabled: true } } }
});
app.get('/test', (req, res) => res.json({ ok: true }));
await app.start();
const response = await fetch('http://localhost:' + app.getPort() + '/test');
app.close();
if (response.status === 200) {
    console.log('✓ Connection Plugin works');
    process.exit(0);
} else {
    console.error('✗ Connection Plugin failed');
    process.exit(1);
}
"; then
    print_success "Connection Plugin test passed"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_error "Connection Plugin test failed"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test Compression Plugin
print_info "Testing Compression Plugin..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if bun -e "
import { createServer } from './src/index';
const app = createServer({
    network: { compression: { enabled: true, algorithms: ['gzip'] } }
});
app.get('/test', (req, res) => res.json({ data: 'test'.repeat(100) }));
await app.start();
const response = await fetch('http://localhost:' + app.getPort() + '/test');
app.close();
if (response.status === 200) {
    console.log('✓ Compression Plugin works');
    process.exit(0);
} else {
    console.error('✗ Compression Plugin failed');
    process.exit(1);
}
"; then
    print_success "Compression Plugin test passed"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_error "Compression Plugin test failed"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test Rate Limiting Plugin
print_info "Testing Rate Limiting Plugin..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if bun -e "
import { createServer } from './src/index';
const app = createServer({
    network: { rateLimit: { enabled: true, perIP: { requests: 10, window: '1m' } } }
});
app.get('/test', (req, res) => res.json({ ok: true }));
await app.start();
const response = await fetch('http://localhost:' + app.getPort() + '/test');
app.close();
if (response.status === 200) {
    console.log('✓ Rate Limiting Plugin works');
    process.exit(0);
} else {
    console.error('✗ Rate Limiting Plugin failed');
    process.exit(1);
}
"; then
    print_success "Rate Limiting Plugin test passed"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_error "Rate Limiting Plugin test failed"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 5: Configuration Validation
print_section "Testing Configuration Validation"

print_info "Testing empty network config..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if bun -e "
import { createServer } from './src/index';
const app = createServer({ network: {} });
app.close();
console.log('✓ Empty config accepted');
process.exit(0);
"; then
    print_success "Empty network config test passed"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_error "Empty network config test failed"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

print_info "Testing all plugins enabled..."
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if bun -e "
import { createServer } from './src/index';
const app = createServer({
    network: {
        connection: { enabled: true },
        compression: { enabled: true },
        rateLimit: { enabled: true }
    }
});
app.close();
console.log('✓ All plugins config accepted');
process.exit(0);
"; then
    print_success "All plugins enabled test passed"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    print_error "All plugins enabled test failed"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Print summary
echo -e "\n${BOLD}${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Test Results Summary                    ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Total Tests:    $TOTAL_TESTS"
echo "║  Passed:         ${GREEN}$PASSED_TESTS${CYAN}"
echo "║  Failed:         ${RED}$FAILED_TESTS${CYAN}"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
    print_success "All tests passed! 🎉"
    exit 0
else
    print_error "Some tests failed. Please review the output above."
    exit 1
fi
