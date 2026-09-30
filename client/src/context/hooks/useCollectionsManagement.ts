import { useCallback, useRef, useState, useEffect, useContext } from 'react';
import { CollectionService, MilvusService } from '@/http';
import { WS_EVENTS, WS_EVENTS_TYPE } from '@server/utils/Const';
import { checkIndexing, checkLoading } from '@server/utils/Shared';
import { authContext } from '@/context';
import { isInfraCollection } from '@/utils/codeCollection';
import type { CollectionObject, CollectionFullObject } from '@server/types';

// 基础设施 Collection（共享索引状态 + embedding 缓存）在所有位置都隐藏，
// 使计数和列表只展示真实的代码 Collection（仓库 / 分支）。
const excludeInfra = <T extends { collection_name: string }>(list: T[]): T[] =>
  list.filter(c => !isInfraCollection(c.collection_name));

export function useCollectionsManagement(database: string) {
  const [collections, setCollections] = useState<CollectionObject[]>([]);
  const { isAuth } = useContext(authContext);

  const [loading, setLoading] = useState(true);
  const [isBatchRefreshing, setIsBatchRefreshing] = useState(false);
  const requestIdRef = useRef(0);
  const databaseRef = useRef(database);

  const detectLoadingIndexing = useCallback(
    (collections: CollectionObject[]) => {
      const LoadingOrBuildingCollections = collections.filter(v => {
        const isLoading = checkLoading(v);
        const isBuildingIndex = checkIndexing(v);
        return isLoading || isBuildingIndex;
      });
      if (LoadingOrBuildingCollections.length > 0) {
        MilvusService.triggerCron({
          name: WS_EVENTS.COLLECTION_UPDATE,
          type: WS_EVENTS_TYPE.START,
          payload: {
            database: databaseRef.current,
            collections: LoadingOrBuildingCollections.map(
              c => c.collection_name
            ),
          },
        });
      }
    },
    [] // 从依赖中移除 database
  );

  const updateCollections = useCallback(
    (props: {
      collections: CollectionFullObject[];
      database?: string;
      deletedNames?: string[];
    }) => {
      const {
        collections: updated = [],
        database: remote,
        deletedNames = [],
      } = props;
      if (
        remote !== databaseRef.current &&
        databaseRef.current !== undefined &&
        remote !== undefined
      ) {
        return;
      }
      const updatedFiltered = excludeInfra(updated);
      detectLoadingIndexing(updatedFiltered);
      setCollections(prev => {
        // 合并 Collection
        const prevMap = new Map(prev.map(c => [c.id, c]));
        updatedFiltered.forEach(c => {
          prevMap.set(c.id, c);
        });
        let merged = Array.from(prevMap.values());
        // 删除 Collection
        if (deletedNames.length > 0) {
          merged = merged.filter(
            c => !deletedNames.includes(c.collection_name)
          );
        }
        const newCollections = updatedFiltered.filter(
          c => !prev.some(p => p.collection_name === c.collection_name)
        );
        // 排序 Collection
        if (newCollections.length > 0) {
          return merged.sort((a, b) => {
            if (
              a.loadedPercentage === b.loadedPercentage &&
              a.schema &&
              b.schema
            ) {
              if (a.schema.hasVectorIndex === b.schema.hasVectorIndex) {
                return b.createdTime - a.createdTime;
              }
              return a.schema.hasVectorIndex ? -1 : 1;
            }
            return (b.loadedPercentage || 0) - (a.loadedPercentage || 0);
          });
        }
        return merged;
      });
    },
    [detectLoadingIndexing]
  );

  const refreshCollectionsDebounceMapRef = useRef<
    Map<
      string,
      { timer: NodeJS.Timeout | null; names: string[]; pending: Set<string> }
    >
  >(new Map());

  function clearRefreshCollectionsDebounceMapRef() {
    refreshCollectionsDebounceMapRef.current.forEach(ref => {
      if (ref.timer) {
        clearTimeout(ref.timer);
      }
      ref.names = [];
      ref.timer = null;
    });
    refreshCollectionsDebounceMapRef.current.clear();
    setIsBatchRefreshing(false);
  }

  useEffect(() => {
    if (!isAuth) {
      // 未认证时清空 Collection
      setCollections([]);
      clearRefreshCollectionsDebounceMapRef();
    }
  }, [isAuth]);

  // database 变化时更新 ref
  useEffect(() => {
    databaseRef.current = database;
    setCollections([]);
    // 清空 refreshCollectionsDebounceMapRef
    clearRefreshCollectionsDebounceMapRef();
  }, [database]);

  const fetchCollections = async () => {
    const currentRequestId = ++requestIdRef.current;
    try {
      setLoading(true);

      // 不先清空 —— 保留旧数据直到新数据就绪，避免整表闪烁。
      // 响应已带 description（服务端 fillDescriptions 并发补齐），列表页首屏
      // 就能解析出「仓库 → 分支」层次，不需要再补一轮 details。
      const res = excludeInfra(await CollectionService.getAllCollections());

      if (currentRequestId === requestIdRef.current) {
        detectLoadingIndexing(res);
        setCollections(res);
        setLoading(false);
      }
    } catch (error) {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
      throw error;
    }
  };

  const fetchCollection = useCallback(
    async (name: string, drop?: boolean) => {
      if (!isAuth) return;
      if (drop) {
        updateCollections({ collections: [], deletedNames: [name] });
      } else {
        const res = await CollectionService.getCollection(name);
        updateCollections({ collections: [res] });
      }
    },
    [isAuth, updateCollections]
  );

  const batchRefreshCollections = useCallback(
    async (collectionNames: string[], key: string = 'default') => {
      // 未登录时不刷新 Collection
      if (!isAuth) return;
      let ref = refreshCollectionsDebounceMapRef.current.get(key);
      if (!ref) {
        ref = { timer: null, names: [], pending: new Set() };
        refreshCollectionsDebounceMapRef.current.set(key, ref);
      }
      const filteredCollectionNames = collectionNames.filter(name => {
        const collection = collections.find(v => v.collection_name === name);
        return collection && !collection.schema && !ref!.pending.has(name);
      });
      ref.names = filteredCollectionNames;
      if (ref.timer) {
        clearTimeout(ref.timer);
      }
      
      // 有待刷新的 Collection 时，将批量刷新状态置为 true
      if (filteredCollectionNames.length > 0) {
        setIsBatchRefreshing(true);
      }
      
      function getRandomBatchSize() {
        const weights = [2, 2, 2, 3, 3, 3, 4, 4, 5];
        return weights[Math.floor(Math.random() * weights.length)];
      }
      ref.timer = setTimeout(async () => {
        if (ref!.names.length === 0) {
          setIsBatchRefreshing(false);
          return;
        }
        try {
          while (ref!.names.length > 0) {
            const batchSize = getRandomBatchSize();
            let batch = ref!.names.slice(0, batchSize);
            batch = batch.filter(name => {
              const collection = collections.find(
                v => v.collection_name === name
              );
              return collection && !collection.schema;
            });
            batch.forEach(name => ref!.pending.add(name));
            // 调用 API
            const res = await CollectionService.getCollections({
              db_name: databaseRef.current,
              collections: batch,
            });
            updateCollections({
              collections: res.filter(c => c.db_name === databaseRef.current),
            });
            batch.forEach(name => ref!.pending.delete(name));
            ref!.names = ref!.names.slice(batch.length);
          }
        } catch (error) {
          console.error('Failed to refresh collections:', error);
        }
        ref!.names = [];
        ref!.timer = null;
        
        // 检查所有 map 是否为空，为空则将批量刷新状态置为 false
        const hasActiveRefreshes = Array.from(refreshCollectionsDebounceMapRef.current.values()).some(
          ref => ref.names.length > 0 || ref.timer !== null
        );
        if (!hasActiveRefreshes) {
          setIsBatchRefreshing(false);
        }
      }, 200);
    },
    [collections, updateCollections, isAuth] // 已移除 database 依赖
  );

  return {
    collections,
    setCollections,
    loading,
    isBatchRefreshing,
    fetchCollections,
    fetchCollection,
    batchRefreshCollections,
    updateCollections,
  };
}
