# PhiGent 优化 · 待办 Checklist

> 与 [`architect-review.md`](./architect-review.md) 配套使用。
> 在每一项前打勾（`[x]`）表示**接受**；打 `[~]` 表示**延后**；打 `[-]` 表示**跳过**。
> Review 完这份文档后交给架构师执行。

---

## M2 · 剔除三大模块

### M2.1 Segments 页面
- [ ] 删除 `client/src/pages/databases/collections/segments/**`
- [ ] 删除 `client/src/http/Segment.service.ts` 及 `http/index.ts` 导出
- [ ] 删除 `CollectionsTab.tsx` 的 Segments tab
- [ ] 清理 i18n 里的 `segments`、`segmentsTab` key（中英双份）

### M2.2 Playground
- [ ] 删除 `client/src/pages/play/**`
- [ ] 删除 `client/src/openapi/**`
- [ ] 删除 `server/src/playground/**`（同时消除 P1-SEC1 SSRF）
- [ ] `routes.ts` 删除 Play 路由
- [ ] `Milvus.service.ts` 删除 `request()` 静态方法
- [ ] `consts/Localstorage.ts` 删除 `ATTU_PLAY_CODE/RESULT/FOLD_STATE`
- [ ] `package.json` 删除 `lezer` 脚本
- [ ] **仅**删除 3 组 codemirror 依赖：`@codemirror/autocomplete`、`@codemirror/lang-json`、`@ddietr/codemirror-themes`、`@lezer/*`
- [ ] **保留** `@codemirror/state|view|commands|language|lang-javascript|lint|codemirror`（SearchInputBox 用）

### M2.3 Electron
- [ ] 删除 `server/electron-starter.js`、`electron-prebuild.js`
- [ ] `server/package.json` 删除 `electron*` 三包 + electron-builder 配置块 + `mac/linux/win/electron/build-electron` 脚本
- [ ] `client/src/http/Axios.ts` 删除 electron 分支
- [ ] `client/src/context/hooks/useWebSocket.ts` 删除 electron 分支
- [ ] `AuthForm.tsx` 删除 Docker 警告条件
- [ ] `server/src/utils/Shared.ts` 删除 `isElectron()`
- [ ] `Dockerfile` 删除 `ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1`

---

## M3 · Bug 修复 + 代码精简

### P0 服务端（14）
- [ ] **P0-S1** `milvus.controller.ts:109` closeConnection 未 await
- [ ] **P0-S2** `milvus.service.ts:198` useDatabase 未 await + cache 已改
- [ ] **P0-S3** `milvus.service.ts:167` getMetrics 未 await
- [ ] **P0-S4** `milvus.service.ts:43` 连接缓存 race → 加 in-flight promise 表
- [ ] **P0-S5** `app.ts:34` LRU dispose 加 close + max size
- [ ] **P0-S6** `socket.ts:65` disconnect 联动 cron 清理
- [ ] **P0-S7** `middleware/validation.ts:19` promise 链加 catch
- [ ] **P0-S8** `collections.service.ts:657` count 未 await
- [ ] **P0-S9** `collections.service.ts:278` count 错误分类
- [ ] **P0-S10** `collections.controller.ts:682` updateMmap 混用 await
- [ ] **P0-S11** `collections.controller.ts:713` updateMmap return 未发送
- [ ] **P0-S12** `users.controller.ts:604` updatePrivilegeGrp try 块外 await
- [ ] **P0-S13** `users.controller.ts:462` updateRolePrivileges 误滚 + 误删
- [ ] **P0-S14** `milvus.service.ts:21` formatAddress 不识别 https

### P0 客户端（12）
- [ ] **P0-C1** `CollectionData.tsx:31` 违反 Rules of Hooks
- [ ] **P0-C2** `Schema.tsx:62` render body 里 side-effect fetch
- [ ] **P0-C3** `Home.tsx:275` mutate context state
- [ ] **P0-C4** `Play.tsx:43` JSON.parse 无 try/catch **（M2.2 剔除后自动消失）**
- [ ] **P0-C5** `AuthForm.tsx:198,264,315` JSON.parse 无 try/catch
- [ ] **P0-C6** `ColorMode.tsx:21` + `useUIPrefs.ts:20` localStorage render body
- [ ] **P0-C7** `Auth.tsx:38` render body 读 localStorage
- [ ] **P0-C8** `useDatabaseManagement.ts:51` effect deps 含 authReq
- [ ] **P0-C9** `Data.tsx:65` useEffect 缺 deps
- [ ] **P0-C10** `Root.tsx:83` logout setDialog 拿旧闭包
- [ ] **P0-C11** `Auth.tsx:90` login/logout 未 useCallback
- [ ] **P0-C12** `Segments.tsx:28` loading 卡 true **（M2.1 剔除后自动消失）**

### 代码精简 & 死代码清理
- [ ] 抽 `asyncHandler` HOF 砍 50+ 处 try/catch
- [ ] 抽 `useConfirmDialog(...)` 替换 21 处重复 dialog
- [ ] 抽 `client/src/utils/logger.ts` 包装 34 处 console.*
- [ ] 删 `server/src/events/index.ts`
- [ ] 删 `server/src/utils/Error.ts`
- [ ] 删 `assignRolePrivilege` / `revokeRolePrivilege`（无路由）
- [ ] 删 `hasDatabase` / `hasCollection`（无引用）
- [ ] 删 `collectionsQueue`（无消费）
- [ ] 删 `PrometheusContextType`
- [ ] 删 `CONNECT` dead route
- [ ] 删 `Icons.tsx` 的 default record → 具名导出
- [ ] 集中魔数到 `utils/Const.ts`

### P1 安全
- [ ] **ENV-1** 修 `DATBASE` typo
- [ ] **ENV-2** 内网 IP 移到 `.env.local`
- [ ] **P1-SEC2** helmet CSP 收窄
- [ ] **P1-SEC3** body limit 分路由（默认 5MB，insert/importSample 单独 256MB）
- [ ] **P1-SEC4** 加 `express-rate-limit`
- [ ] **P1-SEC5** 错误消息脱敏（不吐 gRPC metadata）
- [ ] **P1-SEC6** `bypassURLs` 改 startsWith，clientId 加长度限制

### P1 架构（可选，工作量大，建议延后）
- [~] **P1-C1** 合并 Auth/Data/System → SessionProvider
- [~] **P1-C4** dialog stack 化
- [~] **P1-C6** BaseModel 改 `.get/.post/.put/.delete`
- [~] **P1-C10** 拆 useCollectionsManagement 为 3 个 hook
- [~] **P1-C12** hooks/Query.ts 迁 TanStack Query

### P1 UX
- [ ] **P1-UX2** IndexTree section 加骨架/空态
- [ ] **P1-UX3** Dialog 关闭时重置 params 再关
- [ ] **P1-UX4** 提交按钮 loading disable
- [ ] **P1-UX6** GitLabRepos 加 visibility 判断
- [~] **P1-UX5** 大表格虚拟滚动（工作量大）

---

## M4 · 工程化 & 目录重构

### 依赖 / 构建
- [ ] 启用 `workspaces: ["client", "server"]`
- [ ] 上提共享 devDep 到根
- [ ] 根加 `dev/build/lint/test/format` 脚本（concurrently）
- [ ] 删 `server/yarn.lock`（只保留根 lock）
- [ ] 删 `tslint` + `tslint.json`
- [ ] 装 `eslint` + `@typescript-eslint` + `eslint-plugin-react-hooks`
- [ ] 根加 `.eslintrc.cjs`
- [ ] 前端 `package.json` 删僵尸 `eslintConfig`
- [ ] server tsconfig target ES2022 + strict
- [ ] 删两个 tsconfig 的幽灵 include
- [ ] vite.config manualChunks + rollup-plugin-visualizer
- [ ] `outDir: 'build' → 'dist'`（+ Dockerfile / .gitignore / env.sh 同步）
- [ ] 路由级 React.lazy: DataExplorer / D3PrivilegeTree / GitLabRepos / IndexTree

### 依赖升级 / 清理
- [ ] `react-i18next` 对齐 i18next 24
- [ ] `web-vitals` 1 → 5，改 reportWebVitals 新 API
- [ ] `@types/node` client 12 → 20
- [ ] `typescript` / `prettier` 版本对齐
- [ ] 删 `remove@^0.1.5`
- [ ] 删冗余 `@types/chalk`、`@types/react-router-dom`、`@types/lru-cache`
- [ ] `d3` 拆子包
- [~] `react` 18 → 19（延后单独 M7）
- [~] `express` 4 → 5（延后）

### Lint / Format
- [ ] 合并 `.prettierrc` 到根
- [ ] 加 `.editorconfig`
- [ ] 加 husky + lint-staged
- [ ] 加 commitlint（中文 angular 规范）

### 环境 / Docker / CI
- [ ] 加 `.env.example`（根 + client）
- [ ] 修 `env-config.js` 的 typo 与内网 IP
- [ ] `.gitignore` 分块重写，修 `/clientcoverage` typo
- [ ] `.dockerignore` 扩充
- [ ] Dockerfile：加 HEALTHCHECK、prune production、参数化 registry
- [ ] docker-compose：删首行 version、把 `zilliz/attu:v2.4` 换成本地构建、升 Milvus/MinIO 版本
- [ ] 加 `.github/workflows/ci.yml`（lint+test+build）
- [ ] 加 `.github/workflows/docker.yml`

### 品牌统一
- [ ] `server/package.json name: "phigent"`
- [ ] header 加 `x-phigent-database` 别名，保留 `x-attu-database` 回落
- [ ] env 加 `PHIGENT_LOG_LEVEL` 别名，保留 `ATTU_LOG_LEVEL` 回落
- [ ] i18n storage key `attu.ui.lang` 加 phigent 别名

---

## M5 · 测试体系（全面覆盖）

### M5.1 框架搭建
- [ ] server：`jest.config.js` + `supertest` + `@types/jest`
- [ ] client：`vitest.config.ts` + `@testing-library/react` + `msw`
- [ ] CI 集成两个测试脚本

### M5.2 server milvus & collections
- [ ] milvus.service：connectMilvus race / useDatabase 事务
- [ ] collections.service：count 错误分类 / N+1 修复验证
- [ ] middleware：ReqHeaderMiddleware / validation / TransformRes

### M5.3 server 剩余
- [ ] users.service：updateRolePrivileges 正确 rollback
- [ ] database / partitions / crons

### M5.4 client hooks & context
- [ ] useCollectionsManagement / useDatabaseManagement / useWebSocket
- [ ] AuthProvider login/logout / DataProvider 增删推送

### M5.5 client pages
- [ ] AuthForm / Home / IndexTree / GitLabRepos 冒烟

**覆盖率目标**：service 80% / controller 70% / client hooks 70% / client components 冒烟

---

## M6 · 文档

- [ ] 重写 `README.md`（英文）
- [ ] 新增 `README.zh-CN.md`（中文）
- [ ] 更新 `CLAUDE.md` 对齐 M4 后的实际状态
- [ ] 新增 `docs/development.md`
- [ ] 新增 `docs/architecture.md`
- [ ] 新增 `docs/api.md`
- [ ] 新增 `docs/deployment.md`

---

## Review 说明

- 若你**接受全部默认**，直接告诉我"按方案开始 M2"，我从 M2.1 起顺序执行。
- 若你想跳过某些条目，用 `[-]` 标记后告诉我 "已 review，请开始 M2"。
- 若某些 P1 你想提前做，把它移入 M3 分组即可。
