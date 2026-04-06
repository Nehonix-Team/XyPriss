#!/bin/bash

BASE="http://localhost:3728/file"
PASS=0
FAIL=0

check() {
  local label="$1"
  local url="$2"
  local expected_status="${3:-200}"

  status=$(curl -sI -o /dev/null -w "%{http_code}" "$url")
  if [ "$status" == "$expected_status" ]; then
    echo "✅ [$status] $label"
    ((PASS++))
  else
    echo "❌ [$status != $expected_status] $label => $url"
    ((FAIL++))
  fi
}

check_body() {
  local label="$1"
  local url="$2"
  local expected="$3"

  body=$(curl -s "$url")
  if echo "$body" | grep -q "$expected"; then
    echo "✅ BODY $label => contient '$expected'"
    ((PASS++))
  else
    echo "❌ BODY $label => attendu '$expected', obtenu: $body"
    ((FAIL++))
  fi
}

echo "=============================="
echo "  Multiple Params in Segment"
echo "=============================="
check      "archive year-month-day"       "$BASE/archive/2024-03-15"
check_body "archive params"               "$BASE/archive/2024-03-15"        "year"
check      "files name.ext"               "$BASE/files/report.pdf"
check_body "files params"                 "$BASE/files/report.pdf"           "name"

echo ""
echo "=============================="
echo "  Wildcards"
echo "=============================="
check      "one-segment/* simple"         "$BASE/one-segment/hello"
check_body "one-segment/* body"           "$BASE/one-segment/hello"          "filename"
check      "one-segment/* deep (404?)"    "$BASE/one-segment/a/b/c"          404
check      "api/** simple"                "$BASE/api/v1/users"
check      "api/** deep"                  "$BASE/api/v1/users/42/posts"
check_body "api/** body"                  "$BASE/api/v1/users"               "capturedPath"
check      "users/:id/data/**"            "$BASE/users/99/data/files/img.png"
check_body "users/:id/data/** body"       "$BASE/users/99/data/files/img.png" "userId"

echo ""
echo "=============================="
echo "  Query Parameters"
echo "=============================="
check      "search avec q+limit"          "$BASE/search?q=hello&limit=10"
check_body "search body q"                "$BASE/search?q=hello&limit=10"    "query"
check_body "search body limit"            "$BASE/search?q=hello&limit=10"    "limit"
check      "search sans params"           "$BASE/search"

echo ""
echo "=============================="
echo "  Redirects"
echo "=============================="
check      "redirect /old/:id"            "$BASE/old/123"                    302
check      "redirect /legacy/:name"       "$BASE/legacy/books"               302

status_follow=$(curl -sI -o /dev/null -w "%{http_code}" -L "$BASE/old/123")
echo "   ↳ Suivi redirect /old/123 => HTTP $status_follow"

status_follow=$(curl -sI -o /dev/null -w "%{http_code}" -L "$BASE/legacy/books")
echo "   ↳ Suivi redirect /legacy/books => HTTP $status_follow"

echo ""
echo "=============================="
echo "  Misc"
echo "=============================="
check      "GET /test"                    "$BASE/test"
check_body "GET /test body"               "$BASE/test"                       "Hello World"

echo ""
echo "=============================="
printf "  Résultat: %d ✅  %d ❌\n" $PASS $FAIL
echo "=============================="