# Development Guide

## Workspace

PhiGent uses a Yarn Classic workspace:

```bash
yarn install
yarn dev
yarn build
yarn lint
yarn test
```

Workspace packages:

- `phigent-client` in `client/`
- `phigent` in `server/`

## Code style

- TypeScript first; avoid new `any` unless a third-party SDK type is missing.
- Comments should be Chinese and explain **why**, not restate obvious code.
- React components use PascalCase; variables and functions use camelCase.
- Keep import order: external packages, aliases, relative imports, types.
- Prefer `useCallback` / `useMemo` for callbacks passed into context or large child trees.
- Put side effects in `useEffect`; never issue requests directly in render.
- Local storage access must be wrapped in `try/catch`.

## Frontend conventions

- Pages live under `client/src/pages/`.
- Reusable UI lives under `client/src/components/`.
- Context and global state live under `client/src/context/`.
- HTTP calls live under `client/src/http/`.
- Runtime environment values are read from `window._env_` and defined in `client/public/env-config.js` / `client/public/env.sh`.

Removed modules should not be reintroduced without architecture review:

- Playground HTTP proxy
- Segments UI tab
- Electron desktop packaging

## Backend conventions

- Each domain keeps `*.controller.ts`, `*.service.ts`, and DTO files together.
- Controllers handle routing, DTO validation, and response forwarding.
- Services own Milvus SDK calls and business logic.
- Errors should flow through `next(error)` and the shared error middleware.
- Do not log credentials, tokens, or gRPC metadata.

## Verification

Before submitting changes:

```bash
yarn lint
yarn test
yarn build
```

For Docker changes:

```bash
docker compose config
docker build -t phigent:local .
```
