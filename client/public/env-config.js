// 本地开发配置（Vite dev server 加载此文件）。
// 生产部署时不走这个文件：Docker 容器用 env.sh 从 build/.env 动态生成 build/env-config.js。
window._env_ = {
  MILVUS_URL: '127.0.0.1:19530',
  HOST_URL: '',
  DATABASE: 'default',
  MILVUS_SERVERS: '',
  GIT_INDEX_HOST: '',
};
