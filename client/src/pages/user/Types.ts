import { Option as RoleOption } from '@/components/customSelector/Types';
import type {
  DBCollectionsPrivileges,
  RBACOptions,
} from '@server/types/users.type';

export interface CreateUserParams {
  username: string;
  password: string;
  roles: string[];
}

export interface UpdateUserRoleParams {
  username: string;
  roles: string[];
}

export interface UpdateUserRoleProps {
  onUpdate: (data: UpdateUserRoleParams) => void;
  handleClose: () => void;
  username: string;
  roles: string[];
}

export interface CreateUserProps {
  handleCreate: (data: CreateUserParams) => void;
  handleClose: () => void;
  roleOptions: RoleOption[];
}

export interface UpdateUserProps {
  onUpdate: (res: any) => void;
  handleClose: () => void;
  username: string;
}

export interface UpdateUserParams {
  oldPassword: string;
  newPassword: string;
  username: string;
}

export interface DeleteUserParams {
  username: string;
}

export interface CreateRoleParams {
  roleName: string;
  privileges: DBCollectionsPrivileges;
}

export interface CreatePrivilegeGroupParams {
  group_name: string;
  privileges: string[];
}

export type RoleData = {
  roleName: string;
  privileges: DBCollectionsPrivileges;
};

export interface CreateRoleProps {
  onUpdate: (data: { data: CreateRoleParams; isEditing: boolean }) => void;
  handleClose: () => void;
  role: RoleData;
  sameAs?: boolean;
}

export interface DeleteRoleParams {
  roleName: string;
  force?: boolean;
}

export interface AssignRoleParams {
  username: string;
  roles: string[];
}

export interface UnassignRoleParams extends AssignRoleParams {}

export type CollectionOption = {
  name: string;
  value: string;
};

export type DBOption = {
  name: string;
  value: string;
};

export interface DBCollectionsSelectorProps {
  selected: DBCollectionsPrivileges; // 当前选中的 Database 及其拥有权限的 Collection
  setSelected: (
    value:
      | DBCollectionsPrivileges
      | ((prev: DBCollectionsPrivileges) => DBCollectionsPrivileges)
  ) => void;
  // 更新选中状态的回调
  options: {
    rbacOptions: RBACOptions; // 可用的 RBAC 选项（权限）
    dbOptions: DBOption[]; // 可用的 Database
  };
}

export interface PrivilegeGrpOptionsProps {
  options: string[];
  selection: string[];
  onChange: (data: string[]) => void;
  group_name: string;
}
