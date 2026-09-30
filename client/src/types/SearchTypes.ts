import { Option } from '@/components/customSelector/Types';
import { DataTypeEnum } from '@/consts';
import { FieldObject } from '@server/types';

export interface SearchParamsProps {
  // 若用户已创建 Index，则传入创建时选择的 metric type
  // 否则传空字符串
  metricType: string;
  // 用于获取 metric type 选项
  embeddingType: DataTypeEnum.FloatVector | DataTypeEnum.BinaryVector;
  // 默认 Index 类型为 FLAT
  indexType: string;
  // Index 额外参数，例如 nlist
  indexParams: { key: string; value: string }[];
  searchParamsForm: {
    [key in string]: number;
  };
  topK: number;
  handleFormChange: (form: { [key in string]: number }) => void;
  wrapperClass?: string;
  setParamsDisabled: (isDisabled: boolean) => void;
}

export interface SearchResultView {
  // 动态字段名
  [key: string]: string | number;
  rank: number;
  distance: number;
}

export interface FieldOption extends Option {
  field: FieldObject;
}

export interface SearchResult {
  // 动态字段名
  [key: string]: string | number;
  score: number;
}
