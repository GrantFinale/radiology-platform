#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "============================================"
echo "  Radiology Interoperability Platform"
echo "  Stopping Services"
echo "============================================"
echo ""

if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed."
  exit 1
fi

echo "Stopping all containers..."
docker compose down

echo ""
echo "All services stopped."
echo ""
echo "  Note: Data volumes are preserved."
echo "  To also remove volumes: ./scripts/reset.sh"
echo "============================================"
