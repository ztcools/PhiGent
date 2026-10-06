// socket.ts
import { Server, Socket } from 'socket.io';
import * as http from 'http';
import chalk from 'chalk';

export let io: Server;
export let clients = new Map<string, Socket>();

export const logWebSocketRequest = (
  socket: Socket,
  event: string,
  message?: any,
  direction: 'in' | 'out' = 'in'
) => {
  const clientId = socket.handshake.query['milvus-client-id'] as string;
  const remoteAddress =
    socket.handshake.address === '::1' ? '127.0.0.1' : socket.handshake.address;
  const timestamp = new Date().toLocaleTimeString();
  const directionLabel = direction === 'in' ? '←' : '→';
  const mes =
    process.env.ATTU_LOG_LEVEL === 'debug'
      ? JSON.stringify(message)
      : message
        ? JSON.stringify(message).length
        : '';

  const logMessage = [
    chalk.blue.bold('WS'),
    chalk.magenta.bold(event),
    chalk.green.bold(`Client: ${clientId}`),
    chalk.yellow(remoteAddress),
    chalk.gray(`@ ${timestamp}`),
    direction === 'in'
      ? chalk.cyan(directionLabel)
      : chalk.magenta(directionLabel),
    message ? chalk.white(mes) : '',
  ]
    .filter(Boolean)
    .join(' ');

  console.log(logMessage);
};

export const initWebSocket = (server: http.Server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    const clientId = socket.handshake.query['milvus-client-id'] as string;

    if (clientId) {
      clients.set(clientId, socket);

      // 记录连接事件
      logWebSocketRequest(socket, 'CONNECT');

      socket.on('disconnect', () => {
        // 记录断开连接事件
        logWebSocketRequest(socket, 'DISCONNECT');
        clients.delete(clientId);
      });

      socket.on('error', (error: Error) => {
        // 记录错误事件
        logWebSocketRequest(socket, 'error', error.message);
      });

      // 记录自定义事件
      socket.onAny((event, ...args) => {
        logWebSocketRequest(socket, event, args);
      });
    }
  });

  io.use((socket, next) => {
    const originalEmit = socket.emit;
    // 将赋值的函数转换为箭头函数
    socket.emit = (event: string, ...args: any[]) => {
      logWebSocketRequest(socket, event, args, 'out');
      // 使用 .apply() 绑定正确的上下文（socket）
      return originalEmit.apply(socket, [event, ...args]);
    };
    next();
  });

  // 处理服务端级别的错误
  io.on('error', (error: Error) => {
    console.error(chalk.red(`ws server error: ${error.message}`));
  });
};
