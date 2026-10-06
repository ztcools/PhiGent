import { ReactNode } from 'react';
import { NavMenuItem } from '@/components/menu/Types';
import icons from '@/components/icons/Icons';
import Databases from '@/pages/databases/Databases';
import Users from '@/pages/user/UsersAndRoles';
import System from '@/pages/system/SystemView';
import Overview from '@/pages/home/Home';
import IndexTree from '@/pages/index-tree/IndexTree';
import GitLabRepos from '@/pages/gitlab/GitLabRepos';

// 路由路径常量
export const ROUTE_PATHS = {
  HOME: '/',
  DATABASES: 'databases',
  COLLECTIONS: 'collections',
  COLLECTION_DETAIL: 'collection-detail',
  USERS: 'users',
  ROLES: 'roles',
  PRIVILEGE_GROUPS: 'privilege-groups',
  SYSTEM: 'system',
  INDEX_TREE: 'index-tree',
  GITLAB: 'gitlab',
  CONNECT: 'connect',
} as const;

export type RoutePath = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS];

// 默认导航配置
const DEFAULT_NAV_CONFIG: NavConfig = {
  showDatabaseSelector: false,
  navTitleKey: '',
  useCollectionNameAsTitle: false,
  backPath: '',
};

export interface RouteConfig {
  path: string;
  element: ReactNode;
  children?: RouteConfig[];
}

export interface NavConfig {
  showDatabaseSelector?: boolean;
  navTitleKey?: string;
  useCollectionNameAsTitle?: boolean;
  backPath?: string;
}

export interface RouteItem {
  path: string;
  element: React.ComponentType;
  children?: RouteItem[];
  showInMenu?: boolean;
  menuConfig?: {
    icon: any;
    label: string;
    key: string;
  };
  requiresAuth?: boolean;
  showWhenNotManagedOrDedicated?: boolean;
  showWhenNotManaged?: boolean;
  navConfig?: NavConfig;
  routerType: RoutePath;
}

// Database 路由配置
const databaseRoutes: RouteItem[] = [
  {
    path: ROUTE_PATHS.DATABASES,
    element: Databases,
    showInMenu: true,
    menuConfig: {
      icon: icons.database,
      label: 'database',
      key: 'databases',
    },
    routerType: ROUTE_PATHS.DATABASES,
    navConfig: {
      showDatabaseSelector: true,
      useCollectionNameAsTitle: true,
    },
    children: [
      {
        path: ':databaseName',
        element: Databases,
        routerType: ROUTE_PATHS.COLLECTIONS,
        navConfig: {
          showDatabaseSelector: true,
          navTitleKey: 'collections',
        },
      },
      {
        path: ':databaseName/:databasePage',
        element: Databases,
        routerType: ROUTE_PATHS.DATABASES,
        navConfig: {
          showDatabaseSelector: true,
          navTitleKey: 'dbAdmin',
        },
      },
      {
        path: ':databaseName/:collectionName/:collectionPage',
        element: Databases,
        routerType: ROUTE_PATHS.COLLECTION_DETAIL,
        navConfig: {
          showDatabaseSelector: true,
          useCollectionNameAsTitle: true,
        },
      },
    ],
  },
];

// 用户管理路由
const userRoutes: RouteItem[] = [
  {
    path: ROUTE_PATHS.USERS,
    element: Users,
    showInMenu: true,
    menuConfig: {
      icon: icons.navPerson,
      label: 'user',
      key: 'users',
    },
    routerType: ROUTE_PATHS.USERS,
    navConfig: {
      navTitleKey: 'user',
    },
    showWhenNotManagedOrDedicated: true,
  },
  {
    path: ROUTE_PATHS.ROLES,
    element: Users,
    showInMenu: false,
    routerType: ROUTE_PATHS.USERS,
    navConfig: {
      navTitleKey: 'user',
      backPath: `/${ROUTE_PATHS.USERS}`,
    },
    showWhenNotManagedOrDedicated: true,
  },
  {
    path: ROUTE_PATHS.PRIVILEGE_GROUPS,
    element: Users,
    showInMenu: false,
    routerType: ROUTE_PATHS.USERS,
    navConfig: {
      navTitleKey: 'user',
      backPath: `/${ROUTE_PATHS.USERS}`,
    },
    showWhenNotManagedOrDedicated: true,
  },
];

// 其他路由
const otherRoutes: RouteItem[] = [
  {
    path: ROUTE_PATHS.HOME,
    element: Overview,
    showInMenu: true,
    menuConfig: {
      icon: icons.navOverview,
      label: 'overview',
      key: 'overview',
    },
    routerType: ROUTE_PATHS.HOME,
    navConfig: {
      navTitleKey: 'welcome',
    },
  },
  {
    path: ROUTE_PATHS.SYSTEM,
    element: System,
    showInMenu: true,
    menuConfig: {
      icon: icons.navSystem,
      label: 'system',
      key: 'system',
    },
    routerType: ROUTE_PATHS.SYSTEM,
    navConfig: {
      navTitleKey: 'system',
    },
    showWhenNotManaged: true,
  },
  {
    path: ROUTE_PATHS.INDEX_TREE,
    element: IndexTree,
    showInMenu: true,
    menuConfig: {
      icon: icons.list,
      label: 'indexTree',
      key: 'index-tree',
    },
    routerType: ROUTE_PATHS.INDEX_TREE,
    navConfig: {
      navTitleKey: 'indexTree',
    },
    showWhenNotManaged: true,
  },
  {
    path: ROUTE_PATHS.GITLAB,
    element: GitLabRepos,
    showInMenu: true,
    menuConfig: {
      icon: icons.source,
      label: 'gitlab',
      key: 'gitlab',
    },
    routerType: ROUTE_PATHS.GITLAB,
    navConfig: {
      navTitleKey: 'gitlab',
    },
    showWhenNotManaged: true,
  },
  {
    path: ROUTE_PATHS.CONNECT,
    element: () => null,
    showInMenu: false,
    requiresAuth: false,
    routerType: ROUTE_PATHS.HOME,
  },
];

// 合并所有路由。侧边栏菜单按此顺序渲染（Milvus WebUI 在 getMenuItems 中始终
// 追加到最后），因此自上而下期望的顺序为：
// 主页 → 数据库 → GitLab仓库 → 索引树 → 用户和角色 → 系统视图 → (Milvus WebUI)
const routeByPath = (arr: RouteItem[], path: string): RouteItem =>
  arr.find(route => route.path === path) as RouteItem;

export const routes: RouteItem[] = [
  routeByPath(otherRoutes, ROUTE_PATHS.HOME),
  ...databaseRoutes,
  routeByPath(otherRoutes, ROUTE_PATHS.GITLAB),
  routeByPath(otherRoutes, ROUTE_PATHS.INDEX_TREE),
  ...userRoutes,
  routeByPath(otherRoutes, ROUTE_PATHS.SYSTEM),
  // 非菜单路由（仅用于路由）
  routeByPath(otherRoutes, ROUTE_PATHS.CONNECT),
];

// 将导航配置与默认值合并的辅助函数
export const mergeNavConfig = (config?: NavConfig): NavConfig => ({
  ...DEFAULT_NAV_CONFIG,
  ...config,
});

export const getMenuItems = (
  isManaged: boolean,
  isDedicated: boolean,
  database: string,
  navTrans: (key: string) => string,
  navigate: (path: string) => void,
  authReq?: { address: string }
): NavMenuItem[] => {
  const menuItems = routes
    .filter(route => {
      if (!route.showInMenu) return false;
      if (route.showWhenNotManagedOrDedicated && !(!isManaged || isDedicated))
        return false;
      if (route.showWhenNotManaged && isManaged) return false;
      return true;
    })
    .map(route => {
      const menuItem: NavMenuItem = {
        icon: route.menuConfig?.icon,
        label: navTrans(route.menuConfig?.label || ''),
        key: route.menuConfig?.key,
        onClick: () => {
          if (route.path === ROUTE_PATHS.DATABASES) {
            navigate(`/${ROUTE_PATHS.DATABASES}/${database}/collections`);
          } else {
            navigate(`/${route.path}`);
          }
        },
      };
      return menuItem;
    });

  // 为非托管实例添加 Milvus WebUI 菜单项
  if (!isManaged && authReq?.address) {
    menuItems.push({
      icon: icons.newWindow,
      label: 'Milvus WebUI',
      onClick: () => {
        window.open(
          `http://${authReq.address.split(':')[0]}:9091/webui`,
          '_blank'
        );
      },
    });
  }

  return menuItems;
};

export const getRoutes = (
  isManaged: boolean,
  isDedicated: boolean
): RouteItem[] => {
  return routes.filter(route => {
    if (route.showWhenNotManagedOrDedicated && !(!isManaged || isDedicated))
      return false;
    if (route.showWhenNotManaged && isManaged) return false;
    return true;
  });
};
