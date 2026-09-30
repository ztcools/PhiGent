import BaseModel from './BaseModel';
import type {
  RolesWithPrivileges,
  PrivilegeGroup,
  PrivilegeGroupsRes,
  UserWithRoles,
  RBACOptions,
} from '@server/types';
import type {
  CreateUserParams,
  DeleteUserParams,
  UpdateUserParams,
  CreateRoleParams,
  DeleteRoleParams,
  AssignRoleParams,
  UnassignRoleParams,
  CreatePrivilegeGroupParams,
} from '../pages/user/Types';

export class UserService extends BaseModel {
  // 获取用户数据
  static getUsers() {
    return super.find<UserWithRoles[]>({ path: `/users`, params: {} });
  }

  // 获取所有角色
  static getRoles() {
    return super.find<RolesWithPrivileges[]>({
      path: `/users/roles`,
      params: {},
    });
  }

  // 创建用户
  static createUser(data: CreateUserParams) {
    return super.create({ path: `/users`, data });
  }

  // 更新用户密码
  static updateUser(data: UpdateUserParams) {
    return super.update({ path: `/users`, data });
  }

  // 删除用户
  static deleteUser(data: DeleteUserParams) {
    return super.delete({ path: `/users/${data.username}` });
  }

  // 更新用户角色
  static updateUserRole(data: AssignRoleParams) {
    return super.update({
      path: `/users/${data.username}/role/update`,
      data,
    });
  }

  // 取消分配用户角色
  static unassignUserRole(data: UnassignRoleParams) {
    return super.update({
      path: `/users/${data.username}/role/unassign`,
      data,
    });
  }

  // 创建角色
  static createRole(data: CreateRoleParams) {
    return super.create({ path: `/users/roles`, data });
  }

  // 删除角色
  static deleteRole(data: DeleteRoleParams) {
    return super.delete({ path: `/users/roles/${data.roleName}`, data });
  }

  // 更新角色权限
  static updateRolePrivileges(data: CreateRoleParams) {
    return super.update({
      path: `/users/roles/${data.roleName}/updatePrivileges`,
      data,
    });
  }

  // 获取 RBAC 信息
  static getAllPrivilegeGroups() {
    return super.find({
      path: `/users/privilegeGroups`,
      params: {},
    }) as Promise<PrivilegeGroup[]>;
  }

  // 获取 RBAC 信息
  static getRBAC() {
    return super.find({
      path: `/users/rbac`,
      params: {},
    }) as Promise<RBACOptions>;
  }
  // 获取权限组
  static getPrivilegeGroups() {
    return super.find<PrivilegeGroupsRes>({
      path: `/users/privilege-groups`,
      params: {},
    });
  }
  // 创建权限组
  static createPrivilegeGroup(data: CreatePrivilegeGroupParams) {
    return super.create({ path: `/users/privilege-groups`, data });
  }
  // 更新权限组
  static updatePrivilegeGroup(data: CreatePrivilegeGroupParams) {
    return super.update({
      path: `/users/privilege-groups/${data.group_name}`,
      data,
    });
  }
  // 删除权限组
  static deletePrivilegeGroup(data: { group_name: string }) {
    return super.delete({ path: `/users/privilege-groups/${data.group_name}` });
  }
}
