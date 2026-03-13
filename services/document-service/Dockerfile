FROM node:20-slim AS builder

WORKDIR /app

# Copy root config files
COPY package.json package-lock.json* tsconfig.base.json ./

# Copy shared package
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src

# Copy service package
COPY services/document-service/package.json services/document-service/
COPY services/document-service/tsconfig.json services/document-service/

# Install all workspace dependencies
RUN npm ci --workspace=packages/shared --workspace=services/document-service --include-workspace-root --ignore-scripts

# Build shared package first, then the service
RUN npm run build -w packages/shared
COPY services/document-service/src services/document-service/src
RUN npm run build -w services/document-service

FROM node:20-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-spa \
    tesseract-ocr-fra \
    tesseract-ocr-deu \
    libtesseract-dev \
    libleptonica-dev \
    libvips-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata
ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY services/document-service/package.json services/document-service/

RUN npm ci --workspace=packages/shared --workspace=services/document-service --include-workspace-root --omit=dev --ignore-scripts && \
    npm rebuild sharp

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/services/document-service/dist services/document-service/dist

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    mkdir -p /app/tmp && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3002/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "services/document-service/dist/index.js"]
