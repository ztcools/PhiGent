import { defineConfig } from 'vite';
import * as path from 'path';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

// https://vitejs.dev/config/
export default defineConfig({
  base: '',
  // 将输出目录从 dist 改为 build
  // 若对当前项目不适用，请注释掉此项
  build: {
    outDir: 'build',
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  optimizeDeps: {
    include: ['@emotion/react', '@emotion/styled'],
  },
  plugins: [
    react(),
    svgr({
      // 一个 minimatch 模式或模式数组，指定插件在构建中应包含的文件。
      include: '**/*.svg?react',

      //  一个 minimatch 模式或模式数组，指定插件在构建中应忽略的文件。默认不忽略任何文件。
      exclude: '',
    }),
  ],
  resolve: {
    // extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 注意不要把 server 模块包含进 client
      '@server': path.resolve(__dirname, './../server/src'),
    },
  },
});
