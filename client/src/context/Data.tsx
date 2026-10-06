import { createContext, useContext, useEffect } from 'react';
import { authContext } from '@/context';
import { DEFAULT_TREE_WIDTH } from '@/consts';
import { useUIPrefs } from '@/context/hooks/useUIPrefs';
import { useWebSocket } from '@/context/hooks/useWebSocket';
import { useDatabaseManagement } from '@/context/hooks/useDatabaseManagement';
import { useCollectionsManagement } from '@/context/hooks/useCollectionsManagement';
import type { DataContextType } from './Types';

export const dataContext = createContext<DataContextType>({
  loading: true,
  loadingDatabases: true,
  collections: [],
  setCollections: () => {},
  database: '',
  setDatabase: () => {},
  databases: [],
  fetchDatabases: async () => {},
  fetchCollections: async () => {},
  fetchCollection: async () => {},
  batchRefreshCollections: async () => {},
  isBatchRefreshing: false,
  ui: {
    tree: {
      width: DEFAULT_TREE_WIDTH,
    },
  },
  setUIPref: () => {},
});

const { Provider } = dataContext;

export const DataProvider = (props: { children: React.ReactNode }) => {
  // 认证 Context
  const { clientId } = useContext(authContext);

  // UI 偏好 Hook
  const { ui, setUIPref } = useUIPrefs();

  // Database Hook
  const { databases, loadingDatabases, database, setDatabase, fetchDatabases } =
    useDatabaseManagement();

  // useCollections Hook
  const {
    collections,
    setCollections,
    loading,
    fetchCollections,
    fetchCollection,
    batchRefreshCollections,
    updateCollections,
    isBatchRefreshing,
  } = useCollectionsManagement(database);

  // WebSocket Hook
  const { connected } = useWebSocket({
    isAuth: !!clientId,
    clientId,
    database,
    onCollectionUpdate: updateCollections,
  });

  // 连接建立或 Database 变化时拉取 Collection 的副作用
  useEffect(() => {
    if (connected) {
      fetchCollections();
    } else {
      setCollections([]);
    }
  }, [connected, database, fetchCollections, setCollections]);

  return (
    <Provider
      value={{
        loading,
        loadingDatabases,
        collections,
        setCollections,
        database,
        databases,
        setDatabase,
        fetchCollection,
        fetchDatabases,
        fetchCollections,
        batchRefreshCollections,
        isBatchRefreshing,
        ui,
        setUIPref,
      }}
    >
      {props.children}
    </Provider>
  );
};
