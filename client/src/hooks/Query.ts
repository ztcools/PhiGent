import { useState, useRef, useEffect } from 'react';
import { DataTypeStringEnum, MIN_INT64 } from '@/consts';
import { CollectionService } from '@/http';
import type { CollectionFullObject } from '@server/types';
import { QueryState } from '@/pages/databases/types';

// TODO: 重构这里，代码有点乱
export const useQuery = (params: {
  collection: CollectionFullObject;
  onQueryStart: Function;
  onQueryEnd?: Function;
  onQueryFinally?: Function;
  queryState: QueryState;
  setQueryState: (state: QueryState) => void;
}) => {
  // 参数
  const { collection, onQueryStart, onQueryEnd, onQueryFinally, queryState } =
    params;

  // 状态
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [queryResult, setQueryResult] = useState<any>({ data: [], latency: 0 });

  // 为 Primary Key 的 id 建立本地缓存
  const pageCache = useRef(new Map());

  // 获取上一页/下一页的表达式
  const getPageExpr = (page: number, expr = queryState.expr) => {
    const cache = pageCache.current.get(
      page > currentPage ? currentPage : page
    );
    const primaryKey = collection?.schema?.primaryField;

    const formatPKValue = (pkId: string | number) =>
      primaryKey?.data_type === DataTypeStringEnum.VarChar ? `'${pkId}'` : pkId;

    // 缓存不存在时，根据 primaryKey 类型返回表达式
    let condition = '';
    if (!cache) {
      const defaultValue =
        primaryKey?.data_type === DataTypeStringEnum.VarChar
          ? "''"
          : `${MIN_INT64}`;
      condition = `${primaryKey?.name} > ${defaultValue}`;
    } else {
      const { firstPKId, lastPKId } = cache;
      const lastPKValue = formatPKValue(lastPKId);
      const firstPKValue = formatPKValue(firstPKId);

      condition =
        page > currentPage
          ? `(${primaryKey?.name} > ${lastPKValue})`
          : `((${primaryKey?.name} <= ${lastPKValue}) && (${primaryKey?.name} >= ${firstPKValue}))`;
    }

    return expr ? `${expr} && ${condition}` : condition;
  };

  // 查询函数
  const query = async (page: number = currentPage, queryState: QueryState) => {
    if (!collection || !collection.loaded) return;
    const _expr = getPageExpr(page, queryState.expr);

    onQueryStart(_expr);

    // queryState.outputFields 里不能包含函数输出的字段
    const outputFields = queryState.outputFields.filter(
      f =>
        !collection.schema.fields.find(ff => ff.name === f)?.is_function_output
    );

    try {
      const queryParams = {
        expr: _expr,
        output_fields: outputFields,
        limit: pageSize || 10,
        consistency_level: queryState.consistencyLevel,
        // travel_timestamp: timeTravelInfo.timestamp,
      };

      // 执行查询
      const res = await CollectionService.queryData(
        collection.collection_name,
        queryParams
      );

      // 取出最后一条数据
      const lastItem = res.data[res.data.length - 1];
      // 取出第一条数据
      const firstItem = res.data[0];
      // 取最后一个 Primary Key
      const lastPKId: string | number =
        lastItem && lastItem[collection!.schema.primaryField.name];
      // 取第一个 Primary Key
      const firstPKId: string | number =
        firstItem && firstItem[collection!.schema.primaryField.name];

      // 按页码把 Primary Key 存入缓存
      if (lastItem) {
        pageCache.current.set(page, {
          firstPKId,
          lastPKId,
        });
      }

      // console.log('query result page', page, pageCache.current);

      // 更新查询结果
      setQueryResult(res);

      onQueryEnd?.(res);
    } catch (e: any) {
      reset(true);
    } finally {
      onQueryFinally?.();
    }
  };

  const count = async (
    consistency_level = queryState.consistencyLevel,
    expr = queryState.expr
  ) => {
    if (!collection || !collection.loaded) {
      setTotal(collection.rowCount);
      return;
    }
    const count = 'count(*)';
    try {
      const res = await CollectionService.queryData(
        collection.collection_name,
        {
          expr: expr,
          output_fields: [count],
          consistency_level,
        }
      );
      setTotal(Number(res.data[0][count]));
    } catch (error) {
      setTotal(0);
    }
  };

  // 重置
  const reset = (clearData = false) => {
    setCurrentPage(0);
    if (clearData) {
      setQueryResult({ data: [], latency: 0 });
    }

    pageCache.current.clear();
  };

  // 表达式或其他依赖变化时触发查询
  useEffect(() => {
    // 前置条件不满足时跳过查询
    if (!collection || !collection.loaded || !pageSize) {
      // 还不能查询时，重置结果并把 Collection 的行数作为 total
      setQueryResult({ data: [], latency: 0 });
      setTotal(collection.rowCount);
      return;
    }

    // 前置条件全部满足后执行查询
    reset();

    // 先获取总数
    count(queryState.consistencyLevel, queryState.expr);

    // 再拉取实际数据
    query(currentPage, queryState);
  }, [
    pageSize,
    queryState.outputFields,
    queryState.collection,
    queryState.consistencyLevel,
    queryState.expr,
    queryState.tick,
  ]);

  // Collection 变化时重置状态
  useEffect(() => {
    // Collection 变化时立即重置，避免展示过期数据
    setQueryResult({ data: [], latency: 0 });
    setCurrentPage(0);
    pageCache.current.clear();

    // 兜底把 total 设为 Collection 的行数
    if (collection) {
      setTotal(collection.rowCount || 0);
    }
  }, [collection.collection_name]);

  return {
    // 查询总数
    total,
    // 每页条数
    pageSize,
    // 更新每页条数
    setPageSize,
    // 当前页
    currentPage,
    // 查询当前数据页
    setCurrentPage,
    // 查询结果
    queryResult,
    // 查询
    query,
    // 重置
    reset,
    // 统计总数
    count,
    // 获取表达式
    getPageExpr,
  };
};
