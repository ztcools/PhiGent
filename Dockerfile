# => Building container
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY . .

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# => Building Client
WORKDIR /app/client
RUN yarn install --registry https://registry.npmmirror.com --network-timeout 1000000
RUN yarn build

# => Building Server
WORKDIR /app/server
RUN yarn install --registry https://registry.npmmirror.com --network-timeout 1000000
ENV NODE_ENV=production
ENV PORT=80
RUN yarn build

# => Final runtime container
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
# Reuse the dependencies already resolved in the builder (avoids a runtime
# network re-install, which flakes on git-hosted transitive deps).
COPY --from=builder /app/server/dist /app/dist
COPY --from=builder /app/client/build /app/build
COPY --from=builder /app/server/package.json /app/package.json
COPY --from=builder /app/server/node_modules /app/node_modules

RUN chmod +x /app/build/env.sh && \
    chgrp -R 0 /app && \
    chmod -R g=u /app

EXPOSE 3000

CMD [ "/bin/bash", "-c", "/app/build/env.sh && yarn start:prod" ]
