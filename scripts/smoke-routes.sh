#!/usr/bin/env bash
#
# scripts/smoke-routes.sh — the "all routes 200" sweep, encoded for CI + the
# runbook. Expects the started stack (start.sh): backend :5001, media :5002,
# storefront :3001, admin :3000, control-center :4000. Any non-200 (or
# expected redirect) fails.
#
# Usage: bash scripts/smoke-routes.sh [base-ports-overrides]

set -u

BACKEND="${1:-http://127.0.0.1:5001}"
MEDIA="${2:-http://127.0.0.1:5002}"
WEB="${3:-http://127.0.0.1:3001}"
ADMIN="${4:-http://127.0.0.1:3000}"
CONTROL="${5:-http://127.0.0.1:4000}"

fail=0

check() {
  local url="$1" expect="${2:-200}"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url" 2>/dev/null)
  if [ "$code" = "$expect" ]; then
    echo "  ok   $url -> $code"
  else
    echo "  FAIL $url -> $code (expected $expect)"
    fail=1
  fi
}

echo "backend  ($BACKEND)"
check "$BACKEND/readyz" 200
check "$BACKEND/healthz" 200

echo "media    ($MEDIA)"
check "$MEDIA/healthz" 200
check "$MEDIA/" 200

echo "storefront ($WEB)"
check "$WEB/" 200
check "$WEB/shop" 200
check "$WEB/bestsellers" 200
check "$WEB/checkout" 200
check "$WEB/AboutUs" 200
check "$WEB/shipping" 200
check "$WEB/terms" 200

echo "admin    ($ADMIN)"
check "$ADMIN/" 200

echo "control-center ($CONTROL)  — Next.js app + unauth-gated API"
# Root redirects to /login when unauthenticated (the SPA root is gone): accept
# either a 200 or the 3xx->/login redirect.
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$CONTROL/" 2>/dev/null)
if [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "302" ]; then
  echo "  ok   $CONTROL/ -> $code (200 or redirect to /login)"
else
  echo "  FAIL $CONTROL/ -> $code (expected 200 or 3xx redirect)"
  fail=1
fi
# The login page itself is server-rendered.
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$CONTROL/login" 2>/dev/null)
if [ "$code" = "200" ]; then
  echo "  ok   $CONTROL/login 200"
else
  echo "  FAIL $CONTROL/login -> $code (expected 200)"
  fail=1
fi
# setup-state is the only pre-auth endpoint; everything else must reject.
# 401 = configured but unauthenticated, 503 = first-run setup still pending.
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$CONTROL/api/dashboard/overview" 2>/dev/null)
if [ "$code" = "401" ] || [ "$code" = "503" ]; then
  echo "  ok   $CONTROL/api/* guarded -> $code"
else
  echo "  FAIL $CONTROL/api/* -> $code (expected 401/503 while unauthenticated)"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "SMOKE FAILED"
  exit 1
fi
echo "SMOKE OK"
exit 0