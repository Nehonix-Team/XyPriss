#!/bin/bash
BASE_URL="http://localhost:4013/file"

echo "--- Path Parameters ---"
curl -s "$BASE_URL/users/123"
curl -s "$BASE_URL/posts/2026/04/hello-world"

echo -e "\n--- Regex Constraints ---"
echo -n "GET $BASE_URL/regex/abc: " && curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/regex/abc"
curl -s "$BASE_URL/regex/123"
echo -n "GET $BASE_URL/shop/test: " && curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/shop/test"
curl -s "$BASE_URL/shop/apple-orange-banana"

echo -e "\n--- Typed Parameters ---"
echo -n "GET $BASE_URL/items/abc: " && curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/items/abc"
curl -s "$BASE_URL/items/456"
echo -n "GET $BASE_URL/category/123: " && curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/category/123"
curl -s "$BASE_URL/category/books"

echo -e "\n--- Multi-parameter Segments ---"
curl -s "$BASE_URL/archive/2026-04-05"
curl -s "$BASE_URL/files/image.png"

echo -e "\n--- Wildcards ---"
curl -s "$BASE_URL/one-segment/doc.pdf"
echo -n "GET $BASE_URL/one-segment/folder/doc.pdf: " && curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/one-segment/folder/doc.pdf"
curl -s "$BASE_URL/api/v1/users/list"
curl -s "$BASE_URL/users/1/data/docs/personal/id.pdf"

echo -e "\n--- Query Parameters ---"
curl -s "$BASE_URL/search?q=xypriss&limit=10"

echo -e "\n--- Redirects ---"
curl -s -i "$BASE_URL/old/999" | grep Location
curl -s -i "$BASE_URL/legacy/music" | grep Location
