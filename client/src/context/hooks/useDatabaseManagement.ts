import { useState, useEffect, useContext, useCallback } from 'react';
import { DatabaseService } from '@/http';
import { authContext } from '@/context';
import type { DatabaseObject } from '@server/types';

export const useDatabaseManagement = () => {
  const { authReq, isAuth, logout, setAuthReq } = useContext(authContext);

  const [databases, setDatabases] = useState<DatabaseObject[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(true);
  const [database, setDatabase] = useState<string>(authReq.database);

  // API：获取 Database 列表
  const fetchDatabases = useCallback(
    async (updateLoading?: boolean): Promise<void> => {
      try {
        updateLoading && setLoadingDatabases(true);
        const newDatabases = await DatabaseService.listDatabases();
        if (newDatabases.length === 0) {
          return;
        }
        setDatabases(newDatabases);

        setDatabase(prev =>
          newDatabases.some(db => db.name === prev)
            ? prev
            : newDatabases[0].name
        );
      } catch (error) {
        console.error('Failed to fetch databases:', error);
      } finally {
        updateLoading && setLoadingDatabases(false);
      }
    },
    [logout]
  );

  // 认证后获取初始 Database 列表的 Effect
  useEffect(() => {
    if (isAuth) {
      if (database !== authReq.database) setDatabase(authReq.database);
      fetchDatabases(true);
    } else {
      // 未认证时清空数据
      setDatabases([]);
      setLoadingDatabases(false);
    }
  }, [isAuth, authReq.database, fetchDatabases]); // 已添加 fetchDatabases 依赖

  // 本地 database 状态变化时更新 auth context 的 Effect
  useEffect(() => {
    // 仅当 database 与 auth context 中的值确实不同时才更新
    if (authReq.database !== database && isAuth) {
      setAuthReq({ ...authReq, database });
    }
  }, [isAuth, database, authReq, setAuthReq]);

  return {
    databases,
    loadingDatabases,
    database,
    setDatabase,
    fetchDatabases,
  };
};
