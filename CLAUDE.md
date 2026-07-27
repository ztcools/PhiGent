# PhiGent — Milvus 管理控制台

> PhiGent 是 Seeway 团队维护的 Milvus 内部管理控制台，衍生自 [Attu](https://github.com/zilliztech/attu)（Apache 2.0 协议）。

## 项目概述

- **性质**：Web 全栈应用（React 前端 + Express 后端），含 Electron 桌面端 + Docker 容器化
- **用途**：连接 Milvus 向量数据库，管理 Database/Collection/Partition/Index/User/Role，可视化数据查询、向量搜索，提供 Playground 交互控制台
- **技术栈**：
  - 前端：React 18 + TypeScript + Vite + MUI 5 + CodeMirror 6 + i18next + Socket.IO Client
  - 后端：Express + TypeScript + `@zilliz/milvus2-sdk-node` + Socket.IO Server + node-cron + LRU Cache
  - 构建：yarn workspace（monorepo） + Vite（client）+ tsc（server）
  - 部署：Docker Compose（Milvus + etcd + MinIO + PhiGent 四容器）

## 架构总览

```
PhiGent (monorepo)
├── client/                     # React 前端 (Vite 构建)
│   └── src/
│       ├── pages/              # 页面组件（按业务模块）
│       ├── components/         # 通用组件
│       ├── context/            # React Context 全局状态
│       ├── http/               # HTTP API 调用层 (axios)
│       ├── router/             # HashRouter 路由
│       ├── hooks/              # 通用 hooks
│       ├── i18n/               # 国际化 (中文/英文)
│       ├── utils/              # 工具函数
│       ├── consts/             # 常量
│       └── styles/             # 主题配置
└── server/                     # Express 后端 (tsc 构建)
    └── src/
        ├── app.ts              # 入口：Express 实例 + LRU 客户端缓存 + 路由挂载
        ├── socket.ts           # Socket.IO WebSocket 服务器
        ├── middleware/         # Express 中间件（clientId 注入/响应转换/错误处理/日志）
        ├── milvus/             # Milvus 连接管理 (connect/disconnect/useDB/flush/metrics)
        ├── collections/        # Collection CRUD + 搜索/查询/插入/索引/别名/replica
        ├── database/           # Database CRUD
        ├── partitions/         # Partition CRUD
        ├── users/              # User/Role/Privilege 管理 (RBAC)
        ├── crons/              # 定时任务（轮询 collection 加载/索引状态，推送给前端）
        ├── playground/         # Playground HTTP 代理转发
        ├── utils/              # 共享工具（常量/Queue/Helper/Network）
        └── types/              # TypeScript 类型定义
```

## 核心架构设计

### 1. 无状态 API + LRU 客户端缓存

后端**不持久化** Milvus 连接状态。每个请求必须通过 `milvus-client-id` 请求头携带客户端标识。

```
前端 POST /api/v1/milvus/connect {address, username, password, token} →
  后端 new MilvusClient() → connectPromise → checkHealth →
  存入 LRU Cache (TTL=24h) key=clientId →
  返回 {clientId, database}

后续所有请求 Header: milvus-client-id: <clientId>, x-attu-database: <db_name>
  → ReqHeaderMiddleware 解析 clientId 注入 req.clientId/req.db_name →
  → Controller → Service → clientCache.get(clientId).milvusClient → SDK 调用
```

关键文件：
- [app.ts](server/src/app.ts) — `clientCache = new LRUCache({ttl: CLIENT_TTL, ttlAutopurge: true})`
- [middleware/index.ts](server/src/middleware/index.ts) — `ReqHeaderMiddleware` 解析 Header，`TransformResMiddleware` 统一响应格式 `{data, statusCode: 200}`
- [milvus.service.ts](server/src/milvus/milvus.service.ts) — `connectMilvus()` 创建/复用客户端，健康检查验证

### 2. Controller-Service 分层

每个业务模块采用相同模式：

```
Controller (Router)        → 路由定义 + DTO 验证 + 调用 Service
Service                     → 纯业务逻辑，从 clientCache 获取 milvusClient 操作 SDK
```

路由全部挂载在 `/api/v1/` 下：
- `/api/v1/milvus/*` — 连接/断开/版本/useDB/flush/metrics
- `/api/v1/databases/*` — Database CRUD
- `/api/v1/collections/*` — Collection CRUD + 向量搜索/查询/插入/索引管理
- `/api/v1/partitions/*` — Partition CRUD
- `/api/v1/users/*` — 用户/角色/权限管理
- `/api/v1/crons/*` — 定时轮询控制
- `/api/v1/playground/*` — HTTP 代理请求转发
- `GET /healthy` — 健康检查

### 3. WebSocket 实时推送

[cron 调度](server/src/crons/crons.service.ts) 每 5 秒轮询正在加载/索引的 collection 状态，通过 Socket.IO 推送给前端。流程：

```
前端 useEffect → useWebSocket hook → io(url, {extraHeaders: {milvus-client-id}}) →
  连接时：clients.set(clientId, socket) →
  后端 CronsService (node-cron, */5 * * * * *) → 轮询 collection 状态 →
    socket.emit(WS_EVENTS.COLLECTION_UPDATE, {collections, database}) →
  前端 socket.on(COLLECTION_UPDATE, updateCollections) → 触发 re-render
```

当 collection 不再处于 loading/indexing 状态时自动停止 cron。

### 4. 前端状态管理（React Context）

6 层 Context 嵌套（由内到外）：

| Context | 文件 | 职责 |
|---------|------|------|
| `ColorModeProvider` | [context/ColorMode.tsx](client/src/context/ColorMode.tsx) | 亮/暗主题切换 |
| `AuthProvider` | [context/Auth.tsx](client/src/context/Auth.tsx) | Milvus 连接认证（login/logout/clientId/isAuth） |
| `DataProvider` | [context/Data.tsx](client/src/context/Data.tsx) | Database/Collection 列表 + WebSocket 集成 |
| `RootProvider` | [context/Root.tsx](client/src/context/Root.tsx) | 全局 SnackBar/Dialog/Drawer + 版本信息 |
| `SystemProvider` | [context/System.tsx](client/src/context/System.tsx) | 系统监控指标（metrics） |
| `NavProvider` | [context/Navigation.tsx](client/src/context/Navigation.tsx) | 导航状态 |

### 5. 前端路由结构

使用 HashRouter，路由定义在 [config/routes.ts](client/src/config/routes.ts)：

```
/                       → 首页 (Overview)
/connect                → 连接页面
/databases/:db/collections  → 数据库页面（左侧索引树 + 右侧 Collection 列表）
/databases/:db/:collection/:page  → Collection 详情页（Schema/Data/Search/Segments/Properties）
/play                   → Playground (CodeMirror HTTP 控制台)
/users /roles /privilege-groups  → 用户和角色管理
/system                 → 系统监控面板
/index-tree             → 索引树查看 (PhiGent 定制)
/gitlab                 → GitLab 仓库管理 (PhiGent 定制)
```

每个页面通过 `useNavigationHook(ROUTE_PATHS.xxx)` 设置标题和导航状态。

## 页面架构（client/src/pages/）

### Collections 详情页 ([databases/collections/](client/src/pages/databases/collections/))
- **Schema** ([schema/Schema.tsx](client/src/pages/databases/collections/schema/Schema.tsx)) — 字段定义 + 索引参数展示和创建/删除
- **Data** ([data/CollectionData.tsx](client/src/pages/databases/collections/data/CollectionData.tsx)) — 数据浏览/筛选/分页（Grid 虚拟滚动）
- **Search** ([search/Search.tsx](client/src/pages/databases/collections/search/Search.tsx)) — 向量相似度搜索 + 标量过滤
- **Segments** ([segments/Segments.tsx](client/src/pages/databases/collections/segments/Segments.tsx)) — Segment 状态信息

### Playground ([play/](client/src/pages/play/))
- 基于 CodeMirror 6 的 HTTP 请求控制台
- 自定义语言扩展（Milvus HTTP API）
- 自动补全、语法高亮、codelens、请求历史

### Index Tree ([index-tree/IndexTree.tsx](client/src/pages/index-tree/IndexTree.tsx))
- PhiGent 定制页面，显示所有代码仓库的索引状态（branch -> collection 映射）
- 从 Milvus `code_index_state` collection 读取索引元数据
- 树形展示 repo → branch → indexed state，含 entity 数量

### GitLab Repos ([gitlab/GitLabRepos.tsx](client/src/pages/gitlab/GitLabRepos.tsx))
- PhiGent 定制页面，管理 git-index-service 的仓库配置
- 通过 HTTP 调用 git-index-service（port 8795）的 REST API
- CRUD 仓库 + 定时调度设置 + SSH 公钥查看 + 手动触发索引

### 首页 ([home/Home.tsx](client/src/pages/home/Home.tsx))
- 概览面板：Database 列表卡片、系统信息卡
- Quick access to git repos and community links

## 关键工具函数 (server/src/utils/)

| 文件 | 关键导出 |
|------|---------|
| [Const.ts](server/src/utils/Const.ts) | `MILVUS_CLIENT_ID`, `CLIENT_TTL`, `WS_EVENTS`, `DEFAULT_MILVUS_PORT`, `HTTP_STATUS_CODE`, `RBAC Privileges` 枚举 |
| [Queue.ts](server/src/utils/Queue.ts) | `SimpleQueue<T>` — 简单队列，支持 `executeNext()` 批量顺序消费 |
| [Helper.ts](server/src/utils/Helper.ts) | `findKeyValue`, `genRows`（生成示例数据）, `convertFieldSchemaToFieldType`, `cloneObj` 等 |
| [Network.ts](server/src/utils/Network.ts) | `getIp()` 获取本机 IP（用于启动日志） |
| [Shared.ts](server/src/utils/Shared.ts) | `isElectron()`, `checkLoading()`, `checkIndexing()` |

## HTTP 客户端层 (client/src/http/)

所有后端 API 调用通过 [Axios.ts](client/src/http/Axios.ts) 的 axios 实例发出，自动注入 `milvus-client-id` Header。URL 根据环境自适应（开发空、生产从 `window._env_.HOST_URL` 读取、Electron 指 localhost:3080）。

服务类按模块划分：
- `Milvus.service.ts` — connect/disconnect/version/useDB
- `Collection.service.ts` — 继承 `BaseModel`，CRUD + search/query/insert
- `Database.service.ts` — 继承 `BaseModel`，Database CRUD
- `Partition.service.ts` — 继承 `BaseModel`，Partition CRUD
- `User.service.ts` — User/Role/Privilege 管理
- `Segment.service.ts` — Segment 信息查询
- `Data.service.ts` — 数据操作

`BaseModel` 封装通用的 REST 方法：`find()`, `search()`, `create()`, `update()`, `delete()`。

## PhiGent 与上游 Attu 的差异

1. **品牌化**：名称/标题/文档改为 PhiGent
2. **索引树页面**：[IndexTree](client/src/pages/index-tree/IndexTree.tsx) — 可视化 claude-context 索引状态
3. **GitLab 仓库管理**：[GitLabRepos](client/src/pages/gitlab/GitLabRepos.tsx) — 前端 UI 管理 git-index-service
4. **首页改造**：[Home](client/src/pages/home/Home.tsx) — Repository 卡片 + 定制面板
5. **菜单调整**：数据库 → GitLab仓库 → 索引树 → 用户和角色 → 系统视图 → play
6. **Docker Compose**：本地开发用，含完整的 Milvus+etcd+MinIO+PhiGent 栈

## 开发命令

```bash
# 安装依赖
cd client && yarn install
cd server && yarn install

# 启动开发
cd client && yarn start        # Vite dev server → http://localhost:5173
cd server && yarn start        # nodemon src/app.ts → http://localhost:3000

# 生产构建
cd client && yarn build        # 构建到 client/build/
cd server && yarn build        # tsc 编译到 server/dist/

# Docker 本地环境（含 Milvus）
docker compose up -d

# 生产运行
cd server && yarn start:prod   # node dist/src/app.js

# 代码检查
cd server && yarn lint         # tslint
cd client && yarn format       # prettier
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SERVER_PORT` | 3000 | 服务端口 |
| `MILVUS_URL` | — | 默认 Milvus 地址（前端连接页预填） |
| `MILVUS_DATABASE` | — | 默认数据库 |
| `ATTU_LOG_LEVEL` | info | SDK 日志级别 |
| `ROOT_CERT_PATH` | — | TLS 根证书路径 |
| `PRIVATE_KEY_PATH` | — | TLS 私钥路径 |
| `CERT_CHAIN_PATH` | — | TLS 证书链路径 |
| `SERVER_NAME` | — | TLS SNI 服务器名 |
| `NODE_ENV` | — | `production` 时使用 `yarn start:prod` |

## Electron 桌面端

PhiGent 保留 Electron 打包能力（`electron-builder`），构建 Mac/Linux/Windows 桌面应用：
```bash
cd server && yarn build-electron && yarn electron  # 开发
cd server && yarn mac / yarn linux / yarn win       # 打包
```

Electron 模式下前端指向 `http://127.0.0.1:3080`，后端使用 `electron-store` 保存连接配置。

## 代码约定

- 命名：CamelCase 文件名、camelCase 变量/函数、PascalCase 类/组件
- 组件/页面放在子文件夹：`ComponentName/ComponentName.tsx` + `styles.ts` + `Types.ts`
- 后端服务：`*.service.ts` + `*.controller.ts` 配对
- DTO 验证：`class-validator` + `dtoValidationMiddleware`（仅 server 有此层）
- 响应格式：`TransformResMiddleware` 统一封装 `{data, statusCode: 200}`
- 前端 API 层：继承 `BaseModel`，方法和 URL 在静态方法中定义
- 国际化：`useTranslation('ns')` 按命名空间分离，翻译文件在 `i18n/cn/` 和 `i18n/en/`

## 项目边界

- **PhiGent 不存储**：连接状态、Milvus 元数据（纯转发代理）
- **PhiGent 依赖**：Milvus >= 2.4（使用 v2 API 如 hybrid search、database management）
- **上游关系**：基于 Attu v2.5.x，可选择性同步上游修复（通过 cherry-pick）
