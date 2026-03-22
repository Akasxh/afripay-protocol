# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install

COPY contracts/ contracts/
COPY scripts/ scripts/
COPY hardhat.config.js ./

RUN npx hardhat compile

# Stage 2: Runtime
FROM node:20-alpine

RUN addgroup -S afripay && adduser -S afripay -G afripay

WORKDIR /app

COPY --from=builder /app/artifacts/ artifacts/
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/package.json package.json
COPY --from=builder /app/scripts/ scripts/
COPY --from=builder /app/hardhat.config.js hardhat.config.js
COPY --from=builder /app/contracts/ contracts/
COPY frontend/ frontend/

RUN npm install -g serve@14

RUN chown -R afripay:afripay /app

USER afripay

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://localhost:8080/ || exit 1

CMD ["serve", "frontend", "-l", "8080"]
