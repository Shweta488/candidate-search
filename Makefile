# Local setup and dev server. See docs/LLD.md section 7.
.PHONY: setup dev reset stop check

NODE_MAJOR := $(shell node -p "process.versions.node.split('.')[0]" 2>/dev/null)

# setup always builds a fresh local database from the migrations, so an old local
# database from an earlier version of the schema can't get in the way.
setup: check
	npm ci
	npx supabase stop --no-backup
	npx supabase start
	node scripts/seed.ts
	node scripts/write-env.ts

dev:
	@if [ -z "$$ANTHROPIC_API_KEY" ]; then echo "ANTHROPIC_API_KEY is not set. Export it in this shell, then run make dev again."; exit 1; fi
	@if [ -z "$$STRIPE_WEBHOOK_SECRET" ]; then echo "STRIPE_WEBHOOK_SECRET is not set. Export it in this shell (the sample events use whsec_test_sample), then run make dev again."; exit 1; fi
	@if [ ! -f .env.local ]; then echo ".env.local is missing. Run make setup first."; exit 1; fi
	npx next dev --port 3000

reset: check
	npx supabase db reset
	node scripts/seed.ts

stop:
	npx supabase stop

check:
	@if [ "$(NODE_MAJOR)" != "24" ]; then echo "Node 24 is required (found: $(or $(NODE_MAJOR),none)). With nvm: nvm install 24 && nvm use 24"; exit 1; fi
	@if ! docker info >/dev/null 2>&1; then echo "Docker is not running. Start Docker Desktop, wait until it says it is running, then run this again."; exit 1; fi
