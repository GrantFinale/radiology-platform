FROM node:20-alpine AS builder

WORKDIR /app

# Copy root config files
COPY package.json package-lock.json* tsconfig.base.json ./

# Copy shared package
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src

# Copy service package
COPY services/api-gateway/package.json services/api-gateway/
COPY services/api-gateway/tsconfig.json services/api-gateway/

# Install all workspace dependencies
RUN npm ci --workspace=packages/shared --workspace=services/api-gateway --include-workspace-root

# Build shared package first, then the service
RUN npm run build -w packages/shared
COPY services/api-gateway/src services/api-gateway/src
RUN npm run build -w services/api-gateway

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY services/api-gateway/package.json services/api-gateway/

RUN npm ci --workspace=packages/shared --workspace=services/api-gateway --include-workspace-root --omit=dev && \
    npm cache clean --force

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/services/api-gateway/dist services/api-gateway/dist

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "services/api-gateway/dist/index.js"]
