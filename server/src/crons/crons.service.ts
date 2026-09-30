import { schedule, ScheduledTask } from 'node-cron';
import { CollectionsService } from '../collections/collections.service';
import {
  WS_EVENTS,
  WS_EVENTS_TYPE,
  checkLoading,
  checkIndexing,
} from '../utils';
import { clients } from '../socket';
import { CronJobObject } from '../types';
interface CronJob {
  id: string;
  clientId: string; // Milvus 的 milvusClientId
  task: ScheduledTask;
  data: CronJobObject;
}
import { clientCache } from '../app';

const getId = (clientId: string, data: CronJobObject) => {
  return `${clientId}/${data.name}/${
    data.payload.database
  }/[${data.payload.collections.join('/')}]`;
};

export class CronsService {
  constructor(
    private collectionService: CollectionsService,
    private schedulerRegistry: SchedulerRegistry
  ) {}

  async toggleCronJobByName(clientId: string, data: CronJobObject) {
    const { name, type } = data;

    // 定义 cronJob
    const cronJob: CronJob = this.schedulerRegistry.getCronJob(clientId, data);

    // type 为 stop 时停止 cronJob
    if (cronJob && type === WS_EVENTS_TYPE.STOP) {
      return this.schedulerRegistry.deleteCronJob(clientId, data);
    }

    // 按不同事件分支处理
    switch (name) {
      // collection 加载、索引构建、更新
      case WS_EVENTS.COLLECTION_UPDATE:
        if (type === WS_EVENTS_TYPE.START && !cronJob) {
          return this.execCollectionUpdateTask(clientId, data);
        }
        break;

      default:
        throw new Error('Unsupported event type');
    }
  }

  async execCollectionUpdateTask(clientId: string, data: CronJobObject) {
    console.log('execCollectionUpdateTask', clientId, data);
    const task = async () => {
      const currentJob: CronJob = this.schedulerRegistry.getCronJob(
        clientId,
        data
      );

      // 若 currentJob 不存在
      if (!currentJob) {
        // 客户端未连接，停止 cron
        this.schedulerRegistry.deleteCronJob(clientId, data);
        return;
      }

      if (!clientCache.has(clientId)) {
        // 客户端未连接，停止 cron
        this.schedulerRegistry.deleteCronJob(clientId, data);
        console.info('Client is not connected, stop cron.', clientId);
        return;
      }

      try {
        // 获取客户端缓存数据
        const { milvusClient } = clientCache.get(clientId);
        const currentDatabase = (milvusClient as any).metadata.get('dbname');

        // 若 database 不匹配则直接返回
        if (currentDatabase !== data.payload.database) {
          // 客户端未连接，停止 cron
          this.schedulerRegistry.deleteCronJob(clientId, data);
          console.info('Database is not matched, stop cron.', clientId);
          return;
        }

        const collections = await this.collectionService.getAllCollections(
          currentJob.clientId,
          currentJob.data.payload.collections,
          currentJob.data.payload.database
        );
        // 获取当前 socket
        const socketClient = clients.get(currentJob.clientId);

        if (socketClient) {
          // 向当前客户端推送事件，加载和索引构建事件统一视为 collection 更新
          socketClient.emit(WS_EVENTS.COLLECTION_UPDATE, {
            collections,
            database: currentJob.data.payload.database,
          });

          // 所有 collection 都已加载完成时停止 cron
          const LoadingOrBuildingCollections = collections.filter(v => {
            const isLoading = checkLoading(v);
            const isBuildingIndex = checkIndexing(v);

            return isLoading || isBuildingIndex;
          });

          if (LoadingOrBuildingCollections.length === 0) {
            this.schedulerRegistry.deleteCronJob(clientId, data);
          }
        }
      } catch (error) {
        if (error.message.includes('pool is draining')) {
          // 处理连接池关闭错误，记录日志并避免重试
          console.error(
            'The pool is shutting down and cannot accept new work.'
          );
          this.schedulerRegistry.deleteCronJob(clientId, data);
          return;
        }

        // 用户未连接 Milvus 时停止 cron
        this.schedulerRegistry.deleteCronJob(clientId, data);

        throw new Error(error);
      }
    };
    // 每 5 秒执行一次
    this.schedulerRegistry.setCronJob(clientId, '*/5 * * * * *', task, data);
  }
}

export class SchedulerRegistry {
  constructor(private cronJobMap: Map<string, CronJob>) {}

  getCronJob(clientId: string, data: CronJobObject) {
    const targetId = getId(clientId, data);

    const target = this.cronJobMap.get(targetId);
    return target;
  }

  deleteCronJob(clientId: string, data: CronJobObject) {
    const targetId = getId(clientId, data);

    if (this.cronJobMap.has(targetId)) {
      this.cronJobMap.get(targetId)?.task?.stop();
      this.cronJobMap.delete(targetId);
    }

  }

  deleteAllCronJobs(clientId: string) {
    // console.log('Deleting all cron jobs in service for client:', clientId);
    this.cronJobMap.forEach((v, k) => {
      if (v.clientId === clientId) {
        v.task.stop();
        this.cronJobMap.delete(k);
      }
    });
  }

  // ┌────────────── 秒（可选）
  // │ ┌──────────── 分钟
  // │ │ ┌────────── 小时
  // │ │ │ ┌──────── 日
  // │ │ │ │ ┌────── 月
  // │ │ │ │ │ ┌──── 星期
  // │ │ │ │ │ │
  // │ │ │ │ │ │
  // * * * * * *
  // https://www.npmjs.com/package/node-cron
  setCronJob(
    clientId: string,
    cronExpression: string,
    func: () => void,
    data: CronJobObject
  ) {
    const target = this.getCronJob(clientId, data);

    if (target) {
      target?.task?.stop();
    } else {
      // 生成任务 id
      const id = getId(clientId, data);

      if (!this.cronJobMap.has(id)) {
        console.log('create task:', id);
        // 创建任务
        const task = schedule(cronExpression, () => {
          console.log(
            `[cronExpression:${cronExpression}] ${data.name} ${id}: running a task.`
          );
          func();
        });

        // 保存任务
        this.cronJobMap.set(id, {
          id,
          clientId,
          task,
          data,
        });
      }
    }
  }
}
