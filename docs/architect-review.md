# PhiGent 深度工程化优化 · M1 诊断报告

> **审阅方**：高级架构师视角
> **审阅时间**：2026-09-30
> **审阅范围**：`client/src/` (319 文件、41 070 行) + `server/src/` (全部 TS 文件) + 根工程化配置
> **审阅方式**：3 个并行 Explore agent 深度扫描 + 人工汇总
> **产出**：本文档 = 现状分析 + 问题清单 + 改造方案 + 后续注意事项

---

## 目录

1. [项目现状分析](#1-项目现状分析)
2. [问题清单（按 P0 / P1 / P2 分级）](#2-问题清单)
   - 2.1 [P0 潜在 Bug（26 条）](#21-p0-潜在-bug26-条)
   - 2.2 [P1 架构与坏味道（24 条）](#22-p1-架构与坏味道24-条)
   - 2.3 [P1 安全（6 条）](#23-p1-安全6-条)
   - 2.4 [P1 UX（6 条）](#24-p1-ux6-条)
   - 2.5 [P2 性能（11 条）](#25-p2-性能11-条)
   - 2.6 [死代码 / 冗余（14 条）](#26-死代码--冗余14-条)
   - 2.7 [样式一致性（4 条）](#27-样式一致性4-条)
   - 2.8 [工程化配置（30 条）](#28-工程化配置30-条)
   - 2.9 [补充观察](#29-补充观察)
3. [整体改造方案](#3-整体改造方案)
   - 3.1 [里程碑路线图](#31-里程碑路线图)
   - 3.2 [M2 剔除三大模块](#32-m2-剔除三大模块)
   - 3.3 [M3 Bug 修复 + 代码精简](#33-m3-bug-修复--代码精简)
   - 3.4 [M4 目录重构 + 工程化](#34-m4-目录重构--工程化)
   - 3.5 [M5 测试体系](#35-m5-测试体系)
   - 3.6 [M6 文档](#36-m6-文档)
4. [新目录结构](#4-新目录结构)
5. [改造后的注意事项与后续迭代建议](#5-改造后的注意事项与后续迭代建议)

---

## 1. 项目现状分析

### 1.1 定位与规模

PhiGent 是基于 Attu（Zilliz 开源 Milvus 管理台，Apache 2.0）二次开发的**内部管理控制台**，衍生自 Attu v2.5.x。

| 维度 | 数值 |
|------|------|
| 前端代码量 | 319 个 TS/TSX 文件，41 070 行 |
| 后端代码量 | 中等规模，业务模块 8 个（milvus/collections/database/partitions/users/crons/playground/events） |
| PhiGent 自研模块 | 3 个（IndexTree、GitLabRepos、Home 改造） |
| Attu 原生模块 | 其余（Databases/Collections/Users/System/Playground/Segments/Electron 等） |
| 未提交改动 | 本轮 M0 已合并（172 文件中文注释翻译） |
| Git 分支 | `chore/chinese-comments`（主线 `main`） |

### 1.2 架构评价

**总体架构合理**：
- 无状态 API + LRU 客户端缓存的设计 clean，是标准的多租户 Milvus 网关模式
- Controller-Service 分层清晰
- WebSocket 增量推送（cron 轮询 loading/indexing 状态）实现思路正确
- 前端 6 层 Context 嵌套可以合并但**不算严重问题**

**但工程化基线严重滞后**：
- 根 `package.json` 是空壳，**yarn workspace 名不副实**——CLAUDE.md 说 monorepo，实际是"两个仓库并排放"
- 后端仍在用 **tslint**（Palantir 2019 年官方 deprecated）
- 前端 `package.json` 里的 `eslintConfig` 是**僵尸配置**（依赖里没装 eslint）
- 全仓无 CI、无 pre-commit、无 husky、无 lint-staged
- 客户端`node_modules` 完全没有测试（0 个 `*.test.*` 文件）；服务端有 Jest 依赖但也没测试用例
- Docker Compose 里 `image: zilliz/attu:v2.4` —— 意味着 `docker compose up -d` 拉的**根本不是 PhiGent，是上游 Attu**，用户看不到定制页面

### 1.3 代码质量评价

**优点**：
- 命名规范一致（CamelCase 文件、camelCase 变量、PascalCase 类）
- 服务分层规整（`*.service.ts` + `*.controller.ts` + `dto.ts`）
- 前端 Context 拆分合理（Auth / Data / System / Nav / Root / ColorMode 各司其职）

**痛点**：
- **前端 `any` 用了 284 处**（tsconfig 已开 strict，但项目开发中一路 `as any` 逃逸）
- **前端 34 处生产 `console.*`**、后端 22 处生产 `console.*`
- **前端 15+ 处 `key={index}`** 用于动态列表
- **无一处 `React.memo`、useReducer 全项目 0 使用**
- 后端 `throwErrorFromSDK`（`utils/Error.ts`）是空函数，但仍在被 export
- 服务端 `PubSub` (`events/index.ts`) 定义但无 producer / consumer——纯死模块

### 1.4 定制内容与上游关系

PhiGent 相对 Attu 只有以下差异：
1. IndexTree 页面（`pages/index-tree/`）
2. GitLabRepos 页面（`pages/gitlab/`）
3. Home 页面改造（Repository 卡片）
4. 品牌名替换（**未完成**：`server/package.json:2 name: "attu"`、`docker-compose.yml:63 服务名 attu`、`i18n key attu.ui.lang`、HTTP header `x-attu-database`、env `ATTU_LOG_LEVEL` 仍在使用）

### 1.5 结论

**项目底子好、架构合理，但工程化欠账严重且藏了若干真 bug。** 优化不应大改架构；应先修 bug、清工程化欠账、剔多余模块、补文档与测试。

---

## 2. 问题清单

> 每条都给出：**文件路径 + 起始行 + 现象 + 风险 + 建议方向**。风险等级：P0（真 bug，必修）、P1（架构/安全/UX 隐患）、P2（性能/可读性）、D（死代码）。

---

### 2.1 P0 潜在 Bug（26 条）

#### 服务端（14 条）

| ID | 位置 | 问题 |
|----|------|------|
| **P0-S1** | `server/src/milvus/milvus.controller.ts:109-112` | `closeConnection` Controller 未 `async`/`await`，`result` 是未 await 的 Promise 直接 `res.send`。客户端拿到伪 200，异常走 unhandledRejection |
| **P0-S2** | `server/src/milvus/milvus.service.ts:198-210` | `useDatabase` 里 `milvusClient.use()` 未 await，但**紧接着**就把新 db 写入 cache。SDK reject 时 cache.database 已经被覆盖为不存在的库 |
| **P0-S3** | `server/src/milvus/milvus.service.ts:167-174` | `getMetrics` 忘写 await，返回未包装的 Promise |
| **P0-S4** | `server/src/milvus/milvus.service.ts:43-158` | **连接缓存 race**：并发两个 `connectMilvus` 请求都走 else 分支各自 new 一个 MilvusClient，`clientCache.set` 后者覆盖前者→前一个的 gRPC 连接池永不关闭 |
| **P0-S5** | `server/src/app.ts:34-45` | **LRU cache 未提供 `dispose`**：TTL 到期后 milvusClient 内部 gRPC pool（max: 10）、cron、collectionsQueue 均不清理。且未设 max size，理论上内存无上限 |
| **P0-S6** | `server/src/socket.ts:65-69` | Socket disconnect 只删 `clients` map，不清 cron，不 close milvusClient。用户关页面后 5 秒 cron 仍在跑，浪费 Milvus 请求 |
| **P0-S7** | `server/src/middleware/validation.ts:19-38` | `dtoValidationMiddleware` promise 链无 `.catch`；嵌套字段 `error.constraints` undefined 时 `Object.values(undefined)` 崩溃 |
| **P0-S8** | `server/src/collections/collections.service.ts:657-677` | `getLoadedCollections`：`count = this.count(...)` **没 await** 就塞进返回体，前端拿到的 `rowCount` 是 Promise（被 JSON 序列化成 `{}`） |
| **P0-S9** | `server/src/collections/collections.service.ts:278-300` | `count()` 静默吞掉所有错误（`try { ... } catch { console.log('ignore count error') }`），网络故障 vs 权限拒绝 vs collection 未加载完全无法区分 |
| **P0-S10** | `server/src/collections/collections.controller.ts:682-711` | `updateMmapSettings` 混用 `promises.push(await ...)` 与裸 `promises.push(promise)`，产生并发时序错误；前者阻塞、后者并行，任何一步失败其他步已启动 |
| **P0-S11** | `server/src/collections/collections.controller.ts:713-719` | `updateMmapSettings` 校验失败时 `return result;` **而非 `res.send(result)`**——请求挂起直到 socket 超时 |
| **P0-S12** | `server/src/users/users.controller.ts:604-620` | `updatePrivilegeGrp` 在 try 块**之外** await `getPrivilegeGroup`，异常绕过 `ErrorMiddleware` |
| **P0-S13** | `server/src/users/users.controller.ts:462-527` | `updateRolePrivileges` 回滚栈**误滚**：任何一次授权失败会把之前成功的 grant 全部反向执行 + `deleteRole` — 修改一条权限失败就**误删整个角色** |
| **P0-S14** | `server/src/milvus/milvus.service.ts:21-25` | `formatAddress` 正则 `/(http):\/\//` **只识别 http**，`https://xxx` 会被剥成 `s://xxx` → TLS 场景连接失败 |

#### 客户端（12 条）

| ID | 位置 | 问题 |
|----|------|------|
| **P0-C1** | `client/src/pages/databases/collections/data/CollectionData.tsx:31-42` | **违反 Rules of Hooks**：在 hooks 前 early return，切换 collection 时 hook 顺序突变，React 抛 "Rendered fewer/more hooks" |
| **P0-C2** | `client/src/pages/databases/collections/schema/Schema.tsx:62-65` | **render body 里调 fetchCollection side-effect**：schema 未加载时每次 render 都发请求 → 请求风暴（严格模式下×2） |
| **P0-C3** | `client/src/pages/home/Home.tsx:275-278` | **直接 mutate context state**：`db.collections = collections.map(...)` 污染 Auth 上下文引用 |
| **P0-C4** | `client/src/pages/play/Play.tsx:43-60` | `JSON.parse(localStorage.result)` 无 try/catch —— localStorage 被污染时白屏 |
| **P0-C5** | `client/src/pages/connect/AuthForm.tsx:198, 264, 315` | `JSON.parse(ATTU_AUTH_HISTORY)` 3 处无 try/catch —— 用户彻底无法登录 |
| **P0-C6** | `client/src/context/ColorMode.tsx:21`、`hooks/useUIPrefs.ts:20` | localStorage 读取在 render body 而非 lazy init；Safari 隐私模式抛异常直接崩全局 |
| **P0-C7** | `client/src/context/Auth.tsx:38-59` | 同上，`localAuthReq` 用 `let` 定义在函数体内，每次 render 都执行 IO+parse |
| **P0-C8** | `client/src/context/hooks/useDatabaseManagement.ts:51-56` | **useEffect deps 含整个 `authReq` 对象**，effect 内又 setAuthReq → 潜在死循环 |
| **P0-C9** | `client/src/context/Data.tsx:65-71` | useEffect 缺 `fetchCollections`/`setCollections` 依赖，过期闭包 |
| **P0-C10** | `client/src/context/Root.tsx:83-95` | logout 分支 `setDialog({ ...dialog, open: false })` 拿旧闭包（dialog 不在 deps） |
| **P0-C11** | `client/src/context/Auth.tsx:90-97` | `login`/`logout` 未 useCallback，向下游 hook 传播导致 `fetchDatabases` 每次 render 引用变化 → listDatabases 反复调用 |
| **P0-C12** | `client/src/pages/databases/collections/segments/Segments.tsx:28-47` | `fetchSegments` 无 try/catch，任一请求 reject → loading 永远 true |

---

### 2.2 P1 架构与坏味道（24 条）

#### 服务端（10 条）

| ID | 位置 | 问题 |
|----|------|------|
| **P1-S1** | `server/src/users/users.controller.ts:421-537`, `collections.controller.ts:223-263, 674-723` | Controller 混业务：rollback 栈、事务控制、逐字段循环 SDK 调用应下沉到 Service |
| **P1-S2** | `server/src/users/users.controller.ts:236, 532` | 同一 Controller 内 `res.send()` 与 `res.status(200).json(...)` 混用 |
| **P1-S3** | 全部 Controller | **50+ 处** `try { ... } catch (e) { next(e) }` 复制粘贴 —— 抽 `asyncHandler(fn)` HOF 可砍数百行 |
| **P1-S4** | 多 Controller | `dtoValidationMiddleware` 使用不一致：`GET /collections/statistics`、`POST /collections/details`、`updateMmapSettings`、`GET /collections/index` 全无 DTO |
| **P1-S5** | `server/src/middleware/index.ts:49-66` | `TransformResMiddleware` 通过 monkey-patch `res.json` 实现，语义反直觉；后续中间件的 `res.json` 引用会被这次替换影响 |
| **P1-S6** | 多处 | 硬编码字符串未进 `Const.ts`：`x-attu-database`、`milvus-client-id`（socket.ts 未引用现有常量）、`DESCRIPTION_CACHE_MAX = 20_000`、`BATCH_SIZE = 1000`、默认 db `'default'` |
| **P1-S7** | 全项目 | `console.*` 与 morgan 混用，无 level、无 trace_id、无 JSON 结构 |
| **P1-S8** | `server/package.json:57, 74` | **tslint 已弃用**（2019 年 deprecated），`prebuild` 每次构建都 `--fix` 静默修改源码 |
| **P1-S9** | `server/src/crons/crons.service.ts:26-29` | SchedulerRegistry DI 形同虚设，直接 module 级单例更清楚 |
| **P1-S10** | `server/src/utils/Error.ts:1-7` | `throwErrorFromSDK` 函数体全被注释，等于空实现却仍被 export → 死代码 |

#### 客户端（14 条）

| ID | 位置 | 问题 |
|----|------|------|
| **P1-C1** | `client/src/App.tsx:12-30` | 6 层 Provider 嵌套顺序耦合脆弱，可合并 Auth/Data/System 为 SessionProvider |
| **P1-C2** | `client/src/context/Types.ts:80-82`、`context/System.tsx:16` | `SystemContext.data: any`，字段访问全靠运行时试探 |
| **P1-C3** | `client/src/context/Types.ts:84-94` | `PrometheusContextType` 定义但**从未消费**——迷惑读者以为项目有 Prometheus 集成 |
| **P1-C4** | `client/src/context/Root.tsx:32-121` | dialog/dialog2 双份重复而非泛化，第三个 dialog 就要出 dialog3 |
| **P1-C5** | `client/src/pages/dialogs/*.tsx` (21 files) | 25+ 处 confirmation dialog 模板重复，应抽 `useConfirmDialog(...)` |
| **P1-C6** | `client/src/http/BaseModel.ts:17-75` | `find`/`create`/`query` 命名与 HTTP 语义脱节；`query` = `find` post 分支 → 应直接暴露 `.get/.post/.put/.delete` |
| **P1-C7** | `client/src/components/layout/GlobalEffect.tsx:6-99` | Axios 拦截器 id 存 **module-level `let`**，HMR + Provider 二次挂载状态不一致 |
| **P1-C8** | `client/src/http/Axios.ts:22-34` | 请求拦截器用短路副作用 `address && (config.headers[k]=v)`，AxiosHeaders 类下绕过校验 |
| **P1-C9** | `client/src/http/index.ts:1-13` | 注释写"对象映射（已废弃）"但仍在 export → 读者困惑 |
| **P1-C10** | `client/src/context/hooks/useCollectionsManagement.ts:1-257` | 258 行单 hook 混合 debounce、race、cron 触发、excludeInfra、单表补拉 → 应拆 3 个 hook |
| **P1-C11** | `client/src/context/hooks/useCollectionsManagement.ts:175-245` | `batchRefreshCollections` deps 含 `collections` → tree scroll listener 频繁重绑 |
| **P1-C12** | `client/src/hooks/Query.ts:7` | 文件顶部自认注释 `// TODO: 重构这里，代码有点乱` — 分页与 collection 切换有已知闪回旧数据 bug |
| **P1-C13** | `client/src/config/routes.ts:232-238` | `CONNECT` 路由 element = `() => null` 死代码，从未被 renderRoutes 使用 |
| **P1-C14** | `client/src/hooks/Navigation.tsx:20-37` | `useNavigationHook` 每次 render 都 setNavInfo → NavProvider 消费者全部 re-render |

---

### 2.3 P1 安全（6 条）

| ID | 位置 | 问题 |
|----|------|------|
| **P1-SEC1** | `server/src/playground/playground.service.ts:1-28` | **Playground 是任意 URL 代理** → 完整 SSRF：可 GET AWS metadata (`169.254.169.254`)、内网 `localhost:9091`、任意内网服务 |
| **P1-SEC2** | `server/src/app.ts:71` | `helmet.contentSecurityPolicy: false`，配合 `cors()` 默认 `origin:*` → XSS 无兜底 |
| **P1-SEC3** | `server/src/app.ts:79` | `express.json({ limit: '256MB' })` 过大，任意 endpoint 都可吃 256MB body → DoS 成本极低 |
| **P1-SEC4** | 全项目 | **无 rate limit**：`/milvus/connect` 可被暴力破解 |
| **P1-SEC5** | `server/src/milvus/milvus.service.ts:63, 106-109, 155-156` | password/token 会随 SDK 原始 error 进日志（gRPC error 包含 authorization metadata） |
| **P1-SEC6** | `server/src/middleware/index.ts:34-46` | `bypassURLs.indexOf(req.url)` 完整字符串匹配 —— `/api/v1/milvus/version?_=xxx` 被误 401；clientId 无长度上限校验 |
| **ENV-2** | `client/public/env-config.js:4, 9` | **内网 IP 硬编码入仓**：`MILVUS_URL: '10.50.4.149:19530'`、`GIT_INDEX_HOST: 'http://10.50.4.149:8795'` |

---

### 2.4 P1 UX（6 条）

| ID | 位置 | 问题 |
|----|------|------|
| **P1-UX1** | `Segments.tsx:28-47` | 网络故障时表格永久转圈（同 P0-C12） |
| **P1-UX2** | `client/src/pages/home/Home.tsx:80-155` | Home 拉取 gitRepos 有骨架，`repos`（IndexTree）无骨架无空态，页面跳变 |
| **P1-UX3** | `client/src/context/Root.tsx:83-95` | Dialog 关闭动画期间清空 state → 内容闪烁 + 潜在报错 |
| **P1-UX4** | `dialogs/CreatePartitionDialog.tsx:53-63`、`FlushDialog.tsx:16-23` | 提交按钮未 disable 防重复点击 |
| **P1-UX5** | Collections/Segments/User 页 | 只 tree/index.tsx 用 useVirtualizer，其他大表格无虚拟滚动 |
| **P1-UX6** | `client/src/pages/gitlab/GitLabRepos.tsx:267-271` | `setInterval(load, 2500)` 无 visibility 判断，tab 隐藏时仍在轮询 |

---

### 2.5 P2 性能（11 条）

#### 服务端（5 条）

| ID | 位置 | 问题 |
|----|------|------|
| **P2-S1** | `collections.service.ts:683-704, 517-580` | `getStatistics`、`getAllCollections` 是典型 N+1，串行 `describeCollection` + `count` + `getReplicas` |
| **P2-S2** | `collections.service.ts:616-619` | `descriptionCache` 触顶时整表 `.clear()` 而非驱逐部分 —— 抖动大 |
| **P2-S3** | `utils/Helper.ts:258`、`collections.service.ts:351` | `cloneObj = JSON.parse(JSON.stringify(obj))` 用于 vectorSearch 每次调用（向量几十 KB - MB） |
| **P2-S4** | `app.ts:34-45` | LRU 无 max 也无 maxSize，24 小时内可无限持有 milvusClient（每个 pool.max=10） |
| **P2-S5** | `collections.service.ts:110-208, 592-633` | `describeCollection` 在 `getCollection`、`fillDescriptions` 里重复调用 |

#### 客户端（6 条）

| ID | 位置 | 问题 |
|----|------|------|
| **P2-C1** | `search/DataExplorer.tsx:2`、`user/D3PrivilegeTree.tsx:2` | `import * as d3 from 'd3'` 两处 → 全量 d3 (~250KB gzip) 塞进 bundle |
| **P2-C2** | `client/vite.config.mts:1-49` | 无 code split、无 manualChunks、无 dynamic import 路由 |
| **P2-C3** | 全项目 | **0 处 `React.memo`**；Home 消费 4 个 context，任一更新导致 DatabaseCard/GitRepoCard/SysCard 全部重渲染 |
| **P2-C4** | `client/src/components/icons/Icons.tsx:1-1049` | 60+ SvgIcon 作为 default export record，阻碍 tree-shaking |
| **P2-C5** | `client/src/pages/databases/Databases.tsx:152-275` | 100+ 行 effect deps 只有 `[collections]`，WebSocket 每次推送都 O(n) 遍历 |
| **P2-C6** | `client/src/pages/index.tsx:20-27` | `menuItems` 每次 render 都新建数组 → NavMenu 完整 rerender |

---

### 2.6 死代码 / 冗余（14 条）

#### 服务端（6 条）

| ID | 位置 | 状态 |
|----|------|------|
| **D-S1** | `server/src/events/index.ts` | `PubSub` 定义无 producer/consumer → 整个模块死 |
| **D-S2** | `server/src/utils/Error.ts` | `throwErrorFromSDK` 空实现（内容全注释）|
| **D-S3** | `server/src/users/users.controller.ts:641-677` | `assignRolePrivilege` / `revokeRolePrivilege` **无路由注册** |
| **D-S4** | `app.ts:40`、`milvus.service.ts:131` | `collectionsQueue` 定义无生产/消费；`SimpleQueue.executeNext` 全项目 0 调用 |
| **D-S5** | `databases.service.ts:93-96`、`collections.service.ts:770-774` | `hasDatabase` / `hasCollection` 定义无引用 |
| **D-S6** | 多处 | 注释掉的旧代码：`crons.service.ts:160`、`crons.controller.ts:45`、`collections.controller.ts:507`、`utils/Error.ts:5` |

#### 客户端（8 条）

| ID | 位置 | 状态 |
|----|------|------|
| **D-C1** | `hooks/Query.ts:7` | 注释 `// TODO: 重构这里，代码有点乱` |
| **D-C2** | `hooks/Query.ts:108` | 注释掉的 `console.log` |
| **D-C3** | `components/grid/Grid.tsx:148-159` | 注释掉的 setTimeout 块 |
| **D-C4** | `pages/system/DataCard.tsx:145-153` | 注释掉的 DataProgress JSX |
| **D-C5** | `pages/databases/collections/segments/Segments.tsx:153-158` | 注释掉的列定义 |
| **D-C6** | 全项目 34 处 | 生产 `console.log/error/info`（`System.tsx:73`、`useCollectionsManagement.ts:230`、`Grid.tsx:59, 89`、`useWebSocket.ts:60` 等） |
| **D-C7** | `context/Types.ts:84-94` | `PrometheusContextType` 未消费 |
| **D-C8** | `client/src/openapi/index.js:1-101` | 只服务于 Play 的 openapi.json 更新（Play 剔除后可删） |

---

### 2.7 样式一致性（4 条）

| ID | 问题 |
|----|------|
| **Style-1** | `sx` (580 处) + `styled()` (112 处) + `@mui/styles` **三种混用**无边界 |
| **Style-2** | `@mui/styles` (已 deprecated) 仍在依赖，`customSelector/Types.ts:2` 仍 import ClassNameMap |
| **Style-3** | 硬编码颜色 10+ 处：`#fff`、`#1976d2`、`#06F3AF`、`#E9E9ED`、`#6b7280` 以及 `rgba(9, 181, 114, ...)` 品牌绿分散在 tree/Partitions/Progress/Topology/Home/Collections/NavMenu 里 |
| **Style-4** | i18n 硬编码中文 30+ 处：`gitlab/GitLabRepos.tsx` 25 处、`index-tree/IndexTree.tsx` 4 处、`databases/tree/index.tsx` 2 处、`home/GitRepoCard.tsx` 3 处、`EditableDescription.tsx` 1 处 —— **i18n 系统被两套用法架空** |

---

### 2.8 工程化配置（30 条）

#### 依赖管理

| ID | 问题 |
|----|------|
| **DEP-1** | 根 `package.json` 是空壳，无 `workspaces` 字段。**yarn workspace 名不副实**：CLAUDE.md 声明 monorepo，实际要 `cd client && yarn install / cd server && yarn install` |
| **DEP-2** | 依赖版本不一致：TypeScript client `^5.8.2` vs server `^5.4.5`；prettier `^3.5.3` vs `^3.2.5`；`@types/node` **client `^12.0.0`（Node 12 已 2022-04 EOL）** vs server `^20.4.2` |
| **DEP-3** | server 仍用 `tslint@^6.1.3` + `tslint:recommended`（2019 年 deprecated） |
| **DEP-4** | client `package.json:72-76` 有 `eslintConfig` 但**依赖里没装任何 eslint 相关包** → 僵尸配置，前端**根本没有可运行的 lint** |
| **DEP-5** | 品牌残留：`server/package.json:2 name: "attu"`、`author: zilliz`、`repository.url: github.com/zilliztech/attu`、electron `attu.icns`、`artifactName: attu-...`、`docker-compose.yml:63-73 attu 服务` 拉的还是 `zilliz/attu:v2.4` |
| **DEP-6** | 过时依赖：react `18.2.0`（v19 已 GA）、`react-i18next@^13.5.0` 与 `i18next@^24.2.3` **版本错配**（15+ 才兼容 24）、`@mui/styles@^5.17.1`（v6 会移除）、`web-vitals@^1.0.1`（当前 v5，且 `reportWebVitals.ts` 用的 `getCLS/getFID` API 在 v3+ 被 `onCLS/onINP` 取代） |
| **DEP-7** | 未使用依赖：`remove@^0.1.5`（全 grep 无 `from 'remove'`）、`@types/lru-cache` 与实际版本不匹配、`@types/chalk` 冗余 |
| **DEP-8** | Electron 3 个重量级 devDep 拖累 server：`electron@^35.1.5`、`electron-builder@^26.0.12`、`electron-store@^8.2.0` |

#### 构建与脚本

| ID | 问题 |
|----|------|
| **BUILD-1** | 根 `package.json` 无 `dev`/`build`/`lint`/`test` 统一入口 |
| **BUILD-2** | `server/package.json:78 prestart: "rm -rf dist && yarn build"` —— Windows PowerShell 无 `rm -rf` 别名（同 package 已装 rimraf 却没用） |
| **BUILD-3** | `server/tsconfig.json:1-19` **未开 `strict`**，仅 `noImplicitAny`（client 是 strict —— 两端不一致）；target ES6（Node 20 支持 ES2022）；`include: ["src/**/*", "../../src/**/server"]` 有幽灵路径 |
| **BUILD-4** | `client/tsconfig.json:28 include: ["src", "../../src"]` 幽灵路径 |
| **BUILD-5** | `client/vite.config.mts:11-13` 无 `manualChunks`、无 bundle 分析 |
| **BUILD-6** | `outDir: 'build'` 是 CRA 遗物，非 Vite 惯例 `dist` |
| **BUILD-7** | client 无 `lint`/`test` 脚本；vitest.config.ts 存在但 0 个测试 |

#### Lint / Format

| ID | 问题 |
|----|------|
| **LINT-1** | 全仓无 `.eslintrc*` 配置文件 |
| **LINT-2** | client/server 各有一份 `.prettierrc` 副本，未来漂移只是时间问题 |
| **LINT-3** | 无 `.editorconfig` |
| **LINT-4** | 无 husky/lint-staged/commitlint |

#### `.gitignore` 与环境变量

| ID | 问题 |
|----|------|
| **GIT-1** | 缺 `.env`/`.env.local` root 级、`.idea/`、`.vscode/*`、通用 `*.log`、`server/coverage`；typo `/clientcoverage`；遗留 `/client/report.*.json`（Vite 不生成）、`express/dist`、`ap-client-api/`；`.gitignore:46 server/yarn.lock` 与仓库现状矛盾 |
| **ENV-1** | **🔴 真 bug**：`client/public/env-config.js:7 DATBASE: 'default'` typo —— 代码 `client/src/consts/Milvus.ts:5` 读 `DATABASE`，永远 undefined |
| **ENV-2** | 内网 IP 硬编码入仓（见 P1-SEC7） |
| **ENV-3** | `public/.env` (5 项) 与 `public/env-config.js` (6 项) 不同源 |
| **ENV-4** | 缺 `.env.example` |
| **ENV-5** | `env.sh` 注入路径未文档化 |
| **ENV-6** | 品牌残留 `ATTU_LOG_LEVEL`、`x-attu-database` 无 alias 迁移路径 |
| **ENV-7** | Electron 硬编码 SERVER_PORT=3080 与默认 3000 冲突 |

#### Docker & CI

| ID | 问题 |
|----|------|
| **DOCKER-1** | Dockerfile 未 prune devDependencies → 运行时镜像携带 `electron@35`、`jest`、`tslint` 等 |
| **DOCKER-2** | `ENV PORT=80` 与 `EXPOSE 3000` 与代码默认 3000 三方冲突 |
| **DOCKER-3** | 无 `HEALTHCHECK` 指令 |
| **DOCKER-4** | Dockerfile 写死国内 `--registry npmmirror.com` |
| **DOCKER-5** | **🔴 严重**：`docker-compose.yml:63-73` 服务名 `attu`、镜像 `zilliz/attu:v2.4` —— **拉的是上游 Attu 不是 PhiGent**，用户看不到定制页面 |
| **DOCKER-6** | `.dockerignore` 只忽略 4 项，未 ignore `.git`（体积大）、`.context/`、`README.md`、构建产物、测试 |
| **CI-1** | **完全没有 CI**（无 `.github/workflows/`、无 `.gitlab-ci.yml`）—— PR 无自动检查 |

---

### 2.9 补充观察

1. **TS `any` 泛滥**：前端 284 处 `any`（Query.ts / System.tsx / advancedSearch/Filter.tsx 是重灾区）；tsconfig 已开 strict 但被逃逸
2. **`key={index}` 15+ 处**：ToolBar/LoadingTable/DataListView/CustomDrawer/CreateUserDialog/PrivilegeGroups 等；重排/增删时会渲染错乱
3. **HashRouter 但 URL 未 `encodeURIComponent`**：`routes.ts` 里 collection 名含 `/` 或 `#` 会拆错路径
4. **`useReducer` 全项目 0 使用**：一些明显是状态机的（`dialogs/insert/Dialog.tsx` 的 activeStep + insertStatus + insertFailMsg + fileName + jsonData + csvData 组合）该用 useReducer
5. **孤儿 localStorage key**：Segments/Playground/Electron 删除时必须同步清理 `consts/Localstorage.ts`、`consts/Milvus.ts`、`i18n/en/*.ts`、`i18n/cn/*.ts` 里对应键位
6. **Router.tsx renderRoutes 用 `routes: any[]` 参数**（`router/Router.tsx:13`）—— 失去类型保护
7. **`describeCollection` 里有隐蔽副作用**（`collections.service.ts:203-205`）：直接 push SDK 返回对象的 `dynamicFields[0]` 到 `fields`，可能污染其他调用者
8. **server `app.ts` 无 `process.on('uncaughtException'/'unhandledRejection')`**，进程崩溃无有序退出
9. **SPA fallback `app.get('*', ...)` 会吃掉 API 未匹配路径**：`/api/v1/unknownXYZ` 返回 200 + index.html 而非 404 JSON
10. **`socket.emit` monkey-patch 未处理返回类型**（`socket.ts:83-92`），Socket.IO 升级签名会静默 break
11. **`app.ts:87` ReqHeaderMiddleware 挂位置**：`bypassURLs` 硬编码 `/api/v1/...` 前缀，路径改动即失效

---

## 3. 整体改造方案

### 3.1 里程碑路线图

| 里程碑 | 内容 | 预计 commit 数 | 用户 review 成本 | 依赖 |
|--------|------|-----------|-----------------|------|
| **M0**（已完成 ✅ `b8d8b961`）| 中文注释保底 | 1 | 0 | 无 |
| **M1**（本文档 ✅）| 深度扫描 → 诊断报告 | 1（文档）| 中（读本文档）| 无 |
| **M2** | 剔除 Electron / Playground / Segments | 3（一个模块一个）| 低（一次性 diff 阅读）| M1 |
| **M3** | 修 P0 bug × 26 + 死代码清理 + 精简 | 5-8（按主题分）| 高（逐条 review）| M2 |
| **M4** | 目录重构 + 工程化（workspace/eslint/env/docker/CI）| 4-6 | 高 | M3 |
| **M5** | 测试体系（server jest+supertest / client vitest+RTL） | 多批（先框架后模块）| 中 | M4 |
| **M6** | README + 开发文档重写 | 1-2 | 中 | M5 |

**总工作量估计**：约 3-5 天纯人工。

**回滚策略**：
- 每个 M 都在 `chore/chinese-comments` 分支上继续
- M4 之前，如果对整体方向不满意可以 `git reset --hard b8d8b961` 回到 M0
- M4 之后（目录重构）建议 fork 分支 `chore/refactor-milestone-4`，出问题从主线 rebase

---

### 3.2 M2 剔除三大模块

#### M2.1 剔除 Segments 页面

**影响文件（要删）**：
```
client/src/pages/databases/collections/segments/Segments.tsx
client/src/pages/databases/collections/segments/Types.ts
client/src/http/Segment.service.ts
```

**影响文件（要改）**：
- `client/src/http/index.ts:11` 删除 `export * from './Segment.service'`
- `client/src/pages/databases/CollectionsTab.tsx:7, 81-87` 删除 import 和 tab 配置
- `client/src/i18n/en/collection.ts:135, 153` 删除 `segmentsTab`、`segments` key
- `client/src/i18n/en/common.ts:51` 删除 `segments` key
- `client/src/i18n/cn/*` 同步删除

**保留**：`CompactDialog.tsx` / `FlushDialog.tsx`（还有别处调用）

**验证**：`yarn build` 通过、进入某 collection 详情页无 Segments tab

#### M2.2 剔除 Playground

**影响文件（要删——24 个）**：
```
client/src/pages/play/**（含 language/、hooks/、extensions/、utils/、Types.ts、Play.tsx、style.tsx 等）
client/src/openapi/**  ← 只服务 Play
```

**影响文件（要改）**：
- `client/src/config/routes.ts:7, 20, 174-186, 254` 删除 Play 相关
- `client/src/http/Milvus.service.ts:46-58` 删除 `request` 静态方法 + `PlaygroundRequestOptions` 类型
- `client/src/consts/Localstorage.ts` 删除 `ATTU_PLAY_CODE`、`ATTU_PLAY_RESULT`、`ATTU_PLAY_FOLD_STATE`
- `client/package.json:69` 删除 `"lezer"` 脚本

**⚠️ 依赖删除警告**（前端扫描明确点出）：
`SearchInputBox.tsx` **也**使用 `@codemirror/state|view|commands|language|lang-javascript|lint|codemirror`，删 Playground 时**只能删这 3 组**：
- `@codemirror/autocomplete`
- `@codemirror/lang-json`
- `@ddietr/codemirror-themes`
- `@lezer/common`、`@lezer/highlight`、`@lezer/generator`

**服务端要删**：
```
server/src/playground/**
server/src/app.ts 中 playgroundRouter import & 路由挂载
```

同时消除 P1-SEC1（SSRF）风险。

**验证**：`yarn build` 通过，`/play` 路由 404 或重定向到 `/`，SearchInputBox 仍工作

#### M2.3 剔除 Electron

**影响文件（要删）**：
```
server/electron-starter.js
server/electron-prebuild.js
server/electron-app/ 目录（build 产物）
server/build 目录里的 electron 图标资源
```

**影响文件（要改）**：
- `server/package.json` 删除 `electron`、`electron-builder`、`electron-store`、`build.*` electron-builder 配置块、`mac`/`linux`/`win`/`electron`/`build-electron` 脚本
- `client/src/http/Axios.ts:5-14` 删除 `hostUrl.electron` / `isElectron` / `url` 判断分支
- `client/src/context/hooks/useWebSocket.ts:3, 40-47` 删除 electron 分支
- `client/src/pages/connect/AuthForm.tsx:27, 394` 删除 Docker 警告条件
- `server/src/utils/Shared.ts` 删除 `isElectron()` 函数（现在恒为 false）
- `server/src/app.ts` 删除 `if (!isElectron())` 判断（LoggingMiddleware 直接挂）
- `Dockerfile:4 ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1` 删除（不再需要）

**验证**：`yarn build` 通过、web 版本连接页面显示正常、Docker 镜像大小明显减小

---

### 3.3 M3 Bug 修复 + 代码精简

按主题分 5-8 个 commit：

**M3.1 修 P0 服务端连接管理（4 bug + 1 死代码）**
- P0-S1、P0-S2、P0-S3、P0-S14 一并修
- 顺带删 D-S2 `throwErrorFromSDK`

**M3.2 修 P0 服务端 LRU / cron / socket 生命周期（3 bug + 1 死代码）**
- P0-S4（in-flight promise 表）、P0-S5（`dispose` 加 close + cron 清理 + max size）、P0-S6（socket disconnect 联动 cron 清理）
- 顺带删 D-S4 `collectionsQueue`

**M3.3 修 P0 服务端 collections + updateMmap + role rollback（5 bug）**
- P0-S8、P0-S9、P0-S10、P0-S11、P0-S13

**M3.4 修 P0 服务端 validation + user privilege group（2 bug）**
- P0-S7、P0-S12

**M3.5 修 P0 客户端 localStorage 读取 + Rules of Hooks（7 bug）**
- P0-C1、P0-C2、P0-C4、P0-C5、P0-C6、P0-C7、P0-C12

**M3.6 修 P0 客户端 useEffect deps + 引用稳定（5 bug + 1 死代码）**
- P0-C3、P0-C8、P0-C9、P0-C10、P0-C11
- 顺带删 P1-C13 CONNECT dead route

**M3.7 抽公共逻辑 + 死代码清理**
- 后端：抽 `asyncHandler` HOF 砍 50+ 处 try/catch 模板
- 后端：删 `events/index.ts`、`assignRolePrivilege/revokeRolePrivilege` 未注册方法、`hasDatabase/hasCollection` 未消费方法
- 后端：`utils/Const.ts` 集中所有魔数（DESCRIPTION_CACHE_MAX、BATCH_SIZE、`x-attu-database` header 名等）
- 前端：删 `PrometheusContextType`、`hooks/Query.ts` 的 TODO 注释、`Grid.tsx:148`/`DataCard.tsx:145`/`Segments.tsx:153` 注释块
- 前端：34 处 `console.*` → 抽 `client/src/utils/logger.ts`（生产静默）
- 前端：抽 `useConfirmDialog(...)` 替换 21 个重复 confirmation dialog

**M3.8 修 P1 安全（4 项 + 内网 IP 清理）**
- ENV-1（DATBASE typo）、ENV-2（内网 IP 移到 `.env.local`）
- P1-SEC2（helmet CSP 收窄）、P1-SEC3（body limit 分路由）、P1-SEC4（`express-rate-limit`）、P1-SEC5（错误消息脱敏）

---

### 3.4 M4 目录重构 + 工程化

**M4.1 启用真正的 yarn workspace**
- 根 `package.json` 加 `"workspaces": ["client", "server"]`
- 上提共享 devDep 到根：`typescript`、`prettier`、`@types/node@^20`、`eslint`、`@typescript-eslint/*`、`eslint-plugin-react-hooks`、`husky`、`lint-staged`、`commitlint`
- 根加 `dev`/`build`/`lint`/`test`/`format` 统一脚本（用 `concurrently` 或 `yarn workspaces run`）
- 删 `server/yarn.lock`，只保留根 lock

**M4.2 ESLint 替换 tslint**
- 卸载 `tslint`、删 `server/tslint.json`、`server/package.json` 的 `prebuild` 改成 `yarn lint`
- 根加 `.eslintrc.cjs`（typescript-eslint + react-hooks + prettier 兼容）
- 前端 `package.json` 删僵尸 `eslintConfig` 字段，加 `"lint": "eslint --ext ts,tsx src"`

**M4.3 tsconfig 收紧**
- server：`target: "ES2022"`、开 `strict`、加 `skipLibCheck`、`forceConsistentCasingInFileNames`、删 `../../src/**/server` 幽灵路径
- client：删 `../../src` 幽灵路径

**M4.4 环境变量 & Docker & CI**
- 新增根 `.env.example` + `client/.env.example`
- `env-config.js` 修 typo、清内网 IP、与 `.env` 同源
- Dockerfile：加 HEALTHCHECK、prune production node_modules、参数化 registry、去 `ENV PORT=80` 死代码
- `docker-compose.yml`：删 `version` 首行、把 `zilliz/attu:v2.4` 换成本仓库构建的 `phigent`、Milvus 升 v2.5.x、MinIO 升近期版
- `.dockerignore` 扩充
- `.gitignore` 重写（分块 deps/build/env/coverage/IDE/logs），修 typo `/clientcoverage`
- 加 `.github/workflows/ci.yml`（node 20，install → lint → test → build）
- 加 `.github/workflows/docker.yml`（main 推送时 build & push）
- 加 husky pre-commit + commit-msg（lint-staged + commitlint 中文 angular 规范）

**M4.5 目录轻度重构**（大改不动，只做补齐）
详见 [§4](#4-新目录结构)

**M4.6 品牌统一**
- `server/package.json: name → "phigent"`、`author`、`repository`、electron 资源名（若还保留则改）
- header `x-attu-database` 与 env `ATTU_LOG_LEVEL` **保留兼容**：新增 `x-phigent-database` / `PHIGENT_LOG_LEVEL`，代码先读新名再回落旧名，写入弃用周期到 CLAUDE.md

**M4.7 依赖升级 & 清理**
- `react-i18next` 15+ 对齐 `i18next` 24
- `web-vitals` 1 → 5，`reportWebVitals` 改用 `onCLS/onINP` 新 API
- `@types/node` client 端 12 → 20
- 删 `remove@^0.1.5`、`@types/chalk`、`@types/react-router-dom`、`@types/lru-cache`
- `import * as d3` 拆子包（P2-C1）
- `Icons.tsx` default record 改具名导出（P2-C4）
- `vite.config.mts` 加 `manualChunks({ mui, codemirror, d3, react-vendor })` + `rollup-plugin-visualizer`
- 路由级 `React.lazy`：至少 DataExplorer、D3PrivilegeTree、GitLabRepos、IndexTree
- `outDir: 'build' → 'dist'`（同步 Dockerfile / .gitignore / env.sh 路径）

---

### 3.5 M5 测试体系（全面覆盖）

**服务端**（`server/src/**/__tests__/`）：
- 框架：`jest` + `supertest` + `@types/jest`（server 已装 jest，补齐）
- Controller 层：每个业务模块（milvus/collections/database/partitions/users/crons）出**冒烟测试** + **错误路径测试**
- Service 层：mock MilvusClient SDK，测业务逻辑（`connectMilvus` race、`useDatabase` 事务、`updateRolePrivileges` rollback 正确性、`count()` 错误分类等）
- Middleware：`ReqHeaderMiddleware` 的 bypass、`dtoValidationMiddleware` 的嵌套错误、`TransformResMiddleware` 的响应格式
- Utils：`Queue`、`Helper` 的边界

**客户端**（`client/src/**/__tests__/`）：
- 框架：`vitest` + `@testing-library/react` + `@testing-library/user-event` + `msw`（mock HTTP）
- Hooks：`useCollectionsManagement`（batch/debounce/race）、`useDatabaseManagement`、`useWebSocket`、`useDialog`
- Context：`AuthProvider` login/logout、`DataProvider` collection 增删推送
- 组件：`AuthForm` 登录流程、`Home` 数据卡片渲染、`IndexTree` 树形渲染、`GitLabRepos` CRUD
- HTTP 层：`BaseModel` 的 `.get/.post/.put/.delete`（M3.7 重构后）、axios 拦截器 unauthorized 自动 logout

**覆盖率目标**：service 层 80%、controller 层 70%、client hooks 70%、client components 冒烟。

M5 因体量大，会分批交付：M5.1 框架搭建 & CI 集成 → M5.2 server milvus & collections 模块 → M5.3 server 剩余 → M5.4 client hooks & context → M5.5 client pages。

---

### 3.6 M6 文档

- 重写 `README.md`（英文 + 中文双份）：项目介绍、环境要求、启动方式（含 workspace `yarn` 一键）、目录说明、开发规范、常见问题
- 重写 `CLAUDE.md`：把过时的项目结构、命令、环境变量表全对齐 M4 后的实际状态
- 补 `docs/development.md`：开发规范（命名/注释/import 顺序/组件文件结构/i18n 规范）
- 补 `docs/architecture.md`：架构决策记录（无状态 API、LRU、cron 轮询设计原理、WebSocket 集成）
- 补 `docs/api.md`：REST API 索引 + DTO 示例
- 补 `docs/deployment.md`：Docker 单机 / 集群部署、TLS 配置、环境变量清单

---

## 4. 新目录结构

**大原则**：保持业务分层不变（不动 Attu 的成熟骨架），只做补齐。

### 4.1 根级

```
PhiGent/
├── .github/
│   └── workflows/
│       ├── ci.yml               # lint + test + build
│       └── docker.yml           # main branch push → image
├── .husky/
│   ├── pre-commit               # lint-staged
│   └── commit-msg               # commitlint
├── docs/
│   ├── architect-review.md      # 本文档
│   ├── architecture.md          # 架构决策记录
│   ├── development.md           # 开发规范
│   ├── api.md                   # API 索引
│   ├── deployment.md            # 部署指南
│   └── todo-optimization.md     # 优化 checklist
├── client/                      # 前端 workspace（详见 §4.2）
├── server/                      # 后端 workspace（详见 §4.3）
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml       # Milvus + etcd + MinIO + PhiGent 完整栈
│   └── docker-compose.dev.yml   # 只启 Milvus 依赖，本地开发用
├── package.json                 # workspaces 声明 + 统一脚本
├── yarn.lock                    # 唯一 lock
├── tsconfig.base.json           # 共享 TS 基线
├── .eslintrc.cjs                # 共享 ESLint 基线
├── .prettierrc                  # 唯一 prettier 配置
├── .editorconfig                # 跨编辑器基线
├── .env.example                 # 环境变量样板
├── .gitignore                   # 分块整理
├── .dockerignore                # 扩充
├── commitlint.config.js         # angular 规范
├── README.md                    # 英文
├── README.zh-CN.md              # 中文
└── LICENSE                      # Apache 2.0（继承 Attu）
```

### 4.2 client/

```
client/
├── src/
│   ├── main.tsx                 # 原 index.tsx 改名（Vite 惯例）
│   ├── App.tsx                  # 已存在
│   ├── vite-env.d.ts
│   │
│   ├── config/                  # 现有
│   │   ├── routes.ts            # 剔除 Play 后
│   │   └── env.ts               # 新增：把 window._env_ 读取集中封装
│   │
│   ├── consts/                  # 现有
│   │   ├── index.ts
│   │   ├── Localstorage.ts      # 清孤儿 key 后
│   │   ├── Milvus.ts
│   │   ├── default.ts
│   │   └── link.ts
│   │
│   ├── types/                   # 现有 + 新增
│   │   ├── index.ts
│   │   ├── SearchTypes.ts
│   │   └── SystemTypes.ts       # 新增：替换 SystemContext.data: any
│   │
│   ├── i18n/                    # 现有
│   │   ├── index.ts
│   │   ├── cn/
│   │   └── en/
│   │
│   ├── styles/                  # 现有
│   │   ├── theme.ts
│   │   └── tokens.ts            # 新增：集中所有硬编码颜色（品牌绿等）
│   │
│   ├── context/                 # 现有；6 层保持，但内部整改
│   │   ├── ColorMode.tsx
│   │   ├── Auth.tsx             # useCallback 化 login/logout
│   │   ├── Data.tsx             # 修 useEffect deps
│   │   ├── Root.tsx             # dialog stack 化（可选）
│   │   ├── System.tsx           # 类型化 data
│   │   ├── Navigation.tsx
│   │   ├── Types.ts             # 删 PrometheusContextType
│   │   └── hooks/               # 现有
│   │       ├── useCollectionsManagement.ts  # 拆 3 个 hook（可选）
│   │       ├── useDatabaseManagement.ts     # 修 deps
│   │       ├── useUIPrefs.ts                # localStorage 加 try/catch
│   │       └── useWebSocket.ts              # 删 electron 分支
│   │
│   ├── http/                    # 现有
│   │   ├── Axios.ts             # 拦截器整改
│   │   ├── BaseModel.ts         # 改 .get/.post/.put/.delete
│   │   ├── Milvus.service.ts    # 删 request()（Playground 用）
│   │   ├── Collection.service.ts
│   │   ├── Database.service.ts
│   │   ├── Partition.service.ts
│   │   ├── User.service.ts
│   │   ├── Data.service.ts
│   │   └── index.ts             # 删注释和 Segment.service 导出
│   │
│   ├── hooks/                   # 现有 + 新增
│   │   ├── Dialog.tsx
│   │   ├── Form.ts
│   │   ├── Navigation.tsx       # setNavInfo 抖动修复
│   │   ├── Pagination.ts
│   │   ├── Query.ts             # 迁 TanStack Query（可选）
│   │   ├── SystemView.tsx       # useInterval 加 visibility 判断
│   │   ├── useConfirmDialog.ts  # 新增：替换 21 处重复
│   │   └── useVisibilityPolling.ts  # 新增：GitLabRepos 用
│   │
│   ├── utils/                   # 现有 + 新增
│   │   ├── Common.ts
│   │   ├── Form.ts
│   │   ├── Format.ts
│   │   ├── Insert.ts
│   │   ├── Metric.ts
│   │   ├── Sort.ts
│   │   ├── Validation.ts
│   │   ├── search.ts
│   │   ├── logger.ts            # 新增：包装 console，生产静默
│   │   └── code/
│   │       └── Py.ts
│   │
│   ├── components/              # 现有；按需 memo 化
│   │   ├── advancedSearch/
│   │   ├── cards/
│   │   ├── customDialog/
│   │   ├── customDrawer/
│   │   ├── customInput/
│   │   ├── customSelector/
│   │   ├── customSnackBar/
│   │   ├── customStepper/
│   │   ├── DataListView/
│   │   ├── DataView/
│   │   ├── grid/
│   │   ├── icons/               # 改具名导出（Icons.tsx 拆分）
│   │   ├── layout/
│   │   ├── MediaPreview/
│   │   ├── menu/
│   │   ├── status/
│   │   └── uploader/
│   │
│   ├── router/                  # 现有
│   │   └── Router.tsx           # 类型化 routes 参数
│   │
│   ├── pages/                   # 剔除 play/、segments/、（可选）electron 支线
│   │   ├── connect/
│   │   ├── databases/
│   │   │   ├── Databases.tsx
│   │   │   ├── DatabasesTab.tsx
│   │   │   ├── CollectionsTab.tsx  # 删 Segments tab
│   │   │   ├── tree/
│   │   │   └── collections/
│   │   │       ├── Collections.tsx
│   │   │       ├── Types.ts
│   │   │       ├── EditableDescription.tsx
│   │   │       ├── data/
│   │   │       ├── partitions/
│   │   │       ├── properties/
│   │   │       ├── schema/         # 修 render body side-effect
│   │   │       └── search/
│   │   ├── dialogs/                # 抽公共模板
│   │   ├── gitlab/                 # 全量 i18n 化
│   │   ├── home/                   # 修 mutate context bug
│   │   ├── index-tree/             # 全量 i18n 化
│   │   ├── system/
│   │   └── user/
│   │
│   └── __tests__/                  # 新增（M5）
│       ├── context/
│       ├── hooks/
│       ├── http/
│       └── components/
│
├── public/
│   ├── .env                        # 与 env-config.js 同源
│   ├── env-config.js               # 清内网 IP、修 typo
│   ├── env.sh                      # 保留
│   └── index.html
│
├── package.json                    # 删 eslintConfig 僵尸；lint/test 脚本
├── tsconfig.json                   # 删幽灵 include
├── vite.config.mts                 # manualChunks + visualizer
├── vitest.config.ts                # M5 落地
└── .prettierrc                     # 删除（走根级）
```

### 4.3 server/

```
server/
├── src/
│   ├── app.ts                      # dispose 加 close + max size
│   ├── socket.ts                   # disconnect 联动 cron 清理
│   ├── index.ts                    # 新增：process.on('uncaughtException'/'unhandledRejection') 有序退出
│   │
│   ├── middleware/                 # 现有 + 新增
│   │   ├── index.ts                # bypassURLs 改 startsWith
│   │   ├── validation.ts           # dto 链加 catch
│   │   ├── asyncHandler.ts         # 新增：抽 HOF 砍 50+ 处样板
│   │   ├── rateLimit.ts            # 新增：/milvus/connect 单独限流
│   │   └── errorHandler.ts         # 新增：脱敏中间层
│   │
│   ├── milvus/                     # 现有；修 P0-S1/2/3/14
│   │   ├── milvus.controller.ts
│   │   └── milvus.service.ts       # in-flight promise 表 + https 正则
│   │
│   ├── collections/                # 现有；修 P0-S8/9/10/11 + N+1
│   │   ├── collections.controller.ts
│   │   ├── collections.service.ts
│   │   └── dto.ts
│   │
│   ├── database/                   # 现有
│   │   ├── databases.controller.ts
│   │   ├── databases.service.ts    # 删 hasDatabase
│   │   └── dto.ts
│   │
│   ├── partitions/                 # 现有
│   │   ├── partitions.controller.ts
│   │   ├── partitions.service.ts
│   │   └── dto.ts
│   │
│   ├── users/                      # 现有；修 P0-S12/13
│   │   ├── users.controller.ts     # 修 rollback 逻辑；补 assign/revoke 路由
│   │   ├── users.service.ts
│   │   └── dto.ts
│   │
│   ├── crons/                      # 现有
│   │   ├── crons.controller.ts
│   │   └── crons.service.ts        # 清注释掉的 log
│   │
│   ├── types/                      # 现有
│   │   ├── index.ts
│   │   ├── collections.type.ts
│   │   └── users.type.ts
│   │
│   ├── utils/                      # 现有 + 整改
│   │   ├── Const.ts                # 集中所有魔数
│   │   ├── Queue.ts                # 若确认无用则删（D-S4）
│   │   ├── Helper.ts               # structuredClone 替换 JSON.parse(JSON.stringify)
│   │   ├── Network.ts
│   │   ├── Shared.ts               # 删 isElectron()
│   │   ├── Logger.ts               # 新增：pino/winston 包装
│   │   └── Sanitize.ts             # 新增：日志脱敏
│   │
│   └── __tests__/                  # 新增（M5）
│       ├── milvus/
│       ├── collections/
│       ├── users/
│       ├── middleware/
│       └── utils/
│
├── package.json                    # name: phigent；卸载 tslint、electron；prestart 改 rimraf
├── tsconfig.json                   # target ES2022、strict、删幽灵
├── jest.config.js                  # M5 落地
├── ---（删除 electron-starter.js、electron-prebuild.js、tslint.json）---
└── ---（删除 playground/ 目录、events/ 目录、utils/Error.ts）---
```

### 4.4 目录分层设计思想

1. **根级**：workspace + 全局工程化（lint / format / commit / CI / docker）
2. **client / server**：业务代码；每个 workspace 有自己的 tsconfig 继承根级 base
3. **config / consts / types**：**元信息层**，无副作用，其他层引用
4. **context / hooks / utils / http**：**基础设施层**（前端），有副作用但纯逻辑
5. **components / pages**：**表现层**（前端），依赖上面所有层
6. **middleware / utils**：**基础设施层**（后端）
7. **milvus / collections / database / partitions / users / crons**：**业务领域层**（后端），每个模块内部 controller/service/dto 三件套
8. **docs**：文档层，与代码分离
9. **docker**：部署产物层，与代码分离

分层原则：**上层可依赖下层，下层不依赖上层，同层横向不相互 import**（例如 `collections` 不 import `users`）。

---

## 5. 改造后的注意事项与后续迭代建议

### 5.1 改造后必须验证的清单（M2-M4 结束时）

- [ ] `docker compose -f docker/docker-compose.yml up -d` 拉起完整栈，`localhost:3000` 能看到 IndexTree/GitLab 定制页
- [ ] `yarn install` 从根一次装齐两个 workspace
- [ ] `yarn lint` 无错、`yarn build` 无警告、`yarn test` 通过（M5 落地后）
- [ ] `yarn dev` 一键起 client + server（`concurrently`）
- [ ] Milvus TLS 场景连接（`https://xxx.zilliz.com:19531`）能成功（P0-S14 修复）
- [ ] 并发连接同一 clientId 不产生泄漏（P0-S4/S5 修复）
- [ ] 网络故障时 `count()` 有明确报错而非 rowCount=0（P0-S9 修复）
- [ ] 权限修改失败不会误删整个角色（P0-S13 修复）
- [ ] 前端 localStorage 被污染时页面能优雅降级不白屏（P0-C4/C5/C6/C7 修复）
- [ ] `/api/v1/unknownXYZ` 返回 JSON 404 而非 SPA HTML

### 5.2 后续迭代建议

1. **鉴权升级**：目前 Milvus 认证是"客户端保管连接凭据"模式，PhiGent 服务端本身无用户体系。若要走生产，建议：
   - 加 PhiGent 自有账户体系（本地用户表 / OIDC / LDAP）
   - Milvus 连接凭据由 PhiGent 后端管理（不再放 localStorage）
   - 统一审计日志
2. **观察性**：接 Prometheus（把死代码 `PrometheusContextType` 变实用）+ Grafana
3. **多租户隔离**：单实例 PhiGent 服务多个 Milvus 集群时，每 clientId 的 LRU 空间应按租户配额
4. **CodeMirror 迁移路径**：如果未来 Search 页也不再需要 CodeMirror，可以整体迁走
5. **前端框架升级**：React 19 + `use` hook + Actions API 有明显改进；建议 M5 完成后单独一轮 M7 升级
6. **Turborepo / Nx**：workspace 之外，如果 monorepo 增长（比如加个 SDK、CLI 工具），考虑上 Turborepo 做增量构建缓存

### 5.3 上游同步策略

- **不再 cherry-pick Attu 主线**：M2 之后已经删掉 Playground / Segments / Electron 大量文件，diff 太大无法机械 pick
- **只关注 Attu 的 P0 修复**：手动 review Attu 的 CHANGELOG，选择性移植 bug fix commit
- **PhiGent 独立发版**：语义化版本；每个 M 完成后 tag 一次（`v0.2.0-m2`、`v0.2.0-m3` 等）

### 5.4 团队协作约定

- **提交规范**：angular 规范中文（feat / fix / chore / refactor / docs / test / build / ci / style / perf / revert）
- **PR 规范**：单 PR ≤ 500 行 diff；跨模块改动拆多个 PR
- **代码 review 规范**：所有 P0/P1 类 issue 必须两人 review

---

**报告结束。下一步等你 review 后决定 M2 起点。**
