FROM node:20-alpine AS builder

WORKDIR /app

# Copy root config files
COPY package.json package-lock.json* tsconfig.base.json ./

# Copy shared package
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src

# Copy service package
COPY services/order-service/package.json services/order-service/
COPY services/order-service/tsconfig.json services/order-service/

# Install all workspace dependencies
RUN npm ci --workspace=packages/shared --workspace=services/order-service --include-workspace-root

# Build shared package first, then the service
RUN npm run build -w packages/shared
COPY services/order-service/src services/order-service/src
RUN npm run build -w services/order-service

FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY services/order-service/package.json services/order-service/

RUN npm ci --workspace=packages/shared --workspace=services/order-service --include-workspace-root --omit=dev && \
    npm cache clean --force

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/services/order-service/dist services/order-service/dist

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "services/order-service/dist/index.js"]
