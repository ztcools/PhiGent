# Deployment Guide

## Docker Compose

```bash
docker compose up -d --build
```

PhiGent is exposed on <http://localhost:8000> by default.

The stack includes:

- etcd
- MinIO
- Milvus standalone
- PhiGent

## Docker image

```bash
docker build \
  --build-arg NPM_REGISTRY=https://registry.yarnpkg.com \
  -t phigent:local .
```

The image layout:

- `/app/dist` — compiled server
- `/app/dist-client` — compiled Vite client
- `/app/node_modules` — production runtime dependencies

The container starts with:

```bash
/app/dist-client/env.sh && node dist/src/app.js
```

## Runtime configuration

Runtime client config is generated into `dist-client/env-config.js` by `env.sh`.

Important environment variables:

| Variable | Description |
| --- | --- |
| `SERVER_PORT` | Express server port |
| `MILVUS_URL` | Default Milvus address |
| `DATABASE` | Default Milvus database |
| `MILVUS_SERVERS` | Optional fixed connection list |
| `HOST_URL` | Client API host |
| `GIT_INDEX_HOST` | git-index-service host |
| `GIT_INDEX_PORT` | git-index-service port |
| `PHIGENT_LOG_LEVEL` | Preferred SDK log level |
| `ATTU_LOG_LEVEL` | Backward-compatible SDK log level |
| `ROOT_CERT_PATH` | Optional Milvus TLS root certificate |
| `PRIVATE_KEY_PATH` | Optional Milvus TLS private key |
| `CERT_CHAIN_PATH` | Optional Milvus TLS certificate chain |
| `SERVER_NAME` | Optional Milvus TLS SNI server name |

## Health check

The Docker image defines a health check against:

```http
GET http://127.0.0.1:3000/api/v1/healthy
```

## Milvus version

Milvus 2.5.x is recommended because the server SDK is `@zilliz/milvus2-sdk-node` 2.5.x.

## Security notes

- The Playground proxy endpoint has been removed.
- `/milvus/connect` is rate-limited.
- Default JSON body size is 5MB; large ingestion endpoints have route-specific limits.
- Errors are sanitized before being returned/logged to reduce credential leakage.
