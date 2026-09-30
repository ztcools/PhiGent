import { ManageRequestMethods } from '@/consts';

// 删除与创建
export interface PartitionManageParam {
  collectionName: string;
  partitionName: string;
  type: ManageRequestMethods;
}

// 加载与释放
export interface PartitionParam {
  collectionName: string;
  partitionNames: string[];
}
