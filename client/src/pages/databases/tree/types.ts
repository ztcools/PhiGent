import { Params } from 'react-router-dom';
import type { CollectionObject, DatabaseObject } from '@server/types';

export type TreeNodeType = 'db' | 'repo' | 'collection' | 'partition' | 'segment' | 'search';
export type TreeNodeObject = CollectionObject | DatabaseObject | null;

export interface DatabaseTreeItem {
  children?: DatabaseTreeItem[];
  id: string;
  name: string;
  type: TreeNodeType;
  expanded?: boolean;
  data?: CollectionObject;
}

export interface DatabaseTreeProps {
  database: string;
  collections: CollectionObject[];
  params: Readonly<Params<string>>;
  treeHeight?: number;
}

export type ContextMenu = {
  mouseX: number; // x 坐标
  mouseY: number; // y 坐标
  nodeId: string | null; // 节点 ID
  nodeType: TreeNodeType; // 节点类型
  object: TreeNodeObject; // 对象
};
