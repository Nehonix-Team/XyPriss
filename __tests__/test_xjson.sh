#!/bin/bash

echo "Testing XJson vs regular JSON endpoints..."
echo ""

echo "1. Testing regular JSON endpoint (should show serialization error):"
echo "   GET /"
curl -s localhost:8085/ | jq .
echo ""

echo "2. Testing XJson endpoint (should work correctly):"
echo "   GET /.xJson"
curl -s localhost:8085/.xJson | jq .
echo ""

echo "3. Comparing response sizes:"
echo "   Regular JSON: $(curl -s localhost:8085/ | wc -c) bytes"
echo "   XJson:        $(curl -s localhost:8085/.xJson | wc -c) bytes"
echo ""

echo "Test completed!"
