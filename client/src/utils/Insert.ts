import { generateId } from './Common';
import { DataTypeEnum } from '@/consts'
import type { FieldObject } from '@server/types';

/**
 * 把上传的 csv 转换为 AttuGrid 组件可接受的数据类型
 * @param data 上传的 csv 数据，例如 [['name1', 12], ['name2', 14]]
 * @returns 键值对对象数组，以 index 作为 key，例如 [{0: 'name1', 1: 12}, {0: 'name2', 1: 14}]
 */
export const transferCsvArrayToTableData = (data: any[][]) => {
  return data.reduce(
    (result, arr) => [...result, { ...arr, id: generateId() }],
    []
  );
};

/**
 * 替换对象 key 的方法
 * @param obj 例如 {0: 'name1', 1: 12, 2: 'red'}
 * @param newKeys 例如 ['name', 'age', 'color']
 * @returns 例如 {name: 'name1', age: 12, color: 'red'}
 */
const replaceKeysByIndex = (
  obj: any,
  newKeys: string[],
  fields: FieldObject[]
) => {
  const keyValues = Object.keys(obj).map(key => {
    const newKey = newKeys[Number(key)] || key;
    const field = fields.find(f => f.name === newKey);
    const isVarChar = field && field.dataType === DataTypeEnum.VarChar as any;

    return { [newKey]: isVarChar? obj[key] : parseValue(obj[key]) };
  });
  return Object.assign({}, ...keyValues);
};

export const parseValue = (value: string) => {
  try {
    return JSON.parse(value);
  } catch (err) {
    return value;
  }
};

export const formatValue = (value: any) => {
  if (Array.isArray(value) && value.length > 0) {
    return `[${value}]`;
  }

  if (typeof value === 'object' && value && !Array.isArray(value)) {
    return JSON.stringify(value);
  }

  return value;
};

/**
 *
 * @param heads 表格表头，例如 ['field1', 'field2', 'field3']
 * @param data 表格数据，例如 [[23, [2,3,34,4,5,56], [1,1,1,1,1,1,1,1,1,1,1]]]
 * @returns 键值对对象数组，key 为用户选择的表头或 csv 表头
 */
export const combineHeadsAndData = (
  heads: string[],
  data: any[],
  fields: FieldObject[]
) => {
  // 以 index 作为 key，把二维数组展平
  // 过滤掉无用的行
  const flatTableData = data
    .filter(d => d.some((item: string) => item !== ''))
    .reduce((result, arr) => [...result, { ...arr }], []);
  // 依据下标把 flatTableData 的 key 替换为真实表头
  return flatTableData.map((d: any) => replaceKeysByIndex(d, heads, fields));
};
