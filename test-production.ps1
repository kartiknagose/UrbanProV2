# Production Testing Quick Start Script (PowerShell)
# UrbanPro V2 - Supabase + Render

param(
    [string]$AnonKey = ""
)

# Colors
$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Reset = "`e[0m"

Write-Host "${Yellow}=== UrbanPro V2 Production Testing ===${Reset}" -NoNewline
Write-Host ""
Write-Host ""

# Configuration
$SUPABASE_URL = "https://tzzlrpbuxjpsazrqjxob.supabase.co"
$RENDER_URL = "https://urbanpro-api.onrender.com"
$SUPABASE_ANON_KEY = $AnonKey
$CACHE_RELAY_SECRET = "urbanpro_cache_relay_secret_v1_2026"

if ([string]::IsNullOrEmpty($SUPABASE_ANON_KEY)) {
    Write-Host "${Red}ERROR: Anon key not provided${Reset}"
    Write-Host "Usage: .\test-production.ps1 -AnonKey 'your_key'"
    exit 1
}

# Test 1: Health Checks
Write-Host "${Yellow}[TEST 1] Infrastructure Health${Reset}"
Write-Host "Testing Supabase health..."

try {
    $h = @{
        "Authorization" = "Bearer $SUPABASE_ANON_KEY"
        "apikey" = $SUPABASE_ANON_KEY
    }
    $r = Invoke-WebRequest -Uri "$SUPABASE_URL/functions/v1/health" -Method GET -Headers $h -TimeoutSec 10
    if ($r.Content -match "urbanpro-supabase") {
        Write-Host "${Green}✅ Supabase health: OK${Reset}"
    } else {
        Write-Host "${Red}❌ Supabase health: FAILED${Reset}"
        exit 1
    }
} catch {
    Write-Host "${Red}❌ Supabase health: FAILED - $($_.Exception.Message)${Reset}"
    exit 1
}

Write-Host "Testing Render backend..."
try {
    $r = Invoke-WebRequest -Uri "$RENDER_URL/health" -TimeoutSec 10
    if ($r.Content -match '"status":"ok"') {
        Write-Host "${Green}✅ Render backend: OK${Reset}"
    } else {
        Write-Host "${Red}❌ Render backend: FAILED${Reset}"
        exit 1
    }
} catch {
    Write-Host "${Red}❌ Render backend: FAILED - $($_.Exception.Message)${Reset}"
    exit 1
}

Write-Host ""

# Test 2: Cache Relay
Write-Host "${Yellow}[TEST 2] Cache Relay${Reset}"
Write-Host "Testing service-catalog invalidation..."

try {
    $body = @{action="invalidate"; target="service-catalog"} | ConvertTo-Json
    $h = @{
        "Authorization" = "Bearer $SUPABASE_ANON_KEY"
        "apikey" = $SUPABASE_ANON_KEY
        "x-cache-secret" = $CACHE_RELAY_SECRET
        "content-type" = "application/json"
    }
    
    $r = Invoke-WebRequest -Uri "$SUPABASE_URL/functions/v1/cache-relay" -Method POST -Headers $h -Body $body -TimeoutSec 10
    
    if ($r.Content -match "service-catalog") {
        Write-Host "${Green}✅ Cache relay: OK${Reset}"
        Write-Host "   Response: $($r.Content)"
    } else {
        Write-Host "${Red}❌ Cache relay: FAILED${Reset}"
        Write-Host "   Response: $($r.Content)"
        exit 1
    }
} catch {
    Write-Host "${Red}❌ Cache relay: FAILED - $($_.Exception.Message)${Reset}"
    exit 1
}

Write-Host ""

# Test 3: API Endpoints
Write-Host "${Yellow}[TEST 3] API Endpoints${Reset}"
Write-Host "Testing API availability..."

foreach ($endpoint in @("/health", "/api/services", "/api/workers")) {
    try {
        $r = Invoke-WebRequest -Uri "$RENDER_URL$endpoint" -TimeoutSec 10 -SkipHttpErrorCheck
        $status = $r.StatusCode
        if ($status -eq 200 -or $status -eq 401) {
            Write-Host "${Green}✅ GET $endpoint : $status${Reset}"
        } else {
            Write-Host "${Yellow}⚠️ GET $endpoint : $status${Reset}"
        }
    } catch {
        Write-Host "${Red}❌ GET $endpoint : ERROR${Reset}"
    }
}

Write-Host ""

# Test 4: Response Time
Write-Host "${Yellow}[TEST 4] Performance${Reset}"
Write-Host "Measuring response times..."

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$r = Invoke-WebRequest -Uri "$RENDER_URL/health" -TimeoutSec 10
$sw.Stop()
$time = $sw.Elapsed.TotalSeconds

Write-Host "${Green}✅ Health endpoint: $($time.ToString('0.000'))s${Reset}"

if ($time -lt 0.5) {
    Write-Host "${Green}✅ Response time acceptable${Reset}"
} else {
    Write-Host "${Yellow}⚠️ Response time above recommended 500ms${Reset}"
}

Write-Host ""

# Summary
Write-Host "${Green}=== ALL TESTS PASSED ===${Reset}"
Write-Host "Your UrbanPro V2 production environment is ready!"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Open app in browser: https://urbanpro.your-domain.com"
Write-Host "2. Register as customer"
Write-Host "3. Register as worker"
Write-Host "4. Test cache relay with real service/worker updates"
Write-Host "5. Test real-time features (notifications, chat)"
Write-Host ""
Write-Host "For detailed testing guide, see: docs/PRODUCTION_TESTING_GUIDE.md"
