import {
  SelectRoleResponse,
  ListCredUsersResponse,
  ListPrivilegeGroupsResponse,
  PrivelegeGroup,
} from '@zilliz/milvus2-sdk-node';

export type Users = ListCredUsersResponse;
export type UsersWithRoles = SelectRoleResponse;
export type UserWithRoles = {
  username: string;
  roles: string[];
};

export type RolesWithPrivileges = {
  roleName: string;
  privileges: DBCollectionsPrivileges;
};

export type PrivilegeGroupsRes = ListPrivilegeGroupsResponse;
export type PrivilegeGroup = PrivelegeGroup;

export type Privilege = {
  [key: string]: boolean; // key 为权限名，value 表示是否选中
};

export type CollectionPrivileges = {
  [collectionValue: string]: Privilege; // key 为 Collection 值，value 为权限集合
};

export type DBPrivileges = {
  collections: CollectionPrivileges; // Collection 级权限
};

export type DBCollectionsPrivileges = {
  [dbValue: string]: DBPrivileges; // key 为 Database 值，value 为 Database 权限与 Collection 集合
};

export type RBACOptions = {
  ClusterPrivilegeGroups: Record<string, unknown>;
  DatabasePrivilegeGroups: Record<string, unknown>;
  CollectionPrivilegeGroups: Record<string, unknown>;
  CustomPrivilegeGroups: Record<string, unknown>;
  CollectionPrivileges: Record<string, unknown>;
  DatabasePrivileges: Record<string, unknown>;
  EntityPrivileges: Record<string, unknown>;
  IndexPrivileges: Record<string, unknown>;
  PartitionPrivileges: Record<string, unknown>;
  RBACPrivileges: Record<string, unknown>;
  ResourceManagementPrivileges: Record<string, unknown>;
};
