#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "============================================"
echo "  Radiology Interoperability Platform"
echo "  First-Time Setup"
echo "============================================"
echo ""

# ── Check prerequisites ──────────────────────────────────
echo "[1/6] Checking prerequisites..."

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed. Please install Node.js >= 20."
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "ERROR: Node.js >= 20 is required (found v$(node -v))."
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "ERROR: npm is not installed."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "WARNING: Docker is not installed. You can still run services locally but not via docker compose."
fi

if command -v docker &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
  echo "WARNING: docker compose is not available. Make sure Docker Compose V2 is installed."
fi

echo "  Node.js $(node -v)"
echo "  npm $(npm -v)"
echo ""

# ── Install dependencies ─────────────────────────────────
echo "[2/6] Installing npm dependencies..."
npm ci
echo ""

# ── Build shared package ─────────────────────────────────
echo "[3/6] Building shared package..."
npm run build -w packages/shared
echo ""

# ── Build all TypeScript services ────────────────────────
echo "[4/6] Building TypeScript services..."
npm run build -w services/api-gateway
npm run build -w services/order-service
npm run build -w services/document-service
npm run build -w services/integration-service
echo ""

# ── Build Review UI ──────────────────────────────────────
echo "[5/6] Building Review UI..."
npm run build -w apps/review-ui
echo ""

# ── Create .env if missing ───────────────────────────────
echo "[6/6] Checking environment configuration..."
if [ ! -f "$PROJECT_ROOT/.env" ]; then
  cat > "$PROJECT_ROOT/.env" << 'ENVEOF'
# Radiology Interoperability Platform — Environment Variables
# Copy this to .env and adjust values for your environment.

# PostgreSQL
POSTGRES_USER=rip
POSTGRES_PASSWORD=rip_secret
POSTGRES_DB=radiology_platform

# Redis
REDIS_PASSWORD=redis_secret

# MinIO (S3-compatible storage)
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minio_secret
MINIO_BUCKET_DOCUMENTS=documents
MINIO_BUCKET_BACKUPS=backups

# JWT
JWT_SECRET=change-me-in-production
JWT_EXPIRY=1h

# Inter-service auth
SERVICE_SECRET=inter-service-secret

# NLP
CONFIDENCE_THRESHOLD=0.85
REVIEW_SLA_HOURS=4
SPACY_MODEL=en_core_web_sm

# Logging
LOG_LEVEL=info
ENVEOF
  echo "  Created .env with default values"
else
  echo "  .env already exists, skipping"
fi

echo ""
echo "============================================"
echo "  Setup complete!"
echo ""
echo "  To start all services:"
echo "    docker compose up --build -d"
echo ""
echo "  Or use the start script:"
echo "    ./scripts/start.sh"
echo ""
echo "  For development with hot reload:"
echo "    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build"
echo "============================================"
