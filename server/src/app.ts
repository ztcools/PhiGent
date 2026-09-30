import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as http from 'http';
import * as fs from 'fs';
import { LRUCache } from 'lru-cache';
import * as path from 'path';
import chalk from 'chalk';
import compression from 'compression';
import { router as connectRouter } from './milvus';
import { router as collectionsRouter } from './collections';
import { router as databasesRouter } from './database';
import { router as partitionsRouter } from './partitions';
import { router as cronsRouter } from './crons';
import { router as userRouter } from './users';
import { router as playgroundRouter } from './playground';
import {
  TransformResMiddleware,
  LoggingMiddleware,
  ErrorMiddleware,
  ReqHeaderMiddleware,
} from './middleware';
import { CLIENT_TTL, SimpleQueue, isElectron } from './utils';
import { getIp } from './utils/Network';
import { MilvusClient } from './types';
import { initWebSocket } from './socket';

// 初始化 express 应用
export const app = express();
// 启用 compression 压缩
app.use(compression());

// 初始化缓存存储
export const clientCache = new LRUCache<
  string,
  {
    milvusClient: MilvusClient;
    address: string;
    database: string;
    collectionsQueue: SimpleQueue<string>;
  }
>({
  ttl: CLIENT_TTL,
  ttlAutopurge: true,
});

// 初始化 express 路由
const router = express.Router();
// 注册路由
router.use('/milvus', connectRouter);
router.use('/databases', databasesRouter);
router.use('/collections', collectionsRouter);
router.use('/partitions', partitionsRouter);
router.use('/crons', cronsRouter);
router.use('/users', userRouter);
router.use('/playground', playgroundRouter);
router.get('/healthy', (req, res, next) => {
  res.json({ status: 200 });
  next();
});

// 初始化一个简单的 http 服务
const server = http.createServer(app);

// 设置中间件
// 启用 cors https://expressjs.com/en/resources/middleware/cors.html
app.use(cors());
// 启用 helmet https://github.com/helmetjs/helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
    // HTTP(非 HTTPS)内网部署下 COOP 头会被浏览器忽略并告警,直接关闭。
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  })
);
// 限制 JSON 请求体大小
app.use(express.json({ limit: '256MB' }));
// 响应格式转换拦截器
app.use(TransformResMiddleware);
// 日志拦截器
if (!isElectron()) {
  app.use(LoggingMiddleware);
}
// 请求头统一处理
app.use(ReqHeaderMiddleware);
// 挂载路由
app.use('/api/v1', router);
// 返回前端构建产物。
// 使用绝对路径解析构建后的 SPA：服务端运行在 /app/dist/src，而运行时镜像中前端
// bundle 被复制到 /app/build。相对路径 'build' 会基于进程 CWD 解析（'../build'
// 则相对 dist/src），在容器内会 404。Dockerfile 把产物放在 /app/build；
// 本地开发时回退到基于 CWD 的 'build'。
const clientBuildDir = fs.existsSync('/app/build/index.html')
  ? '/app/build'
  : path.join(process.cwd(), 'build');
app.use(express.static(clientBuildDir));

// 其余所有路由都返回 index.html，其中包含引入
// 应用 JavaScript 文件的 script 标签。
app.get('*', (request, response) => {
  response.sendFile(path.join(clientBuildDir, 'index.html'));
});
// 错误处理拦截器
app.use(ErrorMiddleware);
// 初始化 WebSocket 服务
initWebSocket(server);

// 默认使用 3000 端口，除非已预先配置端口
const PORT = process.env.SERVER_PORT || 3000;

// 启动服务
server.listen(PORT, () => {
  if (!isElectron()) {
    const ips = getIp();
    ips.forEach(ip => {
      console.info(
        chalk.cyanBright(`Attu server started: http://${ip}:${PORT}`)
      );
    });
  }
});
