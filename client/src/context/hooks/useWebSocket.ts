import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { isElectron, url } from '@/http';
import { WS_EVENTS } from '@server/utils/Const';

interface UseWebSocketProps {
  isAuth: boolean;
  clientId: string;
  database: string;
  onCollectionUpdate: (data: any) => void; // 如有可能，请定义更精确的类型
}

export const useWebSocket = ({
  isAuth,
  clientId,
  database, // 新增 database 依赖
  onCollectionUpdate,
}: UseWebSocketProps) => {
  const socket = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const clearSocket = () => {
      setConnected(false);
      socket.current?.offAny();
      socket.current?.disconnect();
      socket.current = null;
    };

    if (isAuth && clientId) {
      const extraHeaders = {
        'milvus-client-id': clientId,
      };

      // 创建新连接前先确保旧连接已清理
      if (socket.current) {
        clearSocket();
      }

      // Electron 下使用默认配置，Web 下使用 path 配置
      socket.current = isElectron
        ? io(url as string, { extraHeaders, query: extraHeaders })
        : io(url as string, {
            extraHeaders,
            query: extraHeaders,
            path: '/socket.io', // 为代理场景补充 path 配置
          });

      socket.current.on('connect', () => {
        // console.info('--- ws connected ---', clientId);
        setConnected(true);
      });

      socket.current.on('disconnect', () => {
        // console.info('--- ws disconnected ---');
        setConnected(false);
      });

      socket.current.on('error', error => {
        console.error('WebSocket error:', error);
        clearSocket(); // 出错时同样需要清理
      });
    } else {
      clearSocket();
    }

    // isAuth 或 clientId 变化时的清理函数
    return () => {
      clearSocket();
    };
  }, [isAuth, clientId]); // 此处已移除 database 依赖，连接仅依赖 auth/client

  useEffect(() => {
    if (connected && socket.current) {
      // 添加新监听前先移除旧监听
      socket.current.off(WS_EVENTS.COLLECTION_UPDATE, onCollectionUpdate);
      // 监听后端的 Collection 事件
      socket.current.on(WS_EVENTS.COLLECTION_UPDATE, onCollectionUpdate);
    }

    // 连接状态或回调变化时清理监听
    return () => {
      socket.current?.off(WS_EVENTS.COLLECTION_UPDATE, onCollectionUpdate);
    };
    // 若监听逻辑依赖 database，可在此加入；但当前 onCollectionUpdate
    // 由 DataProvider 传入，而它已经依赖 database
  }, [connected, onCollectionUpdate]);

  return { connected };
};
