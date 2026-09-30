import {
  CreateDatabaseRequest,
  ListDatabasesRequest,
  DescribeDatabaseRequest,
  DescribeDatabaseResponse,
  DropDatabasesRequest,
  AlterDatabaseRequest,
} from '@zilliz/milvus2-sdk-node';
import { clientCache } from '../app';
import { DatabaseObject } from '../types';
import { SimpleQueue } from '../utils';

export class DatabasesService {
  async createDatabase(clientId: string, data: CreateDatabaseRequest) {
    const { milvusClient } = clientCache.get(clientId);

    const res = await milvusClient.createDatabase(data);
    return res;
  }

  async describeDatabase(clientId: string, data: DescribeDatabaseRequest) {
    const { milvusClient } = clientCache.get(clientId);

    const res = await milvusClient.describeDatabase(data);
    return res as DescribeDatabaseResponse;
  }

  async listDatabase(
    clientId: string,
    data?: ListDatabasesRequest
  ): Promise<DatabaseObject[]> {
    const { milvusClient, database } = clientCache.get(clientId);

    const res = await milvusClient.listDatabases(data);

    // 测试用户是否有权限访问该 Database，遍历所有 Database
    // 并检查用户是否具备访问该 Database 的权限
    const availableDatabases: DatabaseObject[] = [];

    for (let i = 0; i < res.db_names.length; i++) {
      try {
        await milvusClient.use({ db_name: res.db_names[i] });
        await milvusClient.listDatabases(data);
        const collections = await milvusClient.showCollections();

        const dbName = res.db_names[i];

        let dbObject = {} as DescribeDatabaseResponse;
        try {
          dbObject = await this.describeDatabase(clientId, {
            db_name: dbName,
          });
        } catch (e) {
          // 忽略
          console.warn('error', e.details);
        }

        availableDatabases.push({
          name: res.db_names[i],
          collections: collections.data.map(c => c.name),
          createdTime: (res as any).created_timestamp[i] || -1,
          ...dbObject,
        });
      } catch (e) {
        // 忽略
        console.warn('error', e.details);
      }
    }

    // 恢复当前 Database
    await milvusClient.use({ db_name: database });

    return availableDatabases;
  }

  async dropDatabase(clientId: string, data: DropDatabasesRequest) {
    const { milvusClient } = clientCache.get(clientId);

    const res = await milvusClient.dropDatabase(data);
    return res;
  }

  async use(clientId: string, db_name: string) {
    const currentClient = clientCache.get(clientId);

    // 切换 Database 时清空 collectionsQueue
    currentClient.collectionsQueue.stop();
    currentClient.collectionsQueue = new SimpleQueue<string>();

    return await await currentClient.milvusClient.use({ db_name });
  }

  async hasDatabase(clientId: string, data: string) {
    const dbs = await this.listDatabase(clientId);
    return dbs.map(d => d.name).indexOf(data) !== -1;
  }

  async alterDatabase(clientId: string, data: AlterDatabaseRequest) {
    const { milvusClient } = clientCache.get(clientId);

    const res = await milvusClient.alterDatabase(data);
    return res;
  }
}
