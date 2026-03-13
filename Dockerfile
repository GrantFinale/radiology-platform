# =============================================================================
# Stage 1: Build Node.js services
# =============================================================================
FROM node:20-alpine AS node-builder

WORKDIR /app

# Copy root config files
COPY package.json package-lock.json tsconfig.base.json ./

# Copy shared package
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src

# Copy all service package.json files
COPY services/api-gateway/package.json services/api-gateway/
COPY services/api-gateway/tsconfig.json services/api-gateway/
COPY services/order-service/package.json services/order-service/
COPY services/order-service/tsconfig.json services/order-service/
COPY services/document-service/package.json services/document-service/
COPY services/document-service/tsconfig.json services/document-service/
COPY services/integration-service/package.json services/integration-service/
COPY services/integration-service/tsconfig.json services/integration-service/

# Copy review-ui package.json (needed for workspace resolution)
COPY apps/review-ui/package.json apps/review-ui/

# Install all workspace dependencies
RUN npm ci --include-workspace-root

# Build shared package first
RUN npm run build -w packages/shared

# Copy all service source code
COPY services/api-gateway/src services/api-gateway/src
COPY services/order-service/src services/order-service/src
COPY services/document-service/src services/document-service/src
COPY services/integration-service/src services/integration-service/src

# =============================================================================
# Stage 2: Build Python NLP service dependencies
# =============================================================================
FROM python:3.11-slim AS python-builder

WORKDIR /app/services/nlp-service

COPY services/nlp-service/requirements.txt .

RUN pip install --no-cache-dir --prefix=/install -r requirements.txt && \
    python -c "import spacy; spacy.cli.download('en_core_web_sm')"

# =============================================================================
# Stage 3: Runtime - all services in one container
# =============================================================================
FROM debian:bookworm-slim

# Install Node.js 20
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
      gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      nodejs \
      python3 \
      python3-pip \
      supervisor \
      tesseract-ocr && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the entire Node.js workspace from builder (includes node_modules, shared dist, source)
COPY --from=node-builder /app /app

# Copy Python dependencies
COPY --from=python-builder /install /usr/local
COPY --from=python-builder /root/.local /root/.local

# Ensure spaCy model is available (it may be in either location)
RUN python3 -c "import spacy; spacy.load('en_core_web_sm')" 2>/dev/null || \
    python3 -m spacy download en_core_web_sm || true

# Copy NLP service source code
COPY services/nlp-service/src services/nlp-service/src
COPY services/nlp-service/requirements.txt services/nlp-service/

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create log directory
RUN mkdir -p /var/log/supervisor

ENV NODE_ENV=production

EXPOSE 3000

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
