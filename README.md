# PhiGent

Visual admin console for Milvus with full graphical management of databases, collections, partitions, indexes, and user permissions — plus vector search, data browsing, and an interactive API Playground.

> Derived from [Attu](https://github.com/zilliztech/attu) (© Zilliz, Apache 2.0), continuously customized and maintained by the Seeway team. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

## Features

- **Connection management** — connect to multiple Milvus instances, TLS/token/username-password auth
- **Database management** — create, delete, switch databases
- **Collection management** — create/delete/rename/copy collections, visual schema editing, alias management
- **Data operations** — insert/delete/query data, CSV/JSON import & export, batch operations
- **Vector search** — single-vector / hybrid search, parameter tuning, result visualization
- **Index management** — create/delete indexes, MMap toggle, index parameter config
- **Partition management** — partition CRUD, per-partition load/release
- **Users & permissions** — RBAC user/role/permission-group management
- **Playground** — built-in CodeMirror HTTP console, Milvus RESTful API interaction
- **System monitoring** — Milvus system metrics dashboard
- **Index tree** — visualization of code-repo index status (PhiGent customization)
- **GitLab repo management** — scheduled remote-repo indexing config (PhiGent customization)

## Quick start

### Docker (recommended)

```bash
git clone <repo-url> && cd PhiGent
docker compose up -d
```

After startup, open `http://localhost:8000` and enter `localhost:19530` as the Milvus address.

### Local development

**Prerequisites**: Node.js ≥ 20, yarn

```bash
# backend
cd server
yarn install
yarn start          # nodemon → http://localhost:3000

# frontend
cd client
yarn install
yarn start          # Vite → http://localhost:5173
```

### Production build

```bash
# build
cd client && yarn install && yarn build    # → client/build/
cd server && yarn install && yarn build    # → server/dist/

# start
cd server && yarn start:prod
```

Or build a production image with the Dockerfile:

```bash
docker build -t phigent .
docker run -p 3000:3000 phigent
```

## Architecture

```
┌─────────────┐     HTTP/WS      ┌──────────────┐     gRPC      ┌───────────┐
│   Browser   │ ◄──────────────► │   Express    │ ◄───────────► │  Milvus   │
│  React SPA  │                  │   (Node.js)  │               │  Server   │
└─────────────┘                  └──────┬───────┘               └───────────┘
                                        │
                                  ┌─────┴──────┐
                                  │  LRU Cache │
                                  │ (client →  │
                                  │  Milvus)   │
                                  └────────────┘
```

- **Stateless design** — the backend persists no connections; the client id is passed via the HTTP header (`milvus-client-id`)
- **WebSocket push** — collection load / index status synced to the frontend in real time
- **LRU connection pool** — 24h TTL, auto-reuses verified Milvus connections

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 · TypeScript · Vite · MUI 5 · CodeMirror 6 · Socket.IO Client |
| Backend | Express · TypeScript · Socket.IO · node-cron · LRU Cache |
| SDK | @zilliz/milvus2-sdk-node |
| Deployment | Docker · Docker Compose · Electron (optional desktop) |

## Environment variables

### Server (server)

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | `3000` | Server port |
| `ATTU_LOG_LEVEL` | `info` | Milvus SDK log level |
| `ROOT_CERT_PATH` | — | TLS root cert path |
| `PRIVATE_KEY_PATH` | — | TLS private key path |
| `CERT_CHAIN_PATH` | — | TLS cert chain path |
| `SERVER_NAME` | — | TLS SNI name |

### Client (client, injected into `window._env_` at runtime)

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST_URL` | — | Backend API address (same-origin by default) |
| `MILVUS_URL` | `127.0.0.1:19530` | Pre-filled Milvus address on the connect page |

## Project structure

```
PhiGent/
├── client/                  # React frontend
│   ├── src/
│   │   ├── pages/           # page components (databases / play / system / gitlab / …)
│   │   ├── components/      # shared components
│   │   ├── context/         # React Context state management
│   │   ├── http/            # API layer (axios)
│   │   └── i18n/            # i18n (Chinese / English)
│   └── public/              # static assets + runtime env injection script
├── server/                  # Express backend
│   └── src/
│       ├── app.ts           # entry: Express instance + route mounting
│       ├── socket.ts        # WebSocket service
│       ├── milvus/          # connection management
│       ├── collections/     # collection CRUD + search/query
│       ├── database/        # database management
│       ├── partitions/      # partition management
│       ├── users/           # users/roles/permissions
│       ├── crons/           # scheduled polling (WebSocket status push)
│       └── utils/           # shared utilities
├── docker-compose.yml       # full local environment (Milvus + etcd + MinIO + PhiGent)
└── Dockerfile               # multi-stage production image build
```

## Relationship with upstream Attu

PhiGent is based on Attu v2.5.x, keeping all Milvus management features and adding:

- **Index tree page** — visualize the runtime status of claude-context code indexing
- **GitLab repo management** — configure scheduled remote-repo indexing from the frontend
- **Branding** — name, homepage, and menu layout tailored for internal use

Details of the customizations are in the git history.

## License

[Apache License 2.0](./LICENSE) — original copyright by Zilliz; modifications copyrighted by the PhiGent (Seeway) team. Full attribution in [NOTICE](./NOTICE).
