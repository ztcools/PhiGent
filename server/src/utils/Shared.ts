import { CollectionObject } from '../types';

/**
 * 检查 Collection 是否正在加载
 */
export const checkLoading = (v: CollectionObject): boolean => {
  return (
    typeof v.loadedPercentage !== 'undefined' &&
    v.loadedPercentage !== -1 &&
    v.loadedPercentage !== 100
  );
};

/**
 * 检查 Collection 是否正在构建索引。
 * @param v
 * @returns 布尔值
 */
export const checkIndexing = (v: CollectionObject): boolean => {
  return Boolean(
    v.schema &&
      v.schema?.fields.some(field => field.index?.state === 'InProgress')
  );
};
