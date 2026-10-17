.PHONY: help build build-backend build-vue build-react test test-docs test-backend test-vue test-react validate-utf8 deploy-env apple-container-init

help:
	@printf '%s\n' \
		'build            Build backend and both admin apps' \
		'build-backend    Package the Spring Boot backend' \
		'build-vue        Production build for the Vue admin' \
		'build-react      Production build for the React admin' \
		'test             Run docs, backend, and admin checks' \
		'test-docs        UTF-8, README, release-version, and doc-link gates' \
		'test-backend     Backend unit tests' \
		'test-vue         Vue lint, unit tests, and production build' \
		'test-react       React lint, unit tests, and production build' \
		'validate-utf8    UTF-8 without BOM check' \
		'deploy-env       Copy deploy/.env.example to deploy/docker/.env if missing' \
		'apple-container-init  Create deploy/.env for the Apple container stack'

build: build-backend build-vue build-react

build-backend:
	node tools/backend_mvn.mjs -- -B -ntp clean package -P dev -DskipTests

build-vue:
	cd frontend-vue && corepack pnpm run build:prod

build-react:
	cd frontend-react && corepack pnpm run build:prod

test: test-docs test-backend test-vue test-react

test-docs: validate-utf8
	node tools/check_readme_sync.mjs
	node tools/check_release_version.mjs
	node tools/check_doc_links.mjs

test-backend:
	node tools/backend_mvn.mjs -- -B -ntp -DskipTests=false test

test-vue:
	cd frontend-vue && corepack pnpm run lint:eslint
	cd frontend-vue && corepack pnpm run test:unit
	cd frontend-vue && corepack pnpm run build:prod

test-react:
	cd frontend-react && corepack pnpm run lint
	cd frontend-react && corepack pnpm run test
	cd frontend-react && corepack pnpm run build:prod

validate-utf8:
	node tools/validate_utf8.mjs

deploy-env:
	@if [ -f deploy/docker/.env ]; then printf 'kept existing deploy/docker/.env\n'; else cp deploy/.env.example deploy/docker/.env && chmod 600 deploy/docker/.env && printf 'created deploy/docker/.env from deploy/.env.example\n'; fi

apple-container-init:
	bash deploy/apple-container.sh init
