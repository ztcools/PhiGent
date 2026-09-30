import {
  CreateCollectionReq,
  DescribeCollectionReq,
  DropCollectionReq,
  GetCollectionStatisticsReq,
  InsertReq,
  LoadCollectionReq,
  ReleaseLoadCollectionReq,
  RenameCollectionReq,
  AlterAliasReq,
  CreateAliasReq,
  ShowCollectionsReq,
  ShowCollectionsType,
  DeleteEntitiesReq,
  GetCompactionStateReq,
  GetQuerySegmentInfoReq,
  GePersistentSegmentInfoReq,
  CompactReq,
  HasCollectionReq,
  CountReq,
  GetLoadStateReq,
  CollectionData,
  CreateIndexReq,
  DescribeIndexReq,
  DropIndexReq,
  AlterCollectionReq,
  DataType,
  HybridSearchReq,
  SearchSimpleReq,
  LoadState,
  AlterCollectionFieldPropertiesReq,
  AlterIndexReq,
  ErrorCode,
} from '@zilliz/milvus2-sdk-node';
import { Parser } from '@json2csv/plainjs';
import {
  findKeyValue,
  getKeyValueListFromJsonString,
  genRows,
  ROW_COUNT,
  convertFieldSchemaToFieldType,
  LOADING_STATE,
  DYNAMIC_FIELD,
  MIN_INT64,
  VectorTypes,
  cloneObj,
} from '../utils';
import { QueryDto, ImportSampleDto } from './dto';
import {
  CollectionObject,
  CollectionLazyObject,
  FieldObject,
  IndexObject,
  DescribeCollectionRes,
  CountObject,
  StatisticsObject,
  CollectionFullObject,
  DescribeIndexRes,
} from '../types';
import { clientCache } from '../app';
import { clients } from '../socket';
import { WS_EVENTS } from '../utils';

/**
 * CollectionsService.fillDescriptions 使用的缓存。key 为 name + collectionID，
 * 这样删除后重建的 Collection 会 cache miss 而不是返回过期的 description；
 * 由此 entry 本身不可变，也就不需要任何失效逻辑。
 * 有意跨客户端共享 —— collectionID 在每个 Milvus 实例内唯一，
 * 重连（会生成新的 clientId）不应该把缓存丢掉。
 */
const descriptionCache = new Map<string, string>();
/** 限制缓存大小，避免长时间运行的服务无限增长。 */
const DESCRIPTION_CACHE_MAX = 20_000;
/** 回填 description 时并行的 describeCollection 调用数。 */
const DESCRIPTION_CONCURRENCY = 32;

const descriptionCacheKey = (c: { collection_name: string; id: string }) =>
  `${c.collection_name}#${c.id}`;

export class CollectionsService {
  async showCollections(clientId: string, data?: ShowCollectionsReq) {
    const { milvusClient } = clientCache.get(clientId);
    const res = await milvusClient.showCollections(data);
    return res;
  }

  async createCollection(clientId: string, data: CreateCollectionReq) {
    const { milvusClient } = clientCache.get(clientId);
    return await milvusClient.createCollection(data);
  }

  async describeUnformattedCollection(
    clientId: string,
    collection_name: string,
    db_name?: string
  ) {
    const { milvusClient } = clientCache.get(clientId);
    const res = await milvusClient.describeCollection({
      collection_name,
      db_name,
    });
    return res;
  }

  async describeCollection(clientId: string, data: DescribeCollectionReq) {
    const { milvusClient } = clientCache.get(clientId);
    const res = (await milvusClient.describeCollection(
      data
    )) as DescribeCollectionRes;

    // 获取 Collection 的 index 信息
    const indexRes = await this.describeIndex(clientId, {
      collection_name: data.collection_name,
    });

    const vectorFields: FieldObject[] = [];
    const scalarFields: FieldObject[] = [];
    const functionFields: FieldObject[] = [];

    // 把 function 挂到对应 Field 上
    const fieldMap = new Map(
      res.schema.fields.map(field => [field.name, field])
    );
    res.schema.functions.forEach(fn => {
      const assignFunction = (fieldName: string) => {
        const field = fieldMap.get(fieldName);
        if (field) {
          field.function = fn;
        }
      };

      fn.output_field_names.forEach(assignFunction);
      fn.input_field_names.forEach(assignFunction);
    });

    // 获取 function 的输入 Field
    const inputFieldNames = res.schema.functions.reduce((acc, cur) => {
      return acc.concat(cur.input_field_names);
    }, []);

    // 为每个 Field 附加 index 信息
    res.schema.fields.forEach((field: FieldObject) => {
      // 附加 index
      field.index = indexRes.index_descriptions.find(
        index => index.field_name === field.name
      ) as IndexObject;
      // 附加维度
      field.dimension = Number(field.dim) || -1;
      // 附加最大容量
      field.maxCapacity = Number(field.max_capacity) || -1;
      // 附加最大长度
      field.maxLength = Number(field.max_length) || -1;

      // 对 Field 分类
      if (VectorTypes.includes(field.data_type)) {
        vectorFields.push(field);
      } else {
        scalarFields.push(field);
      }

      if (field.is_primary_key) {
        res.schema.primaryField = field;
      }

      // 若 Field 名在 inputFieldNames 中，则加入 functionFields
      if (inputFieldNames.includes(field.name)) {
        functionFields.push(field);
      }
    });

    // 为 Schema 补充额外数据
    res.schema.hasVectorIndex = vectorFields.every(v => v.index);
    res.schema.enablePartitionKey = res.schema.fields.some(
      v => v.is_partition_key
    );
    res.schema.scalarFields = scalarFields;
    res.schema.vectorFields = vectorFields;
    res.schema.functionFields = functionFields;
    res.schema.dynamicFields = res.schema.enable_dynamic_field
      ? [
          {
            name: DYNAMIC_FIELD,
            data_type: 'JSON',
            type_params: [],
            index: undefined,
            description: '',
            index_params: [],
            dimension: -1,
            maxCapacity: -1,
            maxLength: -1,
            autoID: false,
            fieldID: '',
            state: '',
            nullable: false,
            default_value: null,
            dataType: DataType.JSON,
            is_function_output: false,
            is_primary_key: false,
          },
        ]
      : [];

    if (res.schema.enable_dynamic_field) {
      res.schema.fields.push(res.schema.dynamicFields[0]);
    }

    return res;
  }

  async renameCollection(clientId: string, data: RenameCollectionReq) {
    const { milvusClient } = clientCache.get(clientId);
    return await milvusClient.renameCollection(data);
  }

  async alterCollectionProperties(clientId: string, data: AlterCollectionReq) {
    const { milvusClient } = clientCache.get(clientId);
    return await milvusClient.alterCollectionProperties(data);
  }

  async alterCollectionFieldProperties(
    clientId: string,
    data: AlterCollectionFieldPropertiesReq
  ) {
    const { milvusClient } = clientCache.get(clientId);

    return await milvusClient.alterCollectionFieldProperties(data);
  }

  async alterIndex(clientId: string, data: AlterIndexReq) {
    const { milvusClient } = clientCache.get(clientId);
    return await milvusClient.alterIndexProperties(data);
  }

  async dropCollection(clientId: string, data: DropCollectionReq) {
    const { milvusClient } = clientCache.get(clientId);
    return await milvusClient.dropCollection(data);
  }

  async loadCollection(clientId: string, data: LoadCollectionReq) {
    const { milvusClient } = clientCache.get(clientId);
    return await milvusClient.loadCollection(data);
  }

  async loadCollectionAsync(clientId: string, data: LoadCollectionReq) {
    const { milvusClient } = clientCache.get(clientId);
    return await milvusClient.loadCollectionAsync(data);
  }

  async releaseCollection(clientId: string, data: ReleaseLoadCollectionReq) {
    const { milvusClient } = clientCache.get(clientId);
    await milvusClient.releaseCollection(data);

    // 向客户端推送更新
    this.updateCollectionsDetails(
      clientId,
      [data.collection_name],
      data.db_name
    );

    return data.collection_name;
  }

  async getCollectionStatistics(
    clientId: string,
    data: GetCollectionStatisticsReq
  ) {
    const { milvusClient } = clientCache.get(clientId);
    const res = await milvusClient.getCollectionStatistics(data);
    return res;
  }

  async getLoadState(clientId: string, data: GetLoadStateReq) {
    const { milvusClient } = clientCache.get(clientId);
    const res = await milvusClient.getLoadState(data);
    return res;
  }

  async count(clientId: string, data: CountReq) {
    const { milvusClient } = clientCache.get(clientId);
    let count = 0;
    try {
      // 检查 Collection 是否已 Load
      const loadStateRes = await milvusClient.getLoadState(data);

      if (loadStateRes.state === LoadState.LoadStateLoaded) {
        const countRes = await milvusClient.count(data);
        count = countRes.data;
      } else {
        const collectionStatisticsRes = await this.getCollectionStatistics(
          clientId,
          data
        );
        count = collectionStatisticsRes.data.row_count;
      }
    } catch (error) {
      console.log('ignore count error');
    }

    return { rowCount: Number(count) } as CountObject;
  }

  async insert(clientId: string, data: InsertReq) {
    const { milvusClient } = clientCache.get(clientId);
    const BATCH_SIZE = 1000;
    const fields_data = data.fields_data || data.data;

    // 数据量不超过批大小时直接插入
    if (!fields_data || fields_data.length <= BATCH_SIZE) {
      const res = await milvusClient.insert(data);
      return res;
    }

    // 分批插入
    const results = [];
    for (let i = 0; i < fields_data.length; i += BATCH_SIZE) {
      const batchData = fields_data.slice(i, i + BATCH_SIZE);
      // 只带必要字段构造新的请求
      const batchRequest = { ...data, fields_data: batchData } as InsertReq;
      const result = await milvusClient.insert(batchRequest);

      if (result.status.error_code !== ErrorCode.SUCCESS) {
        throw new Error(result.status.reason);
      }
      results.push(result);
    }

    return results[0];
  }

  async upsert(clientId: string, data: InsertReq) {
    const { milvusClient } = clientCache.get(clientId);
    const res = await milvusClient.upsert(data);
    return res;
  }

  async deleteEntities(clientId: string, data: DeleteEntitiesReq) {
    const { milvusClient } = clientCache.get(clientId);
    const res = await milvusClient.deleteEntities(data);
    return res;
  }

  async vectorSearch(
    clientId: string,
    data: HybridSearchReq | SearchSimpleReq
  ) {
    const { milvusClient } = clientCache.get(clientId);
    const now = Date.now();
    const searchParams = data as HybridSearchReq;
    const isHybrid =
      Array.isArray(searchParams.data) && searchParams.data.length > 1;
    const singleSearchParams = cloneObj(data) as SearchSimpleReq;

    // 适配 2.3.x 版本的 Milvus
    if (searchParams.data && searchParams.data.length === 1) {
      delete singleSearchParams.data;
      delete singleSearchParams.params;

      if (Object.keys(searchParams.data[0].params).length > 0) {
        singleSearchParams.params = searchParams.data[0].params;
      }
      singleSearchParams.data = searchParams.data[0].data;
      singleSearchParams.anns_field = searchParams.data[0].anns_field;
      singleSearchParams.group_by_field = searchParams.group_by_field;
    }

    const res = await milvusClient.search(
      isHybrid ? searchParams : singleSearchParams
    );
    const after = Date.now();

    Object.assign(res, { latency: after - now });
    return res;
  }

  async createAlias(clientId: string, data: CreateAliasReq) {
    const { milvusClient } = clientCache.get(clientId);
    return await milvusClient.createAlias(data);
  }

  async alterAlias(clientId: string, data: AlterAliasReq) {
    const { milvusClient } = clientCache.get(clientId);
    const res = await milvusClient.alterAlias(data);
    return res;
  }

  async dropAlias(clientId: string, collection_name: string, data: any) {
    const { milvusClient } = clientCache.get(clientId);
    await milvusClient.dropAlias(data);

    const newCollection = (await this.getAllCollections(
      clientId,
      [collection_name],
      data.db_name
    )) as CollectionFullObject[];

    return newCollection[0];
  }

  async getReplicas(clientId: string, data: any) {
    const { milvusClient } = clientCache.get(clientId);
    const res = await milvusClient.getReplicas(data);
    return res;
  }

  async query(
    clientId: string,
    data: {
      collection_name: string;
    } & QueryDto
  ) {
    const { milvusClient } = clientCache.get(clientId);
    const now = Date.now();
    const res = await milvusClient.query(data);

    const after = Date.now();

    Object.assign(res, { latency: after - now });
    return res;
  }

  // 获取单个 Collection 的详情
  async getCollection(
    clientId: string,
    collection: CollectionData,
    loadCollection: CollectionData,
    lazy: boolean = false,
    database?: string
  ) {
    if (lazy) {
      // 返回 lazy 对象
      return {
        id: collection.id,
        collection_name: collection.name,
        createdTime: Number(collection.timestamp),
        schema: undefined,
        rowCount: undefined,
        aliases: undefined,
        // 由 fillDescriptions() 回填 —— showCollections 不返回该字段。
        description: '',
        autoID: undefined,
        loadedPercentage: undefined,
        consistency_level: undefined,
        replicas: undefined,
        loaded: undefined,
        db_name: database,
      } as CollectionLazyObject;
    }
    // 获取 Collection 的 Schema 和属性
    const collectionInfo = await this.describeCollection(clientId, {
      collection_name: collection.name,
      db_name: database,
    });

    // 获取 Collection 的统计数据
    let count: number;

    try {
      const res = await this.count(clientId, {
        collection_name: collection.name,
        db_name: database,
      });
      count = res.rowCount;
    } catch (e) {
      console.log('ignore getCollectionStatistics');
    }

    // 提取 autoID
    const autoID = collectionInfo.schema.fields.find(
      v => v.is_primary_key === true
    )?.autoID;

    // 获取 replica 信息
    let replicas;
    try {
      replicas = loadCollection
        ? await this.getReplicas(clientId, {
            collectionID: collectionInfo.collectionID,
            db_name: database,
          })
        : replicas;
    } catch (e) {
      console.log('ignore getReplica');
    }

    // 加载状态信息
    const loadedPercentage = !loadCollection
      ? -1
      : Number(loadCollection.loadedPercentage);

    const status =
      loadedPercentage === -1
        ? LOADING_STATE.UNLOADED
        : loadedPercentage === 100
          ? LOADING_STATE.LOADED
          : LOADING_STATE.LOADING;

    return {
      collection_name: collection.name,
      schema: collectionInfo.schema,
      rowCount: Number(count || 0),
      createdTime: parseInt(collectionInfo.created_utc_timestamp, 10),
      aliases: collectionInfo.aliases,
      description: collectionInfo.schema.description,
      autoID,
      id: collectionInfo.collectionID,
      loadedPercentage,
      consistency_level: collectionInfo.consistency_level,
      replicas: (replicas && replicas.replicas) || [],
      loaded: status === LOADING_STATE.LOADED,
      status,
      properties: collectionInfo.properties,
      db_name: database,
    };
  }

  // 获取全部 Collection 的详情
  async getAllCollections(
    clientId: string,
    collections: string[] = [],
    database?: string
  ): Promise<CollectionObject[]> {
    try {
      // 获取所有 Collection（name、timestamp、id）
      const allCollections = await this.showCollections(clientId, {
        db_name: database,
      });
      // 获取所有已 Load 的 Collection
      const loadedCollections = await this.showCollections(clientId, {
        type: ShowCollectionsType.Loaded,
        db_name: database,
      });

      // 数据容器
      const data: CollectionObject[] = [];

      // 获取目标 Collection 的详情
      const targetCollections = allCollections.data.filter(
        d => collections.indexOf(d.name) !== -1
      );

      const targets =
        targetCollections.length > 0 ? targetCollections : allCollections.data;

      // 按名称排序
      targets.sort((a, b) => a.name.localeCompare(b.name));

      // 未指定 Collection 时不取详情，直接列出全部
      const lazy = collections.length === 0;

      // 获取所有 Collection 的详情
      for (let i = 0; i < targets.length; i++) {
        const collection = targets[i];
        const loadedCollection = loadedCollections.data.find(
          v => v.name === collection.name
        );

        data.push(
          await this.getCollection(
            clientId,
            collection,
            loadedCollection,
            lazy,
            database
          )
        );
      }

      // lazy 对象不带 description，而仓库/分支层次正来自该字段 —— 返回前先回填，
      // 这样列表首屏就能渲染出 Branch 列，而不必等第二次请求。
      if (lazy) {
        await this.fillDescriptions(clientId, data, database);
      }

      // 返回数据
      return data;
    } catch (error) {
      // 出错时返回空数组，例如客户端已断开连接
      return [];
    }
  }

  /**
   * 回填每个 Collection 的 Schema description，showCollections 不返回该字段。
   * Collection 列表会从中解析 `codebasePath:<repoUrl>:<branch>` 来构建
   * 仓库 → 分支的层次结构，所以 description 缺失就意味着 Branch 列为空。
   *
   * describeCollection 只读元数据，但每个 Collection 都要调用一次，而一个跟踪
   * 上百个仓库 × 受保护分支的服务器会有上千次调用。两点让开销可控：用有并发上限
   * 的池替代串行循环，以及一个永远不需要失效的缓存 —— description 只在创建/修改时
   * 变化，重建的 Collection 会拿到新的 collectionID，所以 ID 也是 key 的一部分。
   */
  private async fillDescriptions(
    clientId: string,
    data: CollectionObject[],
    database?: string
  ): Promise<void> {
    const pending = data.filter(c => {
      const hit = descriptionCache.get(descriptionCacheKey(c));
      if (hit === undefined) return true;
      (c as { description: string }).description = hit;
      return false;
    });
    if (pending.length === 0) return;

    let cursor = 0;
    const worker = async () => {
      while (cursor < pending.length) {
        const c = pending[cursor++];
        let desc = '';
        try {
          const info = await this.describeCollection(clientId, {
            collection_name: c.collection_name,
            db_name: database,
          });
          desc = info.schema?.description || '';
          if (descriptionCache.size >= DESCRIPTION_CACHE_MAX) {
            descriptionCache.clear();
          }
          descriptionCache.set(descriptionCacheKey(c), desc);
        } catch (e) {
          // 单个 Collection 读取失败不能让整个列表报错。控制台会退化为用
          // Collection 名中的 slug 作为仓库名。
        }
        (c as { description: string }).description = desc;
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(DESCRIPTION_CONCURRENCY, pending.length) },
        worker
      )
    );
  }

  // 更新 Collection 详情
  // 把新信息推送给客户端
  async updateCollectionsDetails(
    clientId: string,
    collections: string[],
    database: string
  ) {
    try {
      // 获取当前 socket
      const socketClient = clients.get(clientId);
      // 获取 Collection
      const res = await this.getAllCollections(clientId, collections, database);

      // 向当前客户端推送事件
      if (socketClient) {
        socketClient.emit(WS_EVENTS.COLLECTION_UPDATE, { collections: res });
      }
    } catch (e) {
      console.log('ignore queue error');
    }
  }

  async getLoadedCollections(clientId: string, db_name?: string) {
    const data = [];
    const res = await this.showCollections(clientId, {
      type: ShowCollectionsType.Loaded,
      db_name,
    });
    if (res.data.length > 0) {
      for (const item of res.data) {
        const { id, name } = item;

        const count = this.count(clientId, { collection_name: name, db_name });
        data.push({
          id,
          collection_name: name,
          rowCount: count,
          ...item,
        });
      }
    }
    return data;
  }

  /**
   * 获取 Collection 统计数据
   * @returns {collectionCount:number, totalData:number}
   */
  async getStatistics(clientId: string, db_name?: string) {
    const data = {
      collectionCount: 0,
      totalData: 0,
    } as StatisticsObject;
    const res = await this.showCollections(clientId, { db_name });
    data.collectionCount = res.data.length;
    if (res.data.length > 0) {
      for (const item of res.data) {
        const collectionStatistics = await this.getCollectionStatistics(
          clientId,
          {
            collection_name: item.name,
            db_name,
          }
        );
        const rowCount = findKeyValue(collectionStatistics.stats, ROW_COUNT);
        data.totalData += isNaN(Number(rowCount)) ? 0 : Number(rowCount);
      }
    }
    return data;
  }

  /**
   * 向 Collection 导入示例数据
   */
  async importSample(
    clientId: string,
    { collection_name, size, download, format, db_name }: ImportSampleDto
  ) {
    const collectionInfo = await this.describeCollection(clientId, {
      collection_name,
      db_name,
    });

    const totalSize = parseInt(size, 10);
    const fields_data = genRows(
      collectionInfo.schema.fields,
      totalSize,
      collectionInfo.schema.enable_dynamic_field
    );

    if (download) {
      const parser = new Parser({});
      const sampleFile =
        format === 'csv'
          ? parser.parse(fields_data)
          : JSON.stringify(fields_data);
      // download 为 true 时直接返回生成的数据
      return { sampleFile };
    } else {
      // 一次性插入全部数据，分批逻辑已在 insert 方法中处理
      return await this.insert(clientId, {
        collection_name,
        fields_data,
        db_name,
      });
    }
  }

  async getCompactionState(clientId: string, data: GetCompactionStateReq) {
    const { milvusClient } = clientCache.get(clientId);
    const res = await milvusClient.getCompactionState(data);
    return res;
  }

  async getQuerySegmentInfo(clientId: string, data: GetQuerySegmentInfoReq) {
    const { milvusClient } = clientCache.get(clientId);
    const res = await milvusClient.getQuerySegmentInfo(data);
    return res;
  }

  async getPersistentSegmentInfo(
    clientId: string,
    data: GePersistentSegmentInfoReq
  ) {
    const { milvusClient } = clientCache.get(clientId);
    const res = await milvusClient.getPersistentSegmentInfo(data);
    return res;
  }

  async compact(clientId: string, data: CompactReq) {
    const { milvusClient } = clientCache.get(clientId);
    const res = await milvusClient.compact(data);
    return res;
  }

  async hasCollection(clientId: string, data: HasCollectionReq) {
    const { milvusClient } = clientCache.get(clientId);
    const res = await milvusClient.hasCollection(data);
    return res;
  }

  async duplicateCollection(clientId: string, data: RenameCollectionReq) {
    const collection = await this.describeCollection(clientId, {
      collection_name: data.collection_name,
      db_name: data.db_name,
    });

    const createCollectionParams: CreateCollectionReq = {
      collection_name: data.new_collection_name,
      fields: collection.schema.fields.map(convertFieldSchemaToFieldType),
      consistency_level: collection.consistency_level as any,
      enable_dynamic_field: !!collection.schema.enable_dynamic_field,
    };

    if (
      collection.schema.fields.some(f => f.is_partition_key) &&
      collection.num_partitions
    ) {
      createCollectionParams.num_partitions = Number(collection.num_partitions);
    }

    return await this.createCollection(clientId, createCollectionParams);
  }

  async emptyCollection(clientId: string, data: HasCollectionReq) {
    const { milvusClient } = clientCache.get(clientId);
    const pkField = await milvusClient.getPkFieldName(data);
    const pkType = await milvusClient.getPkFieldType(data);

    const res = await milvusClient.deleteEntities({
      collection_name: data.collection_name,
      filter:
        pkType === 'Int64' ? `${pkField} >= ${MIN_INT64}` : `${pkField} != ''`,
      db_name: data.db_name,
    });

    return res;
  }

  async createIndex(clientId: string, data: CreateIndexReq) {
    const { milvusClient } = clientCache.get(clientId);
    return await milvusClient.createIndex(data);
  }

  async describeIndex(clientId: string, data: DescribeIndexReq) {
    const { milvusClient } = clientCache.get(clientId);

    // 若 index 描述不在缓存中，则调用 Milvus SDK 的 describeIndex
    const res = (await milvusClient.describeIndex(data)) as DescribeIndexRes;

    res.index_descriptions.map(index => {
      // 获取 indexType
      index.indexType = (index.params.find(p => p.key === 'index_type')
        ?.value || '') as string;
      // 获取 metricType
      const metricTypePair =
        index.params.filter(v => v.key === 'metric_type') || [];
      index.metricType = findKeyValue(metricTypePair, 'metric_type') as string;

      // 复制 index.params，排除 index_type、metric_type 和 params
      const indexParams = index.params.filter(
        p =>
          p.key !== 'index_type' &&
          p.key !== 'metric_type' &&
          p.key !== 'params'
      );
      // 获取 index 参数键值对
      const paramsJSONstring = findKeyValue(index.params, 'params'); // params 是 JSON 字符串
      const params =
        (paramsJSONstring &&
          getKeyValueListFromJsonString(paramsJSONstring as string)) ||
        [];

      index.indexParameterPairs = [...indexParams, ...params];
    });

    // 返回 Milvus SDK describeIndex 的响应
    return res;
  }

  async dropIndex(clientId: string, data: DropIndexReq) {
    const { milvusClient } = clientCache.get(clientId);
    return await milvusClient.dropIndex(data);
  }
}
