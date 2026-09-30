import { NextFunction, Request, Response, Router } from 'express';
import { dtoValidationMiddleware } from '../middleware/validation';
import { CollectionsService } from './collections.service';
import {
  LoadCollectionReq,
  IndexType,
  MetricType,
  ResStatus,
  ErrorCode,
  DataType,
} from '@zilliz/milvus2-sdk-node';
import {
  CreateAliasDto,
  CreateCollectionDto,
  InsertDataDto,
  ImportSampleDto,
  QueryDto,
  RenameCollectionDto,
  DuplicateCollectionDto,
  ManageIndexDto,
} from './dto';
import { MmapChanges } from '../types';

export class CollectionController {
  private collectionsService: CollectionsService;
  private router: Router;

  constructor() {
    this.collectionsService = new CollectionsService();

    this.router = Router();
  }

  get collectionsServiceGetter() {
    return this.collectionsService;
  }

  generateRoutes() {
    // 获取所有 Collection
    this.router.get('/', this.showCollections.bind(this));
    this.router.get('/names', this.getCollectionNames.bind(this));
    this.router.post('/details', this.getCollections.bind(this));

    // 获取所有 Collection 的统计信息
    this.router.get('/statistics', this.getStatistics.bind(this));
    // Index
    this.router.post(
      '/index',
      dtoValidationMiddleware(ManageIndexDto),
      this.manageIndex.bind(this)
    );

    this.router.get('/index', this.describeIndex.bind(this));

    // 获取带 Index 信息的 Collection
    this.router.get('/:name', this.describeCollection.bind(this));
    this.router.get(
      '/:name/unformatted',
      this.describeUnformattedCollection.bind(this)
    );
    // 获取数据行数
    this.router.get('/:name/count', this.count.bind(this));
    // 创建 Collection
    this.router.post(
      '/',
      dtoValidationMiddleware(CreateCollectionDto),
      this.createCollection.bind(this)
    );
    // 删除 Collection
    this.router.delete('/:name', this.dropCollection.bind(this));
    // 重命名 Collection
    this.router.post(
      '/:name',
      dtoValidationMiddleware(RenameCollectionDto),
      this.renameCollection.bind(this)
    );

    // 复制 Collection
    this.router.post(
      '/:name/duplicate',
      dtoValidationMiddleware(DuplicateCollectionDto),
      this.duplicateCollection.bind(this)
    );

    // 获取单个 Collection 的统计信息
    this.router.get(
      '/:name/statistics',
      this.getCollectionStatistics.bind(this)
    );

    // 加载 / 释放
    this.router.put('/:name/load', this.loadCollection.bind(this));
    this.router.put('/:name/release', this.releaseCollection.bind(this));
    this.router.put('/:name/empty', this.empty.bind(this));

    // 修改 Collection 属性
    this.router.put(
      '/:name/properties',
      this.setCollectionProperties.bind(this)
    );

    // 插入数据
    this.router.post(
      '/:name/insert',
      dtoValidationMiddleware(InsertDataDto),
      this.insert.bind(this)
    );
    this.router.post(
      '/:name/upsert',
      dtoValidationMiddleware(InsertDataDto),
      this.upsert.bind(this)
    );

    // 插入示例数据
    this.router.post(
      '/:name/importSample',
      dtoValidationMiddleware(ImportSampleDto),
      this.importSample.bind(this)
    );
    // 这里需要用 req.body，所以不能用 delete 请求
    this.router.put('/:name/entities', this.deleteEntities.bind(this));
    this.router.post('/:name/search', this.vectorSearch.bind(this));
    // 查询
    this.router.post(
      '/:name/query',
      dtoValidationMiddleware(QueryDto),
      this.query.bind(this)
    );
    // 创建 Alias
    this.router.post(
      '/:name/alias',
      dtoValidationMiddleware(CreateAliasDto),
      this.createAlias.bind(this)
    );
    // 删除 Alias
    this.router.delete('/:name/alias/:alias', this.dropAlias.bind(this));

    // Segment
    this.router.get('/:name/psegments', this.getPSegment.bind(this));
    this.router.get('/:name/qsegments', this.getQSegment.bind(this));
    // 手动 Compact
    this.router.put('/:name/compact', this.compact.bind(this));

    // mmap 配置
    this.router.put('/:name/mmap', this.updateMmapSettings.bind(this));

    return this.router;
  }

  async showCollections(req: Request, res: Response, next: NextFunction) {
    const type = parseInt('' + req.query?.type, 10);
    try {
      const result =
        type === 1
          ? await this.collectionsService.getLoadedCollections(
              req.clientId,
              req.db_name
            )
          : await this.collectionsService.getAllCollections(
              req.clientId,
              [],
              req.db_name
            );
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async getCollections(req: Request, res: Response, next: NextFunction) {
    const collections = req.body?.collections || [];

    try {
      const result = await this.collectionsService.getAllCollections(
        req.clientId,
        collections,
        req.db_name
      );
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async getCollectionNames(req: Request, res: Response, next: NextFunction) {
    try {
      const db_name = req.query?.db_name;
      const request = {} as any;

      if (db_name) {
        request.db_name = db_name;
      }

      const result = await this.collectionsService.showCollections(
        req.clientId,
        request
      );
      res.send(
        result.data
          .sort((a, b) => {
            // 按名称排序
            return a.name.localeCompare(b.name);
          })
          .map((item: any) => item.name)
      );
    } catch (error) {
      next(error);
    }
  }

  async getStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await this.collectionsService.getStatistics(
        req.clientId,
        req.db_name
      );
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async createCollection(req: Request, res: Response, next: NextFunction) {
    const createCollectionData = req.body;

    if (createCollectionData.loadAfterCreate) {
      // 为所有 Field 构建 index_params
      const fields = createCollectionData.fields;
      const index_params = fields
        .filter((f: any) => f.data_type !== DataType.JSON)
        .map((field: any) => {
          const params: any = {
            field_name: field.name,
            index_type: IndexType.AUTOINDEX,
          };

          if (field.is_function_output) {
            params.metric_type = MetricType.BM25;
          }

          return params;
        });
      createCollectionData.index_params = index_params;
    }

    try {
      const result = await this.collectionsService.createCollection(
        req.clientId,
        createCollectionData
      );

      // 创建完成后加载 Collection
      if (createCollectionData.loadAfterCreate) {
        await this.collectionsService.loadCollectionAsync(req.clientId, {
          collection_name: createCollectionData.collection_name,
          db_name: req.db_name,
        });
      }
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async renameCollection(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    const data = req.body;
    try {
      const result = await this.collectionsService.renameCollection(
        req.clientId,
        {
          collection_name: name,
          ...data,
        }
      );
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async setCollectionProperties(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const name = req.params?.name;
    const data = req.body;
    try {
      const result = await this.collectionsService.alterCollectionProperties(
        req.clientId,
        {
          collection_name: name,
          ...data,
        }
      );
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async duplicateCollection(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    const data = req.body;
    try {
      const result = await this.collectionsService.duplicateCollection(
        req.clientId,
        {
          collection_name: name,
          ...data,
        }
      );
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async dropCollection(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    try {
      const result = await this.collectionsService.dropCollection(
        req.clientId,
        {
          collection_name: name,
          db_name: req.db_name,
        }
      );
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async describeCollection(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    try {
      const result = await this.collectionsService.getAllCollections(
        req.clientId,
        [name],
        req.db_name
      );
      res.send(result[0]);
    } catch (error) {
      next(error);
    }
  }

  async describeUnformattedCollection(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const name = req.params?.name;
    try {
      const result =
        await this.collectionsService.describeUnformattedCollection(
          req.clientId,
          name,
          req.db_name
        );
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async getCollectionStatistics(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const name = req.params?.name;
    try {
      const result = await this.collectionsService.getCollectionStatistics(
        req.clientId,
        {
          collection_name: name,
          db_name: req.db_name,
        }
      );
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async loadCollection(req: Request, res: Response, next: NextFunction) {
    const collection_name = req.params?.name;
    const data = req.body;
    const param: LoadCollectionReq = { collection_name, db_name: req.db_name };
    if (data.replica_number) {
      param.replica_number = Number(data.replica_number);
    }
    try {
      const result = await this.collectionsService.loadCollectionAsync(
        req.clientId,
        param
      );
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async releaseCollection(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    try {
      const result = await this.collectionsService.releaseCollection(
        req.clientId,
        {
          collection_name: name,
          db_name: req.db_name,
        }
      );
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async insert(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    const data = req.body;
    try {
      const result = await this.collectionsService.insert(req.clientId, {
        collection_name: name,
        ...data,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async upsert(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    const data = req.body;
    try {
      const result = await this.collectionsService.upsert(req.clientId, {
        collection_name: name,
        ...data,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async importSample(req: Request, res: Response, next: NextFunction) {
    const data = req.body;
    try {
      const result = await this.collectionsService.importSample(req.clientId, {
        ...data,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }
  async deleteEntities(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    const data = req.body;
    try {
      const result = await this.collectionsService.deleteEntities(
        req.clientId,
        {
          collection_name: name,
          ...data,
        }
      );
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async vectorSearch(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    const data = req.body;
    try {
      const result = await this.collectionsService.vectorSearch(req.clientId, {
        collection_name: name,
        ...data,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async query(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    const data = req.body;
    const resultLimit: any = req.query?.limit;
    const resultPage: any = req.query?.page;

    try {
      const limit = parseInt(resultLimit, 10);
      const page = isNaN(resultPage) ? 0 : parseInt(resultPage, 10);
      const result = await this.collectionsService.query(req.clientId, {
        collection_name: name,
        ...data,
      });

      // const queryResultList = result.data;
      const queryResultLength = result.data.length;
      res.send({ ...result, limit, page, total: queryResultLength });
    } catch (error) {
      next(error);
    }
  }

  async createAlias(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    const data = req.body;
    try {
      const result = await this.collectionsService.createAlias(req.clientId, {
        collection_name: name,
        ...data,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async dropAlias(req: Request, res: Response, next: NextFunction) {
    const alias = req.params?.alias;
    const name = req.params?.name;
    try {
      const result = await this.collectionsService.dropAlias(
        req.clientId,
        name,
        {
          alias,
          db_name: req.db_name,
        }
      );
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async getReplicas(req: Request, res: Response, next: NextFunction) {
    const collectionID = req.params?.collectionID;
    try {
      const result = await this.collectionsService.getReplicas(req.clientId, {
        collectionID,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async getPSegment(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    try {
      const result = await this.collectionsService.getPersistentSegmentInfo(
        req.clientId,
        {
          collectionName: name,
          dbName: req.db_name,
        }
      );
      res.send(result.infos);
    } catch (error) {
      next(error);
    }
  }

  async getQSegment(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    try {
      const result = await this.collectionsService.getQuerySegmentInfo(
        req.clientId,
        {
          collectionName: name,
          dbName: req.db_name,
        }
      );
      res.send(result.infos);
    } catch (error) {
      next(error);
    }
  }

  async compact(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    try {
      const result = await this.collectionsService.compact(req.clientId, {
        collection_name: name,
        db_name: req.db_name,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async count(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    try {
      const result = await this.collectionsService.count(req.clientId, {
        collection_name: name,
        db_name: req.db_name,
      });

      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async empty(req: Request, res: Response, next: NextFunction) {
    const name = req.params?.name;
    try {
      const result = await this.collectionsService.emptyCollection(
        req.clientId,
        {
          collection_name: name,
          db_name: req.db_name,
        }
      );

      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async manageIndex(req: Request, res: Response, next: NextFunction) {
    const { type, collection_name, index_name, extra_params, field_name } =
      req.body;
    try {
      const result =
        type.toLocaleLowerCase() === 'create'
          ? await this.collectionsService.createIndex(req.clientId, {
              collection_name,
              extra_params,
              field_name,
              index_name,
              db_name: req.db_name,
            })
          : await this.collectionsService.dropIndex(req.clientId, {
              collection_name,
              field_name,
              index_name,
              db_name: req.db_name,
            });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async describeIndex(req: Request, res: Response, next: NextFunction) {
    const data = '' + req.query?.collection_name;
    try {
      const result = await this.collectionsService.describeIndex(req.clientId, {
        collection_name: data,
        db_name: req.db_name,
      });

      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async updateMmapSettings(
    req: Request<{ name: string }, ResStatus, MmapChanges[]>,
    res: Response,
    next: NextFunction
  ) {
    const name = req.params?.name;
    const data = req.body;
    try {
      const promises = [];
      // 遍历所有 Field 更新 mmap 配置：raw 类型更新 field properties，index 类型更新 index
      for (const field of data) {
        if (typeof field.rawMmapEnabled !== 'undefined') {
          promises.push(
            await this.collectionsService.alterCollectionFieldProperties(
              req.clientId,
              {
                collection_name: name,
                field_name: field.fieldName,
                properties: {
                  'mmap.enabled': field.rawMmapEnabled,
                },
              }
            )
          );
        }
        if (typeof field.indexMmapEnabled !== 'undefined') {
          promises.push(
            this.collectionsService.alterIndex(req.clientId, {
              collection_name: name,
              index_name: field.fieldName,
              params: {
                'mmap.enabled': field.indexMmapEnabled,
              },
            })
          );
        }
      }
      const results = await Promise.all(promises);

      // 遍历返回结果，只要有一个不成功就直接返回该结果
      for (const result of results) {
        if (result.error_code !== ErrorCode.SUCCESS) {
          return result;
        }
      }
      res.send(results[0]);
    } catch (error) {
      next(error);
    }
  }
}
