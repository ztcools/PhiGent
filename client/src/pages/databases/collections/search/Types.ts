import type { FieldObject } from '@server/types';
import type { Option } from '@/components/customSelector/Types';
import type { SxProps, Theme } from '@mui/material';

export interface SearchParamsProps {
  // 默认索引类型为 FLAT
  indexType?: string;
  searchParamsForm: {
    [key in string]: number | string | boolean;
  };
  handleFormChange: (form: {
    [key in string]: number | string | boolean;
  }) => void;
  sx?: SxProps<Theme>;
  isManaged: boolean;
}

export interface SearchResultView {
  // 动态字段名
  [key: string]: any;
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
