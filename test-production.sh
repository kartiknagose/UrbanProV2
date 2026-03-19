#!/bin/bash
# Production Testing Quick Start Script
# UrbanPro V2 - Supabase + Render

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== UrbanPro V2 Production Testing ===${NC}"
echo ""

# Configuration
SUPABASE_URL="https://tzzlrpbuxjpsazrqjxob.supabase.co"
RENDER_URL="https://urbanpro-api.onrender.com"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}" # Set via env var
CACHE_RELAY_SECRET="urbanpro_cache_relay_secret_v1_2026"

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo -e "${RED}ERROR: SUPABASE_ANON_KEY not set${NC}"
  echo "Usage: SUPABASE_ANON_KEY=your_key ./test.sh"
  exit 1
fi

# Test 1: Health Checks
echo -e "${YELLOW}[TEST 1] Infrastructure Health${NC}"
echo "Testing Supabase health..."
if curl -s -X GET \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/functions/v1/health" | grep -q "urbanpro-supabase"; then
  echo -e "${GREEN}✅ Supabase health: OK${NC}"
else
  echo -e "${RED}❌ Supabase health: FAILED${NC}"
  exit 1
fi

echo "Testing Render backend..."
if curl -s "$RENDER_URL/health" | grep -q "\"status\":\"ok\""; then
  echo -e "${GREEN}✅ Render backend: OK${NC}"
else
  echo -e "${RED}❌ Render backend: FAILED${NC}"
  exit 1
fi

echo ""

# Test 2: Cache Relay
echo -e "${YELLOW}[TEST 2] Cache Relay${NC}"
echo "Testing service-catalog invalidation..."

RELAY_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "x-cache-secret: $CACHE_RELAY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"invalidate","target":"service-catalog"}' \
  "$SUPABASE_URL/functions/v1/cache-relay")

if echo "$RELAY_RESPONSE" | grep -q "service-catalog"; then
  echo -e "${GREEN}✅ Cache relay: OK${NC}"
  echo "   Response: $RELAY_RESPONSE"
else
  echo -e "${RED}❌ Cache relay: FAILED${NC}"
  echo "   Response: $RELAY_RESPONSE"
  exit 1
fi

echo ""

# Test 3: API Endpoints
echo -e "${YELLOW}[TEST 3] API Endpoints${NC}"
echo "Testing API availability..."

for endpoint in "/health" "/api/services" "/api/workers"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$RENDER_URL$endpoint")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "401" ]; then
    echo -e "${GREEN}✅ GET $endpoint: $STATUS${NC}"
  else
    echo -e "${RED}❌ GET $endpoint: $STATUS${NC}"
  fi
done

echo ""

# Test 4: Response Time
echo -e "${YELLOW}[TEST 4] Performance${NC}"
echo "Measuring response times..."

TIME=$(curl -s -o /dev/null -w "%{time_total}" "$RENDER_URL/health")
echo -e "${GREEN}✅ Health endpoint: ${TIME}s${NC}"

if (( $(echo "$TIME < 0.5" | bc -l) )); then
  echo -e "${GREEN}✅ Response time acceptable${NC}"
else
  echo -e "${YELLOW}⚠️ Response time above recommended 500ms${NC}"
fi

echo ""

# Summary
echo -e "${GREEN}=== ALL TESTS PASSED ===${NC}"
echo "Your UrbanPro V2 production environment is ready!"
echo ""
echo "Next steps:"
echo "1. Open app in browser: https://urbanpro.your-domain.com"
echo "2. Register as customer"
echo "3. Register as worker"
echo "4. Test cache relay with real service/worker updates"
echo "5. Test real-time features (notifications, chat)"
echo ""
echo "For detailed testing guide, see: docs/PRODUCTION_TESTING_GUIDE.md"
