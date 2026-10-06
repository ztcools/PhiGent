# API Guide

All application APIs are mounted under `/api/v1`.

## Health

```http
GET /api/v1/healthy
```

Returns server health status.

## Milvus connection

```http
POST /api/v1/milvus/connect
POST /api/v1/milvus/disconnect
POST /api/v1/milvus/usedb
GET  /api/v1/milvus/version
GET  /api/v1/milvus/metrics
PUT  /api/v1/milvus/flush
```

Required headers after connection:

| Header | Description |
| --- | --- |
| `milvus-client-id` | Client cache key returned by connect |
| `x-phigent-database` | Preferred database header |
| `x-attu-database` | Backward-compatible database header |

## Databases

```http
GET    /api/v1/databases
POST   /api/v1/databases
GET    /api/v1/databases/:name
PUT    /api/v1/databases/:name
DELETE /api/v1/databases/:name
```

## Collections

```http
GET    /api/v1/collections
POST   /api/v1/collections
GET    /api/v1/collections/:name
DELETE /api/v1/collections/:name
POST   /api/v1/collections/:name
POST   /api/v1/collections/:name/duplicate
GET    /api/v1/collections/:name/count
GET    /api/v1/collections/:name/statistics
PUT    /api/v1/collections/:name/load
PUT    /api/v1/collections/:name/release
PUT    /api/v1/collections/:name/properties
POST   /api/v1/collections/:name/insert
POST   /api/v1/collections/:name/upsert
POST   /api/v1/collections/:name/search
POST   /api/v1/collections/:name/query
```

Large body limits are only applied to insert/upsert/import-sample endpoints.

## Partitions

```http
GET    /api/v1/partitions
POST   /api/v1/partitions
DELETE /api/v1/partitions/:name
```

## Users, roles, and privileges

```http
GET    /api/v1/users
POST   /api/v1/users
PUT    /api/v1/users/:username
DELETE /api/v1/users/:username
GET    /api/v1/users/roles
POST   /api/v1/users/roles
PUT    /api/v1/users/roles/:roleName/privileges
DELETE /api/v1/users/roles/:roleName
GET    /api/v1/users/privilege-groups
POST   /api/v1/users/privilege-groups
PUT    /api/v1/users/privilege-groups/:group_name
DELETE /api/v1/users/privilege-groups/:group_name
```

## Cron / WebSocket

```http
PUT /api/v1/crons
```

Collection updates are pushed through Socket.IO event `COLLECTION_UPDATE`.

## Removed endpoint

`/api/v1/playground` has been removed. It previously acted as an arbitrary HTTP proxy and is not part of PhiGent anymore.
