#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "============================================"
echo "  Radiology Interoperability Platform"
echo "  Reset All Data"
echo "============================================"
echo ""

if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed."
  exit 1
fi

echo "WARNING: This will delete ALL data including:"
echo "  - PostgreSQL databases"
echo "  - Redis cache"
echo "  - MinIO stored documents"
echo ""
read -r -p "Are you sure? (y/N): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Stopping services and removing volumes..."
docker compose down -v

echo ""
echo "Removing orphan containers..."
docker compose rm -f 2>/dev/null || true

echo ""
echo "============================================"
echo "  Reset complete. All data has been removed."
echo ""
echo "  To start fresh: ./scripts/start.sh"
echo "============================================"
