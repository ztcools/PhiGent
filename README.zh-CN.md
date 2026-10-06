# PhiGent

PhiGent 是 Seeway 团队维护的 Milvus 内部管理控制台，基于 Attu（Apache-2.0）二次开发。除 Milvus 常规管理能力外，PhiGent 重点补充了代码索引状态查看和 git-index-service 仓库管理能力。

## 功能

- 连接 Milvus 2.5+ 集群
- 管理 Database、Collection、Partition、Alias、Index、User、Role、Privilege Group
- 浏览 Collection 数据并执行向量 / 混合搜索
- 通过索引树页面查看代码索引状态
- 通过代码仓库页面管理 git-index-service 仓库配置
- 通过 WebSocket 实时刷新 Collection 加载 / 索引状态
- 通过 Docker Compose 启动 Milvus + etcd + MinIO + PhiGent 完整栈

本分支已移除：

- Playground HTTP 代理控制台
- Segments UI 标签页
- Electron 桌面端打包

## 环境要求

- Node.js 20+
- Yarn Classic 1.22.x（推荐使用 Corepack）
- Docker / Docker Compose（用于本地 Milvus 栈）
- 推荐 Milvus 2.5.x

## 安装

```bash
corepack enable
yarn install
```

## 本地开发

```bash
yarn dev
```

启动后：

- 前端：<http://localhost:3001>
- 后端：<http://localhost:3000>

## 构建

```bash
yarn build
```

前端产物输出到 `client/dist/`，后端产物输出到 `server/dist/`。

## 测试和检查

```bash
yarn lint
yarn test
yarn format:check
```

## Docker

```bash
docker compose up -d --build
```

访问 <http://localhost:8000>。

Compose 会启动：

- etcd
- MinIO
- Milvus standalone
- PhiGent（从当前仓库构建）

## 环境变量

详见 `.env.example` 和 `client/.env.example`。

常用变量：

| 变量 | 说明 |
| --- | --- |
| `SERVER_PORT` | Express 服务端口，默认 `3000` |
| `MILVUS_URL` | 连接页默认 Milvus 地址 |
| `DATABASE` | 默认 Milvus Database |
| `MILVUS_SERVERS` | 可选，固定连接列表，逗号分隔 |
| `HOST_URL` | 生产环境 API Host，注入到 `window._env_` |
| `PHIGENT_LOG_LEVEL` | Milvus SDK 日志级别；兼容旧 `ATTU_LOG_LEVEL` |
| `GIT_INDEX_HOST` | 可选，git-index-service 地址 |
| `GIT_INDEX_PORT` | git-index-service 端口，默认 `8795` |

## 文档

- [架构说明](docs/architecture.md)
- [开发规范](docs/development.md)
- [API 说明](docs/api.md)
- [部署说明](docs/deployment.md)
- [优化清单](docs/todo-optimization.md)
