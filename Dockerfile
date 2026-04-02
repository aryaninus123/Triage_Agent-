# syntax=docker/dockerfile:1

# ── Stage 1: Build Express backend ──────────────────────────────────────────
FROM node:20-slim AS backend-builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Build React frontend ───────────────────────────────────────────
FROM node:20-slim AS client-builder

WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 3: Runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

RUN apt-get purge -y python3 make g++ && apt-get autoremove -y

COPY --from=backend-builder /app/dist ./dist
COPY --from=client-builder /app/client/dist ./client/dist
COPY config/ ./config/

RUN mkdir -p data && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=./data/triage.db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

CMD ["node", "dist/server/server.js"]
