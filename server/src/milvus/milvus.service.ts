import {
  MilvusClient,
  FlushReq,
  GetMetricsResponse,
  ClientConfig,
  CONNECT_STATUS,
} from '@zilliz/milvus2-sdk-node';
import { DEFAULT_MILVUS_PORT, HTTP_STATUS_CODE } from '../utils';
import { clientCache } from '../app';
import { AuthReq, AuthObject } from '../types';
import { cronsManager } from '../crons';
import HttpErrors from 'http-errors';

const connectingClients = new Map<string, Promise<AuthObject>>();

export class MilvusService {
  private DEFAULT_DATABASE = 'default';

  get sdkInfo() {
    return MilvusClient.sdkInfo;
  }

  static formatAddress(address: string) {
    // 支持用户输入 http/https 前缀，Milvus SDK 只需要 host:port。
    const host = address.trim().replace(/^https?:\/\//i, '');
    const hasPort = /:\d+$/.test(host);
    return hasPort ? host : `${host}:${DEFAULT_MILVUS_PORT}`;
  }

  async connectMilvus(data: AuthReq): Promise<AuthObject> {
    const existingConnect = connectingClients.get(data.clientId);
    if (existingConnect) {
      return existingConnect;
    }

    const connectPromise = this.doConnectMilvus(data).finally(() => {
      connectingClients.delete(data.clientId);
    });
    connectingClients.set(data.clientId, connectPromise);
    return connectPromise;
  }

  private async doConnectMilvus(data: AuthReq): Promise<AuthObject> {
    // 从 data 中解构出连接所需的信息
    const {
      address,
      token,
      username,
      password,
      ssl,
      database,
      checkHealth,
      clientId,
    } = data;
    // 格式化地址，去掉 http 前缀
    const milvusAddress = MilvusService.formatAddress(address);

    // client 已存在时，先校验连接再返回
    if (clientCache.has(clientId)) {
      const cache = clientCache.get(clientId);
      try {
        // 校验缓存的 client 是否仍然连接且健康
        if (checkHealth) {
          const healthRes = await cache.milvusClient.checkHealth();
          if (!healthRes.isHealthy) {
            // 从缓存中移除不健康的 client
            clientCache.delete(clientId);
            throw new Error('Cached client is not healthy');
          }
        }

        return {
          clientId: cache.milvusClient.clientId,
          database: cache.database,
        };
      } catch (error) {
        // 缓存的 client 校验失败时先移除它，再继续创建新连接
        clientCache.delete(clientId);
        console.warn(`Cached client validation failed for ${clientId}, creating new connection`);
      }
    }

    try {
      // 使用传入的连接信息创建一个新的 Milvus client
      const clientConfig: ClientConfig = {
        address: milvusAddress,
        token,
        username,
        password,
        ssl,
        logLevel: process.env.ATTU_LOG_LEVEL || 'info',
        database: database || this.DEFAULT_DATABASE,
        id: clientId,
        pool: {
          max: 10,
        },
      };

      if (process.env.ROOT_CERT_PATH) {
        clientConfig.tls = {
          rootCertPath: process.env.ROOT_CERT_PATH,
        };

        if (process.env.PRIVATE_KEY_PATH) {
          clientConfig.tls.privateKeyPath = process.env.PRIVATE_KEY_PATH;
        }

        if (process.env.CERT_CHAIN_PATH) {
          clientConfig.tls.certChainPath = process.env.CERT_CHAIN_PATH;
        }

        if (process.env.SERVER_NAME) {
          clientConfig.tls.serverName = process.env.SERVER_NAME;
        }
      }
      // 创建 client
      const milvusClient: MilvusClient = new MilvusClient(clientConfig);

      try {
        // 尝试连接 Milvus 服务
        await milvusClient.connectPromise;
      } catch (error) {
        // 连接失败时清理缓存并抛出错误
        clientCache.delete(milvusClient.clientId);
        throw HttpErrors(HTTP_STATUS_CODE.UNAUTHORIZED, error);
      }

      // 检查 Milvus 服务的健康状态
      if (checkHealth) {
        const res = await milvusClient.checkHealth();

        // 服务不健康时抛出错误
        if (!res.isHealthy) {
          clientCache.delete(milvusClient.clientId);
          throw new Error('Milvus is not ready yet.');
        }
      }

      // 目标 Database
      const db = database || this.DEFAULT_DATABASE;

      // 服务健康时记录地址并把 client 写入缓存
      clientCache.set(milvusClient.clientId, {
        milvusClient,
        address,
        database: db,
      });

      // 测试 ListDatabases 权限
      try {
        await milvusClient.use({ db_name: db });
        await milvusClient.listDatabases();
      } catch (e) {
        // 权限不足时确保资源被正确清理
        await milvusClient.closeConnection();
        clientCache.delete(milvusClient.clientId);
        throw HttpErrors(
          HTTP_STATUS_CODE.FORBIDDEN,
          `You don't have permission to access the database: ${db}.`
        );
      }

      await milvusClient.use({ db_name: db });

      // 返回地址与 Database（存在则返回它，否则返回 'default'）
      return {
        clientId: milvusClient.clientId,
        database: db,
      };
    } catch (error) {
      throw error;
    }
  }

  async flush(clientId: string, data: FlushReq) {
    const { milvusClient } = clientCache.get(clientId);

    const res = await milvusClient.flush(data);
    return res;
  }

  async getMetrics(clientId: string): Promise<GetMetricsResponse> {
    const { milvusClient } = clientCache.get(clientId);

    const res = await milvusClient.getMetric({
      request: { metric_type: 'system_info' },
    });
    return res;
  }

  async closeConnection(clientId: string): Promise<CONNECT_STATUS> {
    if (clientCache.has(clientId)) {
      const { milvusClient } = clientCache.get(clientId);

      const res = await milvusClient.closeConnection();

      // 清理定时任务
      cronsManager.deleteCronJob(clientId);

      // 断开连接时清理缓存
      clientCache.delete(milvusClient.clientId);
      return res;
    }
  }

  async useDatabase(clientId: string, db: string) {
    const { milvusClient } = clientCache.get(clientId);

    // 从缓存中获取 Database
    const cache = clientCache.get(clientId);
    const currentDatabase = cache.database;

    if (currentDatabase !== db) {
      // 切换 Database，只有 SDK 调用成功后才更新本地缓存。
      const res = await milvusClient.use({
        db_name: db,
      });

      // 清理定时任务
      cronsManager.deleteCronJob(clientId);

      // 更新缓存中的 Database
      cache.database = db;
      return res;
    }
  }
}
