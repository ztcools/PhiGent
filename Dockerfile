# => Building container
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ARG NPM_REGISTRY=https://registry.yarnpkg.com

# git is needed by yarn install — some transitive deps resolve from git URLs.
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN corepack enable

COPY package.json yarn.lock ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN yarn install --registry ${NPM_REGISTRY} --network-timeout 1000000

COPY . .
RUN yarn workspace phigent-client build
RUN yarn workspace phigent build

# => Production dependencies
FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app
ARG NPM_REGISTRY=https://registry.yarnpkg.com
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json yarn.lock ./
COPY server/package.json ./server/package.json
RUN yarn install --production --registry ${NPM_REGISTRY} --network-timeout 1000000 --ignore-scripts

# => Final runtime container
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/server/dist /app/dist
COPY --from=builder /app/client/dist /app/dist-client
COPY --from=builder /app/server/package.json /app/package.json
COPY --from=prod-deps /app/node_modules /app/node_modules

RUN chmod +x /app/dist-client/env.sh && \
    chgrp -R 0 /app && \
    chmod -R g=u /app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/healthy').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["/bin/bash", "-c", "/app/dist-client/env.sh && node dist/src/app.js"]
