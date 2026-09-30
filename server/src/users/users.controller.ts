import { NextFunction, Request, Response, Router } from 'express';
import { dtoValidationMiddleware } from '../middleware/validation';
import { UserService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  CreateRoleDto,
  AssignUserRoleDto,
  UnassignUserRoleDto,
  UpdatePrivilegeGroupDto,
  CreatePrivilegeGroupDto,
  PrivilegeToRoleDto,
} from './dto';
import type {
  DBCollectionsPrivileges,
  RolesWithPrivileges,
} from '../types/users.type';
import {
  DatabasePrivileges,
  CollectionPrivileges,
  PartitionPrivileges,
  IndexPrivileges,
  EntityPrivileges,
  ResourceManagementPrivileges,
  RBACPrivileges,
} from '../utils';
import { ErrorCode } from '@zilliz/milvus2-sdk-node';

export class UserController {
  private router: Router;
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
    this.router = Router();
  }

  generateRoutes() {
    // 用户
    this.router.get('/', this.getUsers.bind(this));
    this.router.post(
      '/',
      dtoValidationMiddleware(CreateUserDto),
      this.createUsers.bind(this)
    );
    this.router.put(
      '/',
      dtoValidationMiddleware(UpdateUserDto),
      this.updateUsers.bind(this)
    );
    this.router.delete('/:username', this.deleteUser.bind(this));
    this.router.put(
      '/:username/role/update',
      dtoValidationMiddleware(AssignUserRoleDto),
      this.updateUserRole.bind(this)
    );
    this.router.put(
      '/:username/role/unassign',
      dtoValidationMiddleware(UnassignUserRoleDto),
      this.unassignUserRole.bind(this)
    );

    // 角色
    this.router.get('/rbac', this.rbac.bind(this));
    this.router.get(
      '/privilegeGroups',
      this.getDefaultPriviegGroups.bind(this)
    );
    this.router.get('/roles', this.getRoles.bind(this));
    this.router.post(
      '/roles',
      dtoValidationMiddleware(CreateRoleDto),
      this.createRole.bind(this)
    );
    this.router.get('/roles/:roleName', this.listGrant.bind(this));
    this.router.delete('/roles/:roleName', this.deleteRole.bind(this));
    this.router.put(
      '/roles/:roleName/updatePrivileges',
      this.updateRolePrivileges.bind(this)
    );

    // 权限组
    this.router.get('/privilege-groups', this.getPrivilegeGrps.bind(this));
    this.router.get(
      '/privilege-groups/:group_name',
      this.getPrivilegeGrp.bind(this)
    );
    this.router.post(
      '/privilege-groups',
      dtoValidationMiddleware(CreatePrivilegeGroupDto),
      this.createPrivilegeGrp.bind(this)
    );
    this.router.put(
      '/privilege-groups/:group_name',
      dtoValidationMiddleware(UpdatePrivilegeGroupDto),
      this.updatePrivilegeGrp.bind(this)
    );
    this.router.delete(
      '/privilege-groups/:group_name',
      this.deletePrivilegeGrp.bind(this)
    );

    return this.router;
  }

  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await this.userService.getUsers(req.clientId);

      const results = [];
      for (let i = 0; i < result.usernames.length; i++) {
        const username = result.usernames[i];
        const roles = await this.userService.selectUser(req.clientId, {
          username,
          includeRoleInfo: true,
        });
        results.push({
          username,
          roles: roles.results[0].roles.map(r => r.name),
        });
        if (username === 'root') {
          // 把刚插入的 root 用户取出，插到结果数组开头
          const rootUser = results.pop();
          results.unshift(rootUser);
        }
      }

      res.send(results);
    } catch (error) {
      next(error);
    }
  }

  async createUsers(
    req: Request<{}, {}, CreateUserDto>,
    res: Response,
    next: NextFunction
  ) {
    const { username, password } = req.body;
    try {
      const result = await this.userService.createUser(req.clientId, {
        username,
        password,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async updateUsers(
    req: Request<{}, {}, UpdateUserDto>,
    res: Response,
    next: NextFunction
  ) {
    const { username, oldPassword, newPassword } = req.body;
    try {
      const result = await this.userService.updateUser(req.clientId, {
        username,
        oldPassword,
        newPassword,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(
    req: Request<{ username: string }>,
    res: Response,
    next: NextFunction
  ) {
    const { username } = req.params;
    try {
      const result = await this.userService.deleteUser(req.clientId, {
        username,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async getRoles(req: Request, res: Response, next: NextFunction) {
    try {
      // 获取所有角色
      const rolesResult = await this.userService.getRoles(req.clientId);

      // 初始化结果数组
      const rolesWithPrivileges: RolesWithPrivileges[] = [];

      // 遍历每个角色
      for (let i = 0; i < rolesResult.results.length; i++) {
        const roleName = rolesResult.results[i].role.name;

        // 获取当前角色已有的授权
        const grantsResponse = await this.userService.listGrants(
          req.clientId,
          roleName
        );

        // 初始化当前角色的权限结构
        const dbCollectionsPrivileges: DBCollectionsPrivileges = {};

        // 遍历每个授权实体
        for (const entity of grantsResponse.entities) {
          const { db_name, object_name, grantor } = entity;

          // Database 条目不存在则初始化
          if (!dbCollectionsPrivileges[db_name]) {
            dbCollectionsPrivileges[db_name] = {
              collections: {},
            };
          }

          // Collection 条目不存在则初始化
          if (!dbCollectionsPrivileges[db_name].collections[object_name]) {
            dbCollectionsPrivileges[db_name].collections[object_name] = {};
          }

          // 把权限加到该 Collection 上
          dbCollectionsPrivileges[db_name].collections[object_name][
            grantor.privilege.name
          ] = true;
        }

        // 把角色及其权限加入结果数组
        rolesWithPrivileges.push({
          roleName,
          privileges: dbCollectionsPrivileges,
        });
      }

      // 返回转换后的结果
      res.status(200).json(rolesWithPrivileges);
    } catch (error) {
      // 把错误交给错误处理中间件
      next(error);
    }
  }

  async createRole(
    req: Request<{}, {}, CreateRoleDto>,
    res: Response,
    next: NextFunction
  ) {
    const { roleName } = req.body;
    try {
      const result = await this.userService.createRole(req.clientId, {
        roleName,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async deleteRole(
    req: Request<{ roleName: string }, {}, { force?: boolean }>,
    res: Response,
    next: NextFunction
  ) {
    const { roleName } = req.params;
    const { force } = req.body;

    try {
      if (force) {
        await this.userService.revokeAllRolePrivileges(req.clientId, {
          roleName,
        });
      }
      const result = await this.userService.deleteRole(req.clientId, {
        roleName,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async updateUserRole(
    req: Request<{ username: string }, {}, AssignUserRoleDto>,
    res: Response,
    next: NextFunction
  ) {
    const { username } = req.params;
    const { roles } = req.body;

    const results = [];

    try {
      // 获取用户已有的角色
      const selectUser = await this.userService.selectUser(req.clientId, {
        username,
        includeRoleInfo: false,
      });

      const existingRoles = selectUser.results[0].roles;
      // 移除用户已有的角色
      for (let i = 0; i < existingRoles.length; i++) {
        if (existingRoles[i].name.length > 0) {
          await this.userService.unassignUserRole(req.clientId, {
            username,
            roleName: existingRoles[i].name,
          });
        }
      }

      // 为用户分配新角色
      for (let i = 0; i < roles.length; i++) {
        const result = await this.userService.assignUserRole(req.clientId, {
          username,
          roleName: roles[i],
        });
        results.push(result);
      }

      res.send(results);
    } catch (error) {
      next(error);
    }
  }

  async unassignUserRole(
    req: Request<{ username: string }, {}, UnassignUserRoleDto>,
    res: Response,
    next: NextFunction
  ) {
    const { username } = req.params;
    const { roleName } = req.body;

    try {
      const result = await this.userService.unassignUserRole(req.clientId, {
        username,
        roleName,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async rbac(req: Request, res: Response, next: NextFunction) {
    try {
      const privilegeGrps = await this.userService.getPriviegGroups(
        req.clientId
      );

      const ClusterPrivilegeGroups = {} as any;
      const DatabasePrivilegeGroups = {} as any;
      const CollectionPrivilegeGroups = {} as any;
      const CustomPrivilegeGroups = {} as any;

      privilegeGrps.cluster.forEach((g: any) => {
        ClusterPrivilegeGroups[g.group_name] = g.group_name;
      });

      privilegeGrps.db.forEach((g: any) => {
        DatabasePrivilegeGroups[g.group_name] = g.group_name;
      });

      privilegeGrps.collection.forEach((g: any) => {
        CollectionPrivilegeGroups[g.group_name] = g.group_name;
      });

      privilegeGrps.custom.forEach((g: any) => {
        CustomPrivilegeGroups[g.group_name] = g.group_name;
      });

      const result = {
        ClusterPrivilegeGroups,
        DatabasePrivilegeGroups,
        CollectionPrivilegeGroups,
        CustomPrivilegeGroups,
        DatabasePrivileges,
        ResourceManagementPrivileges,
        RBACPrivileges,
        CollectionPrivileges,
        PartitionPrivileges,
        IndexPrivileges,
        EntityPrivileges,
      };

      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async getDefaultPriviegGroups(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await this.userService.getPriviegGroups(req.clientId);
      res.send(result.default);
    } catch (error) {
      next(error);
    }
  }

  async listGrant(
    req: Request<{ roleName: string }>,
    res: Response,
    next: NextFunction
  ) {
    const { roleName } = req.params;
    try {
      const result = await this.userService.listGrants(req.clientId, {
        roleName,
        db_name: '*',
      } as any);
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async updateRolePrivileges(
    req: Request<
      { roleName: string },
      {},
      { privileges: DBCollectionsPrivileges }
    >,
    res: Response,
    next: NextFunction
  ) {
    const { privileges } = req.body;
    const { roleName } = req.params;
    const clientId = req.clientId;

    const results = [];
    const rollbackStack = []; // 用于失败时回滚的操作栈

    try {
      // 检查角色是否存在
      const hasRole = await this.userService.hasRole(clientId, {
        roleName,
      });
      // 角色不存在则先创建
      if (hasRole.hasRole === false) {
        const res = await this.userService.createRole(clientId, { roleName });

        // 创建角色失败时向上抛出错误
        if (res.error_code !== ErrorCode.SUCCESS) {
          throw new Error(res.reason);
        }
      }

      // 遍历每个 Database
      for (const [dbName, dbPrivileges] of Object.entries(privileges)) {
        // 遍历该 Database 下的每个 Collection
        for (const [collectionName, collectionPrivileges] of Object.entries(
          dbPrivileges.collections
        )) {
          // 遍历该 Collection 下的每个权限
          for (const [privilegeName, isGranted] of Object.entries(
            collectionPrivileges
          )) {
            const requestData = {
              role: roleName,
              privilege: privilegeName,
              db_name: dbName,
              collection_name: collectionName,
            };

            let result;
            try {
              if (isGranted) {
                // 权限为 true 时调用 grantPrivilegeV2
                result = await this.userService.grantPrivilegeV2(
                  clientId,
                  requestData
                );
                // 把反向操作（revoke）压入回滚栈
                rollbackStack.push({ action: 'revoke', data: requestData });
              } else {
                // 权限为 false 时调用 revokePrivilegeV2
                result = await this.userService.revokePrivilegeV2(
                  clientId,
                  requestData
                );
                // 把反向操作（grant）压入回滚栈
                rollbackStack.push({ action: 'grant', data: requestData });
              }

              // 收集结果
              results.push({
                dbName,
                collectionName,
                privilegeName,
                isGranted,
                result,
              });
            } catch (error) {
              // 出错时记录日志并开始回滚
              console.error(
                `Failed to update privilege: ${privilegeName} for collection: ${collectionName} in database: ${dbName}`,
                error
              );

              // 回滚此前已生效的所有变更
              while (rollbackStack.length > 0) {
                const { action, data } = rollbackStack.pop();
                try {
                  if (action === 'grant') {
                    await this.userService.grantPrivilegeV2(clientId, data);
                  } else if (action === 'revoke') {
                    await this.userService.revokePrivilegeV2(clientId, data);
                  }
                } catch (rollbackError) {
                  console.error(
                    `Rollback failed for action: ${action} on privilege: ${data.privilege}`,
                    rollbackError
                  );
                }
              }

              // 角色创建失败时删除该角色
              await this.userService.deleteRole(clientId, { roleName });

              // 把错误抛给错误处理器
              throw error;
            }
          }
        }
      }

      // 全部成功时返回结果
      res.status(200).json({ results });
    } catch (error) {
      // 把错误交给错误处理中间件
      next(error);
    }
  }

  async createPrivilegeGrp(
    req: Request<{}, {}, CreatePrivilegeGroupDto>,
    res: Response,
    next: NextFunction
  ) {
    const { group_name, privileges } = req.body;
    try {
      // 创建权限组
      await this.userService.createPrivilegeGroup(req.clientId, {
        group_name,
      });

      // 向权限组中添加权限
      const result = await this.userService.addPrivilegeToGroup(req.clientId, {
        group_name,
        privileges,
      });

      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async deletePrivilegeGrp(
    req: Request<{ group_name: string }>,
    res: Response,
    next: NextFunction
  ) {
    const { group_name } = req.params;
    try {
      const result = await this.userService.deletePrivilegeGroup(req.clientId, {
        group_name,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async getPrivilegeGrp(
    req: Request<{ group_name: string }>,
    res: Response,
    next: NextFunction
  ) {
    const { group_name } = req.params;
    try {
      const result = await this.userService.getPrivilegeGroup(req.clientId, {
        group_name,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async getPrivilegeGrps(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await this.userService.getPrivilegeGroups(req.clientId);
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async updatePrivilegeGrp(
    req: Request<{ group_name: string }, {}, UpdatePrivilegeGroupDto>,
    res: Response,
    next: NextFunction
  ) {
    // 获取权限组
    const { group_name } = req.params;
    const { privileges } = req.body;
    // 获取已有的权限组
    const theGroup = await this.userService.getPrivilegeGroup(req.clientId, {
      group_name,
    });

    // 未找到权限组则返回错误
    if (!theGroup) {
      return next(new Error('Group not found'));
    }

    try {
      // 移除权限组中的所有权限
      await this.userService.removePrivilegeFromGroup(req.clientId, {
        group_name,
        privileges: theGroup.privileges.map(p => p.name),
      });

      // 向权限组中添加新的权限
      const result = await this.userService.addPrivilegeToGroup(req.clientId, {
        group_name,
        privileges,
      });

      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async assignRolePrivilege(
    req: Request<{}, {}, PrivilegeToRoleDto>,
    res: Response,
    next: NextFunction
  ) {
    const { role, collection, privilege } = req.body;
    try {
      const result = await this.userService.grantPrivilegeV2(req.clientId, {
        role,
        collection_name: collection || '*',
        db_name: req.db_name,
        privilege,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }

  async revokeRolePrivilege(
    req: Request<{}, PrivilegeToRoleDto>,
    res: Response,
    next: NextFunction
  ) {
    const { role, collection, privilege } = req.body;
    try {
      const result = await this.userService.revokePrivilegeV2(req.clientId, {
        role,
        collection_name: collection || '*',
        db_name: req.db_name,
        privilege,
      });
      res.send(result);
    } catch (error) {
      next(error);
    }
  }
}
