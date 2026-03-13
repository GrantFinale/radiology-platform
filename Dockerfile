# =============================================================================
# Single-stage unified build: all services in one container
# Uses node:20-bookworm-slim as base (has Node.js already)
# =============================================================================
FROM node:20-bookworm-slim

# Install Python 3, supervisor, and tesseract
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      python3-venv \
      supervisor \
      tesseract-ocr \
      curl \
      ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Node.js setup ---

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

# Build shared package
RUN npm run build -w packages/shared

# Copy all service source code
COPY services/api-gateway/src services/api-gateway/src
COPY services/order-service/src services/order-service/src
COPY services/document-service/src services/document-service/src
COPY services/integration-service/src services/integration-service/src

# --- Python NLP service setup ---

COPY services/nlp-service/requirements.txt services/nlp-service/

# Install Python deps (use --break-system-packages for bookworm)
RUN pip3 install --no-cache-dir --break-system-packages -r services/nlp-service/requirements.txt && \
    python3 -m spacy download en_core_web_sm

# Copy NLP service source code
COPY services/nlp-service/src services/nlp-service/src

# --- Supervisor config ---

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN mkdir -p /var/log/supervisor

ENV NODE_ENV=production

EXPOSE 3000

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
