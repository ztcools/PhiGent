# PhiGent

Milvus 可视化管理控制台，提供数据库、集合、分区、索引、用户权限的全功能图形化管理，支持向量搜索、数据浏览和交互式 API Playground。

> 本项目衍生自 [Attu](https://github.com/zilliztech/attu)（© Zilliz，Apache 2.0），由 Seeway 团队持续定制和维护。详见 [LICENSE](./LICENSE) 与 [NOTICE](./NOTICE)。

## 功能

- **连接管理** — 多 Milvus 实例连接，支持 TLS/Token/用户名密码认证
- **数据库管理** — 创建、删除、切换 Database
- **集合管理** — 创建/删除/重命名/复制集合，Schema 可视化编辑，别名管理
- **数据操作** — 插入/删除/查询数据，CSV/JSON 导入导出，批量操作
- **向量搜索** — 单向量/混合搜索，参数调优，结果可视化
- **索引管理** — 创建/删除索引，MMap 开关，索引参数配置
- **分区管理** — 分区 CRUD，分区级加载/释放
- **用户与权限** — RBAC 用户/角色/权限组管理
- **Playground** — 内置 CodeMirror HTTP 控制台，Milvus RESTful API 交互
- **系统监控** — Milvus 系统指标面板
- **索引树** — 代码仓库索引状态可视化（PhiGent 定制）
- **GitLab 仓库管理** — 远程仓库定时索引配置（PhiGent 定制）

## 快速开始

### Docker（推荐）

```bash
git clone <repo-url> && cd PhiGent
docker compose up -d
```

启动后访问 `http://localhost:8000`，Milvus 地址填 `localhost:19530`。

### 本地开发

**前置要求**：Node.js ≥ 20，yarn

```bash
# 后端
cd server
yarn install
yarn start          # nodemon → http://localhost:3000

# 前端
cd client
yarn install
yarn start          # Vite → http://localhost:5173
```

### 生产构建

```bash
# 构建
cd client && yarn install && yarn build    # → client/build/
cd server && yarn install && yarn build    # → server/dist/

# 启动
cd server && yarn start:prod
```

或使用 Dockerfile 构建生产镜像：

```bash
docker build -t phigent .
docker run -p 3000:3000 phigent
```

## 架构

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

- **无状态设计** — 后端不持久化连接，客户端标识通过 HTTP Header（`milvus-client-id`）传递
- **WebSocket 推送** — 集合加载/索引状态实时同步前端
- **LRU 连接池** — 24h TTL，自动复用已验证的 Milvus 连接

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 · TypeScript · Vite · MUI 5 · CodeMirror 6 · Socket.IO Client |
| 后端 | Express · TypeScript · Socket.IO · node-cron · LRU Cache |
| SDK | @zilliz/milvus2-sdk-node |
| 部署 | Docker · Docker Compose · Electron（可选桌面端） |

## 环境变量

### 服务端（server）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SERVER_PORT` | `3000` | 服务端口 |
| `ATTU_LOG_LEVEL` | `info` | Milvus SDK 日志级别 |
| `ROOT_CERT_PATH` | — | TLS 根证书路径 |
| `PRIVATE_KEY_PATH` | — | TLS 私钥路径 |
| `CERT_CHAIN_PATH` | — | TLS 证书链路径 |
| `SERVER_NAME` | — | TLS SNI 名称 |

### 客户端（client，运行时注入 `window._env_`）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HOST_URL` | — | 后端 API 地址（默认同源） |
| `MILVUS_URL` | `127.0.0.1:19530` | 连接页预填的 Milvus 地址 |

## 项目结构

```
PhiGent/
├── client/                  # React 前端
│   ├── src/
│   │   ├── pages/           # 页面组件（databases / play / system / gitlab / …）
│   │   ├── components/      # 通用组件
│   │   ├── context/         # React Context 状态管理
│   │   ├── http/            # API 调用层（axios）
│   │   └── i18n/            # 国际化（中文 / 英文）
│   └── public/              # 静态资源 + 运行时 env 注入脚本
├── server/                  # Express 后端
│   └── src/
│       ├── app.ts           # 入口：Express 实例 + 路由挂载
│       ├── socket.ts        # WebSocket 服务
│       ├── milvus/          # 连接管理
│       ├── collections/     # 集合 CRUD + 搜索/查询
│       ├── database/        # 数据库管理
│       ├── partitions/      # 分区管理
│       ├── users/           # 用户/角色/权限
│       ├── crons/           # 定时轮询（WebSocket 状态推送）
│       └── utils/           # 共享工具
├── docker-compose.yml       # 本地完整环境（Milvus + etcd + MinIO + PhiGent）
└── Dockerfile               # 生产镜像多阶段构建
```

## 与上游 Attu 的关系

PhiGent 基于 Attu v2.5.x，在保留全部 Milvus 管理功能的基础上，增加了：

- **索引树页面** — 可视化 claude-context 代码索引的运行状态
- **GitLab 仓库管理** — 前端界面配置远程仓库定时索引
- **品牌定制** — 名称、首页、菜单布局适配内部使用场景

具体定制记录见 git history。

## 许可证

[Apache License 2.0](./LICENSE) — 原始版权归 Zilliz 所有，修改部分版权归 PhiGent (Seeway) 团队。完整归属声明见 [NOTICE](./NOTICE)。
