import {
  IndexDescription,
  CollectionSchema,
  FieldSchema,
  ReplicaInfo,
  KeyValuePair,
  DescribeIndexResponse,
  DescribeCollectionResponse,
  QuerySegmentInfo,
  PersistentSegmentInfo,
  FunctionType,
  SearchResults,
} from '@zilliz/milvus2-sdk-node';
import { WS_EVENTS, WS_EVENTS_TYPE, LOADING_STATE } from '../utils';

export type FunctionObject = {
  name: string;
  description?: string;
  type: FunctionType;
  input_field_names: string[];
  output_field_names?: string[];
  params: Record<string, any>;
};

export interface IndexObject extends IndexDescription {
  indexType: string;
  metricType: string;
  indexParameterPairs: KeyValuePair[];
}
export interface FieldObject extends FieldSchema {
  index: IndexObject;
  // Field 类型参数
  dimension: number;
  maxCapacity: number;
  maxLength: number;
  function?: FunctionObject;
}

export interface SchemaObject extends CollectionSchema {
  fields: FieldObject[];
  primaryField: FieldObject;
  vectorFields: FieldObject[];
  scalarFields: FieldObject[];
  dynamicFields: FieldObject[];
  functionFields: FieldObject[];
  hasVectorIndex: boolean;
  enablePartitionKey: boolean;
}

export interface DescribeCollectionRes extends DescribeCollectionResponse {
  schema: SchemaObject;
}

export interface DescribeIndexRes extends DescribeIndexResponse {
  index_descriptions: IndexObject[];
}

export type CollectionFullObject = {
  collection_name: string;
  schema: SchemaObject;
  rowCount: number;
  createdTime: number;
  aliases: string[];
  description: string;
  autoID: boolean;
  id: string;
  loadedPercentage: number;
  consistency_level: string;
  replicas: ReplicaInfo[];
  status: LOADING_STATE;
  loaded: boolean;
  properties: KeyValuePair[];
  db_name: string;
};

export type CollectionLazyObject = {
  id: string;
  collection_name: string;
  status: LOADING_STATE;
  schema: undefined;
  rowCount: undefined;
  createdTime: number;
  aliases: undefined;
  /**
   * Schema 描述。showCollections 会省略它，因此 getAllCollections 会并发回填，
   * 因为 collection 列表需要从中解析 repo/branch 层级，否则首次渲染时
   * Branch 列会是空的。当 collection 没有描述或 describeCollection 失败时为空字符串。
   */
  description: string;
  autoID: undefined;
  loadedPercentage: undefined;
  consistency_level: undefined;
  replicas: undefined;
  loaded: undefined;
  properties: undefined;
  db_name: string;
};

export type CollectionObject = CollectionFullObject | CollectionLazyObject;

export type CountObject = {
  rowCount: number;
};

export type StatisticsObject = {
  collectionCount: number;
  totalData: number;
};

export type QuerySegmentObjects = QuerySegmentInfo[];
export type PersistentSegmentObjects = PersistentSegmentInfo[];

export type CronJobObject = {
  name: WS_EVENTS;
  type: WS_EVENTS_TYPE;
  payload: {
    database: string;
    collections: string[];
  };
};

export type DatabaseObject = {
  name: string;
  db_name: string;
  dbID: string | number;
  createdTime: number;
  created_timestamp: number;
  properties: KeyValuePair[];
  collections: string[];
};

export interface MmapChanges {
  fieldName: string;
  indexName: string;
  rawMmapEnabled?: boolean;
  indexMmapEnabled?: boolean;
}


export type VectorSearchResults = SearchResults & {
  latency: number;
}