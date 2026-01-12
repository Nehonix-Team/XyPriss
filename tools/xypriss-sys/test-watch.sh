#!/bin/bash
# Test script for watching functionality

echo "=== Testing File Watching API ==="
echo ""
echo "Starting watcher for 10 seconds..."
echo "In another terminal, try:"
echo "  cd $(pwd)/test-watch"
echo "  echo 'Modified!' > file.txt"
echo "  touch newfile.txt"
echo "  rm file.txt"
echo ""

# Start watching in background
timeout 10s ./target/release/xsys fs watch test-watch --duration 10 &
WATCH_PID=$!

# Wait a bit then make some changes
sleep 2
echo "Making changes..."
echo "Modified content at $(date)" > test-watch/file.txt
sleep 1
touch test-watch/newfile.txt
sleep 1
echo "Another change" >> test-watch/file.txt
sleep 1
rm test-watch/newfile.txt

# Wait for watcher to finish
wait $WATCH_PID

echo ""
echo "=== Watch test complete ==="
