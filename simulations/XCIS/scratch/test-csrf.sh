#!/bin/bash
rm -f cookies.txt
TOKEN=$(curl -s -c cookies.txt http://localhost:8085/csrf-token | jq -r .token)
echo "Got token: $TOKEN"
curl -v -X POST -b cookies.txt -H "X-CSRF-Token: $TOKEN" -H "Referer: http://localhost:8085/" http://localhost:8085/submit
