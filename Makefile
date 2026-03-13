.PHONY: dev dev-down build start stop test test-unit test-integration lint typecheck migrate migrate-create migrate-reset seed clean docker-build docker-up docker-down docker-logs docker-reset help

# ── Default ─────────────────────────────────────────────────
.DEFAULT_GOAL := help

# ── Environment ─────────────────────────────────────────────
ENV_FILE := .env
ifneq (,$(wildcard $(ENV_FILE)))
	include $(ENV_FILE)
	export
endif

# ── Development ─────────────────────────────────────────────

dev: ## Start all services in development mode with hot reload
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

dev-down: ## Stop development environment
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

dev-logs: ## Tail logs from all dev services
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

dev-ps: ## Show status of dev services
	docker compose -f docker-compose.yml -f docker-compose.dev.yml ps

# ── Production ──────────────────────────────────────────────

build: ## Build all Docker images for production
	docker compose build

start: ## Start all services in production mode (detached)
	docker compose up -d

stop: ## Stop all services
	docker compose down

restart: ## Restart all services
	docker compose down && docker compose up -d

logs: ## Tail logs from all services
	docker compose logs -f

ps: ## Show status of all services
	docker compose ps

# ── Testing ─────────────────────────────────────────────────

test: ## Run all tests
	npm run test

test-unit: ## Run unit tests only
	npm run test:unit

test-integration: ## Run integration tests (requires running services)
	npm run test:integration

# ── Code Quality ────────────────────────────────────────────

lint: ## Run ESLint across all workspaces
	npm run lint

lint-fix: ## Run ESLint with auto-fix
	npm run lint:fix

typecheck: ## Run TypeScript type checking
	npm run typecheck

# ── Database ────────────────────────────────────────────────

migrate: ## Run database migrations
	npm run migrate

migrate-create: ## Create a new migration (usage: make migrate-create NAME=add_users_table)
	npm run migrate:create -- --name $(NAME)

migrate-reset: ## Reset database and re-run all migrations (DESTRUCTIVE)
	@echo "WARNING: This will destroy all data. Press Ctrl+C to cancel."
	@sleep 3
	npm run migrate:reset

seed: ## Seed the database with sample data
	npm run seed

# ── Database Admin ──────────────────────────────────────────

db-shell: ## Open a PostgreSQL shell
	docker compose exec postgres psql -U $${POSTGRES_USER:-rip} -d $${POSTGRES_DB:-radiology_platform}

db-dump: ## Dump the database to a SQL file (output: backups/dump_<timestamp>.sql)
	@mkdir -p backups
	docker compose exec postgres pg_dump -U $${POSTGRES_USER:-rip} $${POSTGRES_DB:-radiology_platform} > backups/dump_$$(date +%Y%m%d_%H%M%S).sql
	@echo "Database dumped to backups/"

db-restore: ## Restore database from a dump file (usage: make db-restore FILE=backups/dump.sql)
	docker compose exec -T postgres psql -U $${POSTGRES_USER:-rip} $${POSTGRES_DB:-radiology_platform} < $(FILE)

# ── Infrastructure ──────────────────────────────────────────

redis-cli: ## Open a Redis CLI session
	docker compose exec redis redis-cli -a $${REDIS_PASSWORD:-redis_secret}

minio-console: ## Print MinIO console URL
	@echo "MinIO Console: http://localhost:$${MINIO_CONSOLE_PORT:-9001}"
	@echo "Access Key: $${MINIO_ACCESS_KEY:-minioadmin}"
	@echo "Secret Key: $${MINIO_SECRET_KEY:-minio_secret}"

# ── Cleanup ─────────────────────────────────────────────────

clean: ## Remove all build artifacts and node_modules
	npm run clean
	rm -rf node_modules

docker-reset: ## Stop services, remove volumes, and restart (DESTRUCTIVE)
	@echo "WARNING: This will destroy all data in Docker volumes. Press Ctrl+C to cancel."
	@sleep 3
	docker compose down -v
	docker compose up -d

docker-prune: ## Remove unused Docker images and build cache
	docker compose down
	docker image prune -f --filter "label=com.docker.compose.project=radiology-platform"
	docker builder prune -f

# ── Setup ───────────────────────────────────────────────────

setup: ## Initial project setup
	@echo "Setting up Radiology Interoperability Platform..."
	@test -f .env || cp .env.example .env && echo "Created .env from .env.example"
	npm install
	@echo ""
	@echo "Setup complete. Run 'make dev' to start development environment."

# ── Help ────────────────────────────────────────────────────

help: ## Show this help message
	@echo "Radiology Interoperability Platform"
	@echo "===================================="
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
