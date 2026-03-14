# =============================================================================
# Unified container: all Node.js services + supervisor
# NLP service excluded to keep build fast and small
# =============================================================================
FROM node:20-alpine

# Install supervisor
RUN apk add --no-cache supervisor

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

# Build shared package
RUN npm run build -w packages/shared

# Copy all service source code and static assets
COPY services/api-gateway/public services/api-gateway/public
COPY services/api-gateway/src services/api-gateway/src
COPY services/order-service/src services/order-service/src
COPY services/document-service/src services/document-service/src
COPY services/integration-service/src services/integration-service/src

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN mkdir -p /var/log/supervisor

ENV NODE_ENV=production

EXPOSE 3000

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
