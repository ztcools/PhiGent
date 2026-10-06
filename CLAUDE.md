# PhiGent — Milvus 管理控制台

PhiGent 是 Seeway 团队维护的 Milvus 内部管理控制台，衍生自 Attu（Apache 2.0 协议）。当前项目定位为 **Web 全栈应用 + Docker 部署**，已移除 Playground HTTP 代理、Segments UI 标签页和 Electron 桌面端。

## 技术栈

- 前端：React 19 + TypeScript + Vite + MUI 5 + CodeMirror 6 + i18next + Socket.IO Client
- 后端：Express 5 + TypeScript + `@zilliz/milvus2-sdk-node` + Socket.IO Server + node-cron + LRU Cache
- 工程：Yarn Classic workspace + ESLint + Prettier + Jest + Vitest
- 部署：Docker / Docker Compose（Milvus + etcd + MinIO + PhiGent）

## 目录结构

```text
PhiGent/
├── client/                     # React 前端
│   └── src/
│       ├── pages/              # 页面：home/databases/index-tree/gitlab/system/user 等
│       ├── components/         # 通用组件
│       ├── context/            # Auth/Data/System/Root/Nav/Theme 状态
│       ├── http/               # Axios API 层
│       ├── router/             # HashRouter 路由
│       ├── hooks/              # 通用 hooks
│       ├── i18n/               # 中英文翻译
│       ├── utils/              # 工具函数
│       └── styles/             # 主题配置
├── server/                     # Express 后端
│   └── src/
│       ├── app.ts              # Express 实例 + LRU cache + 路由挂载
│       ├── socket.ts           # Socket.IO 服务
│       ├── middleware/         # 请求头、响应转换、错误处理、DTO 校验
│       ├── milvus/             # 连接/断开/useDB/flush/metrics
│       ├── collections/        # Collection CRUD + 数据/搜索/索引/属性
│       ├── database/           # Database CRUD
│       ├── partitions/         # Partition CRUD
│       ├── users/              # User/Role/Privilege 管理
│       ├── crons/              # Collection load/index 状态轮询
│       ├── utils/              # 常量、Helper、Network、Shared
│       └── types/              # 类型定义
└── docs/                       # 架构、开发、API、部署文档
```

## 核心架构

### 无状态 API + LRU 客户端缓存

后端不持久化 Milvus 元数据。连接成功后，Milvus SDK client 存在 `clientCache` 中；后续请求通过 `milvus-client-id` 关联到对应连接。

```text
POST /api/v1/milvus/connect → new MilvusClient → health/db 权限校验 → clientCache.set(clientId)
后续请求 Header: milvus-client-id + x-phigent-database（兼容 x-attu-database）
```

`clientCache` 有 TTL、最大容量和 dispose 清理逻辑：淘汰时关闭 Milvus client 并清理 cron。

### Controller-Service 分层

- Controller：路由、DTO 校验、响应发送、错误转交 `next(error)`
- Service：业务逻辑、Milvus SDK 调用、错误分类

### WebSocket 实时推送

`crons` 模块每 5 秒轮询 loading/indexing collection 状态，通过 Socket.IO 推送 `COLLECTION_UPDATE`。socket 断开时会清理对应 cron。

### 前端状态

主要 Context：

- `AuthProvider`：登录/登出/clientId/authReq
- `DataProvider`：database/collection 列表、WebSocket 更新
- `SystemProvider`：系统 metrics
- `RootProvider`：SnackBar/Dialog/Drawer/版本信息
- `NavProvider`：导航标题和菜单状态
- `ColorModeProvider`：主题模式

## 路由

- `/`：首页 Overview
- `/connect`：Milvus 连接页
- `/databases/:db/collections`：数据库页面
- `/databases/:db/:collection/:page`：Collection 详情页（Schema/Data/Search/Partitions/Properties）
- `/index-tree`：代码索引树
- `/gitlab`：git-index-service 仓库管理
- `/users`、`/roles`、`/privilege-groups`：用户和权限管理
- `/system`：系统视图

已移除：`/play`、Segments tab、Electron 路径。

## 开发命令

```bash
corepack enable
yarn install

yarn dev             # 同时启动 client + server
yarn build           # 构建 client + server
yarn lint            # ESLint
yarn test            # server Jest + client Vitest
yarn format:check    # Prettier 检查
```

子包命令：

```bash
yarn workspace phigent-client start
yarn workspace phigent-client build
yarn workspace phigent start
yarn workspace phigent build
```

## Docker

```bash
docker compose up -d --build
```

访问 `http://localhost:8000`。

## 环境变量

详见 `.env.example` 和 `client/.env.example`。

关键变量：

| 变量 | 说明 |
|------|------|
| `SERVER_PORT` | 后端端口，默认 3000 |
| `MILVUS_URL` | 默认 Milvus 地址 |
| `DATABASE` | 默认 Database |
| `MILVUS_SERVERS` | 固定连接列表 |
| `HOST_URL` | 生产环境 API host |
| `PHIGENT_LOG_LEVEL` | SDK 日志级别，兼容 `ATTU_LOG_LEVEL` |
| `GIT_INDEX_HOST` / `GIT_INDEX_PORT` | git-index-service 地址 |
| `ROOT_CERT_PATH` / `PRIVATE_KEY_PATH` / `CERT_CHAIN_PATH` / `SERVER_NAME` | Milvus TLS 配置 |

## 代码约定

- 注释使用中文，解释原因和边界，不重复代码字面含义。
- 前端副作用必须放在 `useEffect` 中，不得在 render 阶段请求 API。
- localStorage 读写必须 `try/catch`，防止隐私模式崩溃。
- 后端错误必须走 `next(error)`，不要在 Controller 中吞错。
- 不得把 password/token/authorization metadata 写入日志或错误响应。
- 新增前端文案必须走 i18n。

## 文档

- `docs/architecture.md`
- `docs/development.md`
- `docs/api.md`
- `docs/deployment.md`
