import { METRIC_TYPES_VALUES } from '@/consts';
import type { CollectionObject } from '@server/types';

export type ValidType =
  | 'bool'
  | 'number'
  | 'email'
  | 'require'
  | 'confirm'
  | 'range'
  | 'password'
  | 'clusterName'
  | 'CIDRorIP'
  | 'integer'
  | 'positiveNumber'
  | 'collectionName'
  | 'dimension'
  | 'multiple'
  | 'partitionName'
  | 'firstCharacter'
  | 'specValueOrRange'
  | 'duplicate'
  | 'valueLength'
  | 'username'
  | 'cloudPassword'
  | 'custom';
export interface ICheckMapParam {
  value: string;
  extraParam?: IExtraParam;
  rule: ValidType;
}
export interface IExtraParam {
  // 用于 confirm 或任意比较类型
  compareValue?: string | number;
  // 用于长度类型
  min?: number;
  max?: number;
  type?: 'string' | 'number';

  // 用于 dimension
  metricType?: METRIC_TYPES_VALUES;
  multipleNumber?: number;

  // 用于校验起始字符
  invalidTypes?: TypeEnum[];
  // 用于自定义校验
  compare?: (value?: any) => boolean;
}
export type CheckMap = {
  [key in ValidType]: boolean;
};

export enum TypeEnum {
  'number' = 'number',
}

export const checkEmptyValid = (value: string | number): boolean => {
  return String(value).trim() !== '';
};

export const checkEmail = (value: string): boolean => {
  const re = /\S+@\S+\.\S+/;
  return re.test(value);
};

/* 密码规则：
 * 1. 至少一个大写字母
 * 2. 至少一个小写字母
 * 3. 至少一个数字
 * 4. 至少一个非字母数字字符：! @ # $ % ^ & * ( ) _ + - = [ ] { } | '
 */
export const checkPasswordStrength = (value: string): boolean => {
  const re = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*([^A-Za-z0-9]))/;
  return re.test(value);
};

export const checkRange = (param: {
  value: string | number;
  min?: number;
  max?: number;
  type?: 'string' | 'number';
}): boolean => {
  const { value, min = 0, max = 0, type } = param;
  const length = type === 'number' ? Number(value) : (value as string).length;

  let result = true;
  const conditionMap = {
    min: length >= min,
    max: length <= max,
  };
  if (min !== 0) {
    result = result && conditionMap.min;
  }
  if (max !== 0) {
    result = result && conditionMap.max;
  }

  return result;
};

export const checkClusterName = (value: string): boolean => {
  const re = new RegExp('^[A-Za-z0-9+-=._:@/ ]*$');
  return re.test(value);
};

export const checkIP = (value: string): boolean => {
  const re =
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return re.test(value);
};

export const checkCIDR = (value: string): boolean => {
  const re =
    /^(?:(?:[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}(?:[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\/([0-9]|[1-2]\d|3[0-2])$/;
  return re.test(value);
};

export const checkIpOrCIDR = (value: string): boolean => {
  // const re = new RegExp('^([0-9]{1,3}.){3}[0-9]{1,3}($|/(16|24)$)');
  // return re.test(value);
  return checkIP(value) || checkCIDR(value);
};

// Collection 名只能由数字、字母或 _ 组成
export const checkCollectionName = (value: string): boolean => {
  const re = /^[0-9,a-z,A-Z_]+$/;
  return re.test(value);
};

/**
 * 校验数据类型
 * @param type 数据类型，如 string、number
 * @param value
 * @returns value 的值是否等于 param 指定的类型
 */
export const checkType = (type: TypeEnum, value: string): boolean => {
  switch (type) {
    case TypeEnum.number:
      return !isNaN(Number(value));
    default:
      return true;
  }
};

/**
 * 校验输入的首字符
 * @param value
 * @param invalidTypes
 * @returns 首字符的类型是否不属于非法类型
 */
export const checkFirstCharacter = (param: {
  value: string;
  invalidTypes?: TypeEnum[];
}): boolean => {
  const { value, invalidTypes } = param;
  const start = value[0];
  const types = invalidTypes || [];
  for (let type of types) {
    const result = checkType(type, start);
    if (result) {
      return false;
    }
  }

  return true;
};

export const checkPartitionName = (value: string): boolean => {
  return value !== '_default';
};

export const checkMultiple = (param: {
  value: string;
  multipleNumber?: number;
}): boolean => {
  const { value, multipleNumber = 1 } = param;
  return Number(value) % multipleNumber === 0;
};

export const checkDimension = (param: {
  value: string;
  metricType?: METRIC_TYPES_VALUES;
  multipleNumber?: number;
}): boolean => {
  const { value, metricType, multipleNumber } = param;
  if (
    metricType === METRIC_TYPES_VALUES.IP ||
    metricType === METRIC_TYPES_VALUES.L2
  ) {
    return true;
  }
  return checkMultiple({ value, multipleNumber });
};

/**
 * 校验数值 value 是否等于指定值，或落在有效区间内
 * @param param 需要 specValue，以及 checkRange 所需参数
 * @returns 输入是否合法
 */
export const checkSpecValueOrRange = (param: {
  value: number;
  min: number;
  max: number;
  compareValue: number;
}): boolean => {
  const { value, min, max, compareValue } = param;
  return (
    value === compareValue || checkRange({ min, max, value, type: 'number' })
  );
};

export const checkDuplicate = (param: {
  value: string | number;
  compare: string | number;
}) => {
  return param.value !== param.compare;
};

export const checkBool = (value: string): boolean => {
  const v = String(value).toLowerCase();
  return v === 'true' || v === 'false';
};

export const checkNumber = (value: string): boolean => {
  return !isNaN(Number(value));
};

export const checkValueLength = (value: string, min: number, max: number) => {
  return value.length >= min && value.length <= max;
};

// 用户名不能为空，长度不超过 32 个字符。必须以字母开头，且只能包含下划线、字母或数字。
export const checkUserName = (value: string): boolean => {
  const re = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
  return re.test(value);
};

// 需包含以下 4 类字符中的 3 类：大写字母、小写字母、数字、特殊字符
export const checkCloudPassword = (value: string): boolean => {
  const re =
    /^(?![A-Za-z]+$)(?![A-Z\d]+$)(?![A-Z\W]+$)(?![a-z\d]+$)(?![a-z\W]+$)(?![\d\W]+$).{3,}$/;
  return re.test(value);
};

export const getCheckResult = (param: ICheckMapParam): boolean => {
  const { value, extraParam = {}, rule } = param;
  const numberValue = Number(value);

  const checkMap = {
    bool: checkBool(value),
    number: checkNumber(value),
    email: checkEmail(value),
    require: checkEmptyValid(value),
    confirm: value === extraParam?.compareValue,
    range: checkRange({
      value,
      min: extraParam?.min,
      max: extraParam?.max,
      type: extraParam?.type,
    }),
    password: checkPasswordStrength(value),
    cloudPassword: checkCloudPassword(value),
    clusterName: checkClusterName(value),
    CIDRorIP: checkIpOrCIDR(value),
    integer: !isNaN(numberValue) && Number.isInteger(numberValue),
    positiveNumber: !isNaN(numberValue) && numberValue > 0,
    collectionName: checkCollectionName(value),
    dimension: checkDimension({
      value,
      metricType: extraParam?.metricType,
      multipleNumber: extraParam?.multipleNumber,
    }),
    multiple: checkMultiple({
      value,
      multipleNumber: extraParam?.multipleNumber,
    }),
    partitionName: checkPartitionName(value),
    firstCharacter: checkFirstCharacter({
      value,
      invalidTypes: extraParam?.invalidTypes,
    }),
    specValueOrRange: checkSpecValueOrRange({
      value: Number(value),
      min: extraParam?.min || 0,
      max: extraParam?.max || 0,
      compareValue: Number(extraParam.compareValue) || 0,
    }),
    duplicate: checkDuplicate({ value, compare: extraParam.compareValue! }),
    valueLength: checkValueLength(value, extraParam.min!, extraParam.max!),
    username: checkUserName(value),
    custom:
      extraParam && typeof extraParam.compare === 'function'
        ? extraParam.compare(value)
        : true,
  };

  return checkMap[rule];
};

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
export const checkIndexBuilding = (v: CollectionObject): boolean => {
  return Boolean(
    v.schema &&
      v.schema?.fields.some(field => field.index?.state === 'InProgress')
  );
};
