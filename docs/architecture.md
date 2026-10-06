# Architecture

## Overview

PhiGent is a full-stack web application:

- Frontend: React + TypeScript + Vite + MUI
- Backend: Express + TypeScript + `@zilliz/milvus2-sdk-node`
- Realtime: Socket.IO
- Deployment: Docker / Docker Compose

The application is intentionally stateless with respect to Milvus metadata. Runtime connection state is kept in an in-memory LRU cache and must be recreated after process restart.

## Request flow

1. The client calls `POST /api/v1/milvus/connect` with Milvus connection data.
2. The server creates a Milvus SDK client, validates health and database permissions, then stores it in `clientCache`.
3. Later requests include `milvus-client-id` and database headers.
4. Controllers call services; services call the Milvus SDK.
5. Responses are normalized by middleware.

## Client cache

`server/src/app.ts` owns `clientCache`.

The cache is bounded and disposes Milvus clients on eviction. Disposal also clears cron jobs for that client.

## WebSocket and cron refresh

Collection loading/indexing status is polled by cron jobs in `server/src/crons/`. Updates are pushed through Socket.IO using `WS_EVENTS.COLLECTION_UPDATE`.

When a socket disconnects, cron jobs for that client are stopped. This avoids background polling after the browser session disappears.

## Frontend state

Frontend state is organized around contexts:

- Auth/session state
- Database/collection state
- Root UI feedback state (snackbar/dialog/drawer)
- Navigation state
- Theme state

Longer-term direction is to consolidate Auth/Data/System into `SessionProvider` while preserving existing context consumers during migration.

## Runtime environment injection

Production client configuration is generated at container startup:

1. Docker passes environment variables.
2. `client/public/env.sh` writes `dist/env-config.js`.
3. `index.html` loads `env-config.js`.
4. Client code reads `window._env_`.

## Removed modules

The following Attu-derived modules were removed from PhiGent:

- Playground HTTP proxy console: removed to eliminate SSRF risk and reduce CodeMirror/OpenAPI surface.
- Segments UI tab: removed because the page was not needed for the current product scope.
- Electron packaging: removed because PhiGent is deployed as a web service / Docker app.

## Docker layout

The Docker image builds both workspace packages, copies client assets into `/app/dist-client`, server output into `/app/dist`, and runs `node dist/src/app.js`.

The Compose stack builds PhiGent from this repository instead of pulling upstream Attu.
