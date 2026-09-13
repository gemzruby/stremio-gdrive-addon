# Prefer a recent Homebrew Node on macOS when the shell still points to an old nvm version.
NODE_OK := $(shell node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' >/dev/null 2>&1 && echo yes)
ifeq ($(NODE_OK),)
ifneq ($(wildcard /opt/homebrew/bin/node),)
RUN := PATH=/opt/homebrew/bin:$$PATH
endif
endif

.PHONY: help install check test dev preview-media generate-media login deploy manifest-url

help:
	@printf '%s\n' \
	  'make install          Install npm dependencies' \
	  'make preview-media   Count Drive videos without changing media.json' \
	  'make generate-media  Rebuild media.json from DRIVE_FOLDER_ID in .dev.vars' \
	  'make check           Run typecheck, lint, and tests' \
	  'make test            Run tests only' \
	  'make dev             Start the local Worker' \
	  'make login           Authorize Wrangler with Cloudflare' \
	  'make deploy          Check and deploy code plus secrets to Cloudflare' \
	  'make manifest-url    Print the private production manifest URL' \
	  'Optional: FOLDER_ID=<id> RECURSIVE=1 for media commands'

install:
	$(RUN) npm install

check:
	$(RUN) npm run typecheck
	$(RUN) npm run lint
	$(RUN) npm run test

test:
	$(RUN) npm run test

dev:
	$(RUN) npm run dev

preview-media:
	$(RUN) npm run sync:media -- $(FOLDER_ID) $(if $(filter 1 true yes,$(RECURSIVE)),--recursive,) --dry-run

generate-media:
	$(RUN) npm run sync:media -- $(FOLDER_ID) $(if $(filter 1 true yes,$(RECURSIVE)),--recursive,)

login:
	$(RUN) npx wrangler login

deploy: check
	@$(RUN) node --env-file=.dev.vars scripts/deploy.mjs

manifest-url:
	@$(RUN) node --env-file=.dev.vars scripts/manifest-url.mjs
