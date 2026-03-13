#!/bin/bash
set -euo pipefail

# Creates a self-contained tarball of the Radiology Interoperability Platform.
# The bundle includes all source code, Docker configs, and documentation.
# It can be extracted on any machine with Docker and started immediately.
# Excludes: node_modules, .git, dist, __pycache__, .env (secrets)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="radiology-platform"
VERSION=$(cat "${SCRIPT_DIR}/VERSION" 2>/dev/null | tr -d '[:space:]' || echo "0.0.0")
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUNDLE_NAME="${PROJECT_NAME}-${VERSION}-${TIMESTAMP}"
OUTPUT_DIR="${SCRIPT_DIR}"
TARBALL="${OUTPUT_DIR}/${BUNDLE_NAME}.tar.gz"

echo "=============================================="
echo "  Radiology Interoperability Platform"
echo "  Portable Bundle Creator v${VERSION}"
echo "=============================================="
echo ""

# ── Validate project structure ────────────────────────────────
echo "[1/4] Validating project structure..."

REQUIRED_FILES=(
    "docker-compose.yml"
    "package.json"
    ".env.example"
    "VERSION"
    "QUICK_START.txt"
    "README.md"
    "Makefile"
)

REQUIRED_DIRS=(
    "services/api-gateway"
    "services/order-service"
    "services/document-service"
    "services/nlp-service"
    "services/integration-service"
    "apps/review-ui"
    "packages/shared"
)

MISSING=0

for f in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "${SCRIPT_DIR}/${f}" ]; then
        echo "  ERROR: Missing required file: ${f}"
        MISSING=1
    fi
done

for d in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "${SCRIPT_DIR}/${d}" ]; then
        echo "  ERROR: Missing required directory: ${d}"
        MISSING=1
    fi
done

if [ "${MISSING}" -eq 1 ]; then
    echo ""
    echo "Bundle creation aborted. Fix the issues above and retry."
    exit 1
fi

echo "  All required files and directories present."

# ── Create tarball ────────────────────────────────────────────
echo ""
echo "[2/4] Creating portable bundle..."

tar czf "${TARBALL}" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='__pycache__' \
    --exclude='.env' \
    --exclude='*.tar.gz' \
    --exclude='.DS_Store' \
    --exclude='coverage' \
    --exclude='.nyc_output' \
    --exclude='backups' \
    -C "$(dirname "${SCRIPT_DIR}")" \
    "$(basename "${SCRIPT_DIR}")"

echo "  Bundle created."

# ── Verify tarball contents ──────────────────────────────────
echo ""
echo "[3/4] Verifying bundle contents..."

FILE_COUNT=$(tar tzf "${TARBALL}" | wc -l | tr -d '[:space:]')
echo "  Files in bundle: ${FILE_COUNT}"

# Verify key files are present in the archive
for f in "docker-compose.yml" "QUICK_START.txt" ".env.example" "README.md"; do
    if tar tzf "${TARBALL}" | grep -q "${f}$"; then
        echo "  OK: ${f}"
    else
        echo "  WARNING: ${f} not found in bundle"
    fi
done

# ── Print summary ────────────────────────────────────────────
echo ""
echo "[4/4] Bundle complete."
echo ""

BUNDLE_SIZE=$(ls -lh "${TARBALL}" | awk '{print $5}')

echo "=============================================="
echo "  Bundle:  ${TARBALL}"
echo "  Size:    ${BUNDLE_SIZE}"
echo "  Version: ${VERSION}"
echo "=============================================="
echo ""
echo "To deploy on a new machine:"
echo "  1. Copy ${BUNDLE_NAME}.tar.gz to the target host"
echo "  2. tar xzf ${BUNDLE_NAME}.tar.gz"
echo "  3. cd ${PROJECT_NAME}"
echo "  4. cp .env.example .env   # Edit as needed"
echo "  5. docker compose up --build -d"
echo ""
echo "See QUICK_START.txt for the condensed version."
