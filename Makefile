.PHONY: install compile test deploy-local deploy-testnet dev lint clean docker-build docker-run frontend help

install: ## Install dependencies
	npm install

compile: ## Compile Solidity contracts
	npx hardhat compile

test: ## Run test suite
	npx hardhat test

deploy-local: ## Deploy contracts to local hardhat node
	npx hardhat run scripts/deploy.js --network localhost

deploy-testnet: ## Deploy contracts to Base Sepolia testnet
	npx hardhat run scripts/deploy.js --network base_sepolia

dev: ## Start local hardhat node
	npx hardhat node

lint: ## Lint Solidity files (requires solhint)
	@command -v npx >/dev/null 2>&1 && npx solhint 'contracts/**/*.sol' 2>/dev/null || echo "solhint not installed — run: npm i -D solhint"

clean: ## Clean build artifacts and cache
	npx hardhat clean
	rm -rf artifacts/ cache/ typechain-types/ coverage/ coverage.json

docker-build: ## Build Docker image
	docker build -t afripay-protocol .

docker-run: ## Run Docker container on port 8080
	docker run --rm -p 8080:8080 --env-file .env afripay-protocol

frontend: ## Serve frontend on port 8080
	@echo "Serving frontend at http://localhost:8080"
	cd frontend && python3 -m http.server 8080

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
