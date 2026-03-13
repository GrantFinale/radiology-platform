#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "============================================"
echo "  Radiology Interoperability Platform"
echo "  Starting Services"
echo "============================================"
echo ""

# ── Check Docker is available ────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed."
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running. Please start Docker."
  exit 1
fi

if ! docker compose version &>/dev/null 2>&1; then
  echo "ERROR: docker compose is not available. Please install Docker Compose V2."
  exit 1
fi

echo "[1/3] Building and starting all services..."
docker compose up --build -d

echo ""
echo "[2/3] Waiting for services to become healthy..."

MAX_WAIT=120
ELAPSED=0
INTERVAL=5

check_health() {
  local service=$1
  local status
  status=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "missing")
  echo "$status"
}

SERVICES=(
  "rip-postgres"
  "rip-redis"
  "rip-minio"
  "rip-api-gateway"
  "rip-order-service"
  "rip-document-service"
  "rip-nlp-service"
  "rip-integration-service"
  "rip-review-ui"
)

while [ $ELAPSED -lt $MAX_WAIT ]; do
  ALL_HEALTHY=true
  for svc in "${SERVICES[@]}"; do
    status=$(check_health "$svc")
    if [ "$status" != "healthy" ]; then
      ALL_HEALTHY=false
      break
    fi
  done

  if $ALL_HEALTHY; then
    break
  fi

  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
  echo "  Waiting... (${ELAPSED}s / ${MAX_WAIT}s)"
done

echo ""
echo "[3/3] Service status:"
for svc in "${SERVICES[@]}"; do
  status=$(check_health "$svc")
  printf "  %-30s %s\n" "$svc" "$status"
done

echo ""
echo "============================================"
echo "  Access URLs:"
echo ""
echo "  Review UI:        http://localhost:${REVIEW_UI_PORT:-3005}"
echo "  API Gateway:      http://localhost:${API_GATEWAY_PORT:-3000}"
echo "  MinIO Console:    http://localhost:${MINIO_CONSOLE_PORT:-9001}"
echo "  PostgreSQL:       localhost:${POSTGRES_PORT:-5432}"
echo "  Redis:            localhost:${REDIS_PORT:-6379}"
echo ""
echo "  Demo credentials:"
echo "    admin / admin123"
echo "    reviewer / reviewer123"
echo "    technician / tech123"
echo "============================================"
