# PhiGent

PhiGent is an internal Milvus management console maintained by the Seeway team. It is derived from Attu (Apache-2.0) and focuses on code-index / repository-index operations in addition to standard Milvus administration.

## Features

- Connect to Milvus 2.5+ clusters
- Manage databases, collections, partitions, aliases, indexes, users, roles, and privilege groups
- Browse collection data and run vector / hybrid search
- View code index state through the Index Tree page
- Manage git-index-service repositories through the Code Repos page
- WebSocket-driven collection load/index status refresh
- Docker Compose stack for Milvus + etcd + MinIO + PhiGent

Removed from this fork:

- Playground HTTP proxy console
- Segments UI tab
- Electron desktop packaging

## Requirements

- Node.js 20+
- Yarn Classic 1.22.x (Corepack recommended)
- Docker / Docker Compose for local Milvus stack
- Milvus 2.5.x recommended

## Install

```bash
corepack enable
yarn install
```

## Development

```bash
yarn dev
```

This starts:

- client: Vite dev server at <http://localhost:3001>
- server: Express API at <http://localhost:3000>

## Build

```bash
yarn build
```

Client assets are built to `client/dist/`; server output is built to `server/dist/`.

## Test and lint

```bash
yarn lint
yarn test
yarn format:check
```

## Docker

```bash
docker compose up -d --build
```

Open PhiGent at <http://localhost:8000>.

The compose stack includes:

- etcd
- MinIO
- Milvus standalone
- PhiGent (built from this repository)

## Environment variables

See `.env.example` and `client/.env.example`.

Common variables:

| Variable | Description |
| --- | --- |
| `SERVER_PORT` | Express server port, default `3000` |
| `MILVUS_URL` | Default Milvus address shown on connect page |
| `DATABASE` | Default Milvus database |
| `MILVUS_SERVERS` | Optional comma-separated fixed connection list |
| `HOST_URL` | Production API host injected into `window._env_` |
| `PHIGENT_LOG_LEVEL` | Milvus SDK log level; `ATTU_LOG_LEVEL` remains as fallback |
| `GIT_INDEX_HOST` | Optional git-index-service host |
| `GIT_INDEX_PORT` | git-index-service port, default `8795` |

## Documentation

- [Architecture](docs/architecture.md)
- [Development guide](docs/development.md)
- [API guide](docs/api.md)
- [Deployment guide](docs/deployment.md)
- [Optimization checklist](docs/todo-optimization.md)
