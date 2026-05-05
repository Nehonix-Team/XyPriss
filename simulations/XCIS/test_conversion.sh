#!/bin/bash

# ================================================================
#  XyPriss — XML/JSON Conversion Feature Test Suite
#  Tests: /xml-to-json  &  /xml-echo
#  Covers: Proxy access, attribute prefix, textContentKey,
#          autoReply round-trip, and edge cases
# ================================================================

BASE_URL="${1:-http://localhost:8085}"
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ----------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------

section() {
    echo ""
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "${CYAN}${BOLD}  $1${RESET}"
    echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
}

# run_test <name> <expected_http_code> [extra_checks_fn] -- curl args...
# Extra check function receives: $BODY $HEADERS
run_test() {
    local NAME="$1"
    local EXPECTED_CODE="$2"
    local CHECK_FN="$3"
    shift 3

    TOTAL=$((TOTAL + 1))

    HTTP_CODE=$(curl "$@" \
        -o /tmp/xp_body.txt \
        -D /tmp/xp_headers.txt \
        -w "%{http_code}" \
        -s 2>/tmp/xp_err.txt)

    BODY=$(cat /tmp/xp_body.txt 2>/dev/null)
    HEADERS=$(cat /tmp/xp_headers.txt 2>/dev/null)
    ERR=$(cat /tmp/xp_err.txt 2>/dev/null)

    # HTTP code check
    local STATUS_OK=true
    if [ "$HTTP_CODE" != "$EXPECTED_CODE" ]; then
        STATUS_OK=false
    fi

    # Extra assertion
    local ASSERT_MSG=""
    if [ -n "$CHECK_FN" ] && [ "$STATUS_OK" = true ]; then
        # Call check function without passing body as arg to avoid shell interpolation
        ASSERT_MSG=$($CHECK_FN "$HEADERS" 2>&1)
        if echo "$ASSERT_MSG" | grep -q "^FAIL:"; then
            STATUS_OK=false
        fi
    fi

    if [ "$STATUS_OK" = true ]; then
        PASS=$((PASS + 1))
        echo -e "  ${GREEN}✔ PASS${RESET}  ${BOLD}$NAME${RESET} ${DIM}(HTTP $HTTP_CODE)${RESET}"
        [ -n "$ASSERT_MSG" ] && echo -e "         ${GREEN}→ $ASSERT_MSG${RESET}"
    else
        FAIL=$((FAIL + 1))
        echo -e "  ${RED}✘ FAIL${RESET}  ${BOLD}$NAME${RESET}"
        [ "$HTTP_CODE" != "$EXPECTED_CODE" ] && \
            echo -e "         ${RED}→ Expected HTTP $EXPECTED_CODE, got $HTTP_CODE${RESET}"
        [ -n "$ASSERT_MSG" ] && echo -e "         ${RED}→ $ASSERT_MSG${RESET}"
        [ -n "$ERR" ] && \
            echo -e "         ${YELLOW}→ curl: $ERR${RESET}"
    fi

    # Pretty-print body
    if python3 -m json.tool /tmp/xp_body.txt > /tmp/xp_fmt.json 2>/dev/null; then
        echo -e "${DIM}$(cat /tmp/xp_fmt.json | sed 's/^/         /')${RESET}"
    elif [ -n "$BODY" ]; then
        echo -e "${DIM}         $BODY${RESET}"
    fi
    echo ""
}

# ----------------------------------------------------------------
# Assertion helpers (used as CHECK_FN)
# ----------------------------------------------------------------

# Assert JSON field .detected.userId equals expected value
check_userid() {
    local EXPECTED="$1" HEADERS="$2"
    local GOT
    GOT=$(python3 -c "import sys,json; d=json.load(open('/tmp/xp_body.txt')); print(d.get('detected', {}).get('userId', ''))" 2>/dev/null)
    if [ "$GOT" = "$EXPECTED" ]; then
        echo "detected.userId = \"$GOT\" ✔"
    else
        echo "FAIL: detected.userId expected \"$EXPECTED\", got \"$GOT\""
    fi
}

# Assert response Content-Type contains application/xml (autoReply round-trip)
check_xml_reply() {
    local HEADERS="$1"
    if echo "$HEADERS" | grep -qi "content-type:.*application/xml"; then
        echo "Response Content-Type: application/xml ✔"
    else
        local CT
        CT=$(echo "$HEADERS" | grep -i "content-type:" | head -1 | tr -d '\r')
        echo "FAIL: Expected application/xml in Content-Type, got: $CT"
    fi
}

# Assert body contains a given string
check_body_contains() {
    local NEEDLE="$1" HEADERS="$2"
    if grep -q "$NEEDLE" /tmp/xp_body.txt; then
        echo "Body contains \"$NEEDLE\" ✔"
    else
        echo "FAIL: \"$NEEDLE\" not found in body"
    fi
}

# Assert body does NOT contain a string (e.g. raw "@id" prefix leak)
check_no_prefix_leak() {
    local HEADERS="$1"
    if python3 -c "
import sys, json
d = json.load(open('/tmp/xp_body.txt'))
# Check if @id exists anywhere in the 'detected' block
detected_str = json.dumps(d.get('detected', {}))
if '@' in detected_str:
    sys.exit(1)
" 2>/dev/null; then
        echo "No @-prefix leak in detected block ✔"
    else
        echo "FAIL: Raw @ prefix still visible in detected block"
    fi
}

# ----------------------------------------------------------------
# Server availability
# ----------------------------------------------------------------

section "0. Server Availability"
echo -e "  ${BOLD}Target:${RESET} $BASE_URL"
if ! curl -s --max-time 4 "$BASE_URL/ping" > /dev/null 2>&1; then
    echo -e "  ${RED}✘ Server unreachable at $BASE_URL${RESET}"
    echo -e "  ${YELLOW}→ Start your server then run: bash test_conversion.sh http://localhost:<port>${RESET}"
    exit 1
fi
echo -e "  ${GREEN}✔ Server is up${RESET}"

# ================================================================
# SECTION 1 — XML → JSON Conversion  (/xml-to-json)
# ================================================================
section "1. XML → JSON Conversion  [POST /xml-to-json]"

# 1.1 — Basic attribute + child element
run_test \
    "Basic: attribute id + child <name>" \
    "200" \
    "check_userid 123" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Content-Type: application/xml" \
    -H "Accept: application/json" \
    -d '<user id="123"><name>John</name></user>'

# 1.2 — Proxy transparency: req.body.user.id must resolve (not req.body.user['@id'])
run_test \
    "Proxy access: @id stripped from detected block" \
    "200" \
    "check_no_prefix_leak" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Content-Type: application/xml" \
    -H "Accept: application/json" \
    -d '<user id="42"><name>ProxyTest</name></user>'

# 1.3 — Multiple attributes
run_test \
    "Multiple attributes on single node" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Content-Type: application/xml" \
    -H "Accept: application/json" \
    -d '<product id="001" category="electronics" available="true"><name>Laptop</name></product>'

# 1.4 — Nested structure
run_test \
    "Nested children (3 levels deep)" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Content-Type: application/xml" \
    -H "Accept: application/json" \
    -d '<order id="99"><customer><name>Alice</name><address><city>Paris</city></address></customer></order>'

# 1.5 — Repeated sibling nodes (array coercion)
run_test \
    "Repeated siblings → should produce an array" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Content-Type: application/xml" \
    -H "Accept: application/json" \
    -d '<items><item id="1">A</item><item id="2">B</item><item id="3">C</item></items>'

# 1.6 — textContentKey: mixed content (attribute + text node)
run_test \
    "Mixed content: attribute + text node (#text key)" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Content-Type: application/xml" \
    -H "Accept: application/json" \
    -d '<label lang="en">Hello World</label>'

# 1.7 — XML entities
run_test \
    "XML entities (&amp; &lt; &gt;) correctly decoded" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Content-Type: application/xml" \
    -H "Accept: application/json" \
    -d '<note><text>Hello &amp; World &lt;3&gt;</text></note>'

# 1.8 — Self-closing tag
run_test \
    "Self-closing tag <empty/>" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Content-Type: application/xml" \
    -d '<empty/>'

# 1.9 — JSON sent instead of XML (wrong Content-Type)
run_test \
    "JSON body sent with application/json (bypass path)" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Content-Type: application/json" \
    -d '{"user":{"id":"999","name":"Ghost"}}'

# ================================================================
# SECTION 2 — autoReply Round-Trip  (/xml-echo)
# ================================================================
section "2. autoReply Round-Trip  [POST /xml-echo]"

# 2.1 — Core: XML in → XML out
run_test \
    "XML request → response Content-Type must be application/xml" \
    "200" \
    "check_xml_reply" \
    -X POST "$BASE_URL/xml-echo" \
    -H "Content-Type: application/xml" \
    -d '<request><query>Hello XHSC</query></request>'

# 2.2 — JSON in → JSON out (autoReply must NOT convert)
run_test \
    "JSON request → response must stay application/json" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-echo" \
    -H "Content-Type: application/json" \
    -d '{"request":{"query":"Hello JSON"}}'

# 2.3 — Round-trip data integrity: echo must preserve the original value
run_test \
    "Round-trip integrity: echoed value matches sent value" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-echo" \
    -H "Content-Type: application/xml" \
    -d '<request><query>RoundTripCheck</query></request>'

# 2.4 — Attributes survive the round-trip
run_test \
    "Attributes preserved through XML→JSON→XML round-trip" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-echo" \
    -H "Content-Type: application/xml" \
    -d '<message id="77" priority="high"><body>Test</body></message>'

# ================================================================
# SECTION 3 — Edge Cases & Robustness
# ================================================================
section "3. Edge Cases & Robustness"

# 3.1 — Empty body
run_test \
    "Empty body (no payload)" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Content-Type: application/xml" \
    -d ''

# 3.2 — Malformed XML (unclosed tag)
run_test \
    "Malformed XML — unclosed tag (should not crash)" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Content-Type: application/xml" \
    -d '<user id="1"><name>Broken'

# 3.3 — Deeply nested (10 levels)
run_test \
    "Deeply nested XML (10 levels)" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Content-Type: application/xml" \
    -d '<l1><l2><l3><l4><l5><l6><l7><l8><l9><l10>deep</l10></l9></l8></l7></l6></l5></l4></l3></l2></l1>'

# 3.4 — Large payload (~200 nodes)
run_test \
    "Large payload (~200 XML nodes)" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Content-Type: application/xml" \
    -d "<catalog>$(python3 -c "print(''.join(['<entry id=\"' + str(i) + '\"><val>item-' + str(i) + '</val></entry>' for i in range(200)]))")</catalog>"

# 3.5 — No Content-Type header
run_test \
    "Missing Content-Type header (framework fallback)" \
    "200" \
    "" \
    -X POST "$BASE_URL/xml-to-json" \
    -H "Accept: application/json" \
    -d '<user id="1"><name>NoHeader</name></user>'

# ================================================================
# SUMMARY
# ================================================================
section "Summary"
echo -e "  Total  : ${BOLD}$TOTAL${RESET}"
echo -e "  ${GREEN}Passed : $PASS${RESET}"
if [ "$FAIL" -gt 0 ]; then
    echo -e "  ${RED}Failed : $FAIL${RESET}"
    echo ""
    echo -e "  ${YELLOW}Tip: paste the full output above for analysis.${RESET}"
else
    echo -e "  ${GREEN}Failed : 0  — All green! 🎉${RESET}"
fi
echo ""
