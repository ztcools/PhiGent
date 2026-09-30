import { Option } from '@/components/customSelector/Types';
import { FILE_MIME_TYPE } from '@/consts';
import type { PartitionData, CollectionObject } from '@server/types';
import { SchemaObject } from '@server/types';
import { InsertStatusEnum } from './consts';

export interface InsertContentProps {
  // 在 Partition 页面可选，因为该页的 Collection 是固定的
  collections?: CollectionObject[];
  // 在 Partition 页面必传，因为用户无法选择 Collection 来获取 Schema
  schema?: SchemaObject;
  // 在 Partition 页面必传
  partitions?: PartitionData[];

  // 插入时默认选中的 Collection
  // 若默认值不为 ''，则 Collection 不可选择
  defaultSelectedCollection: string;

  // 插入时默认选中的 Partition
  // 若默认值不为 ''，则 Partition 不可选择
  defaultSelectedPartition: string;

  onInsert: Function;
}

export interface InsertImportProps {
  // 选择器选项
  collectionOptions: Option[];
  partitionOptions: Option[];
  // 选择器选中值
  selectedCollection: string;
  selectedPartition: string;

  // 选择器的变更方法
  // Collection 不可选择时为可选
  handleCollectionChange?: (collectionName: string) => void;
  handlePartitionChange: (partitionName: string) => void;
  // 处理上传的数据
  handleUploadedData: (
    data: string,
    uploader: HTMLFormElement,
    type: FILE_MIME_TYPE
  ) => void;
  handleUploadFileChange: (file: File, uploader: HTMLFormElement) => void;
  fileName: string;
  setFileName: (fileName: string) => void;
}

export interface InsertPreviewProps {
  schemaOptions: Option[];
  data: any[];

  tableHeads: string[];
  setTableHeads: (heads: string[]) => void;

  isContainFieldNames: number;
  handleIsContainedChange: (isContained: number) => void;
  file: File | null; // CSV 文件
}

export interface InsertStatusProps {
  status: InsertStatusEnum;
  failMsg: string;
  importingCount: number;
}
