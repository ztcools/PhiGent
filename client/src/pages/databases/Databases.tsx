import { useContext, useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigationHook } from '@/hooks';
import DatabaseTree from '@/pages/databases/tree';
import { dataContext } from '@/context';
import StatusIcon from '@/components/status/StatusIcon';
import { ConsistencyLevelEnum, DYNAMIC_FIELD } from '@/consts';
import { ROUTE_PATHS } from '@/config/routes';
import { LoadingType } from '@/components/status/StatusIcon';
import type { SearchParams, QueryState } from './types';
import { DatabasesTab } from './DatabasesTab';
import { CollectionsTabs } from './CollectionsTab';
import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

const DEFAULT_TREE_WIDTH = 230;
const MAX_TREE_WIDTH = 500; // 树可拖拽的最大宽度

const PageWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  padding: theme.spacing(1.5),
  height: 'calc(100vh - 64px)',
  overflow: 'hidden',
  '&.dragging': {
    cursor: 'ew-resize',
    '& .tree': {
      pointerEvents: 'none',
      userSelect: 'none',
    },
    '& .tab': {
      pointerEvents: 'none',
      userSelect: 'none',
    },
    '& .dragger': {
      background: theme.palette.divider,
    },
  },
}));

const TreeSection = styled(Box)(({ theme }) => ({
  flexGrow: 0,
  flexShrink: 0,
  height: 'calc(100vh - 54px)',
  overflowY: 'auto',
  overflowX: 'hidden',
  boxSizing: 'border-box',
  paddingRight: 8,
  position: 'relative',
}));

const Dragger = styled(Box)(({ theme }) => ({
  pointerEvents: 'auto',
  position: 'absolute',
  top: 0,
  right: 0,
  width: 2,
  height: '100%',
  background: 'transparent',
  cursor: 'ew-resize',
  '&:hover': {
    width: 2,
    cursor: 'ew-resize',
    background: theme.palette.divider,
  },
}));

const TabSection = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  flexShrink: 1,
  overflow: 'hidden',
  padding: theme.spacing(0, 1.5),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 4,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.paper,
}));

// 数据库页面（左侧树 + 右侧标签页）
const Databases = () => {
  // 上下文
  const { database, collections, loading, ui, setUIPref } =
    useContext(dataContext);

  // UI 状态
  const [searchParams, setSearchParams] = useState<SearchParams[]>([]);
  const [queryState, setQueryState] = useState<QueryState[]>([]);

  // 树的 ref
  const [isDragging, setIsDragging] = useState(false);
  const treeRef = useRef<HTMLDivElement>(null);
  const draggerRef = useRef<HTMLDivElement>(null);

  // 支持拖拽调整树的宽度
  useEffect(() => {
    // 本地维护的树宽度
    let treeWidth = 0;
    const handleMouseMove = (e: MouseEvent) => {
      requestAnimationFrame(() => {
        // 获取鼠标位置
        let mouseX = e.clientX - treeRef.current!.offsetLeft;

        // 限制最小和最大宽度
        treeWidth = Math.max(1, Math.min(mouseX, MAX_TREE_WIDTH));

        // 设置树宽度
        setUIPref({ tree: { width: treeWidth } });
        setIsDragging(true);
      });
    };

    const handleMouseUp = () => {
      // 取消拖拽状态
      setIsDragging(false);
      // 宽度为 1 时始终高亮拖拽条
      if (draggerRef.current) {
        draggerRef.current.classList.toggle('tree-collapsed', treeWidth === 1);
      }
      document.removeEventListener('mousemove', handleMouseMove);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLDivElement;
      if (t && t.dataset.id === 'dragger') {
        // 进入拖拽状态
        setIsDragging(true);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        e.stopPropagation();
      }
    };

    // 注册事件监听
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      // 移除事件监听
      document.removeEventListener('mousedown', handleMouseDown);
      // 取消拖拽状态
      setIsDragging(false);
    };
  }, [isDragging]);

  // 双击拖拽条恢复默认宽度
  const handleDoubleClick = () => {
    draggerRef.current!.classList.toggle('tree-collapsed', false);
    setUIPref({ tree: { width: DEFAULT_TREE_WIDTH } });
  };

  // 初始化搜索参数和查询状态
  useEffect(() => {
    collections.forEach(c => {
      // 查找该 collection 的搜索参数
      const searchParam = searchParams.find(
        s => s.collection.collection_name === c.collection_name
      );

      // 若未找到搜索参数且 Schema 已就绪，则新建搜索参数
      if (!searchParam && c.schema) {
        setSearchParams(prevParams => {
          const scalarFields = c.schema.scalarFields.map(s => s.name);

          return [
            ...prevParams,
            {
              collection: c,
              partitions: [],
              searchParams: c.schema.vectorFields.map(v => {
                return {
                  anns_field: v.name,
                  params: {},
                  data: '',
                  expanded: c.schema.vectorFields.length === 1,
                  field: v,
                  selected: c.schema.vectorFields.length === 1,
                };
              }),
              globalParams: {
                topK: 15,
                consistency_level: ConsistencyLevelEnum.Bounded,
                filter: '',
                rerank: 'rrf',
                rrfParams: { k: 60 },
                weightedParams: {
                  weights: Array(c.schema.vectorFields.length).fill(0.5),
                },
                output_fields: c.schema.enable_dynamic_field
                  ? [...scalarFields, DYNAMIC_FIELD]
                  : scalarFields,
              },
              searchResult: null,
              graphData: { nodes: [], links: [] },
              searchLatency: 0,
            },
          ];
        });
      } else {
        // 更新 collection
        setSearchParams(prevParams => {
          return prevParams.map(s => {
            if (s.collection.collection_name === c.collection_name) {
              // 更新搜索参数中的 field
              const searchParams = s.searchParams.map(sp => {
                const field = c.schema?.vectorFields.find(
                  v => v.name === sp.anns_field
                );
                if (field) {
                  return { ...sp, field };
                }
                return sp;
              });
              // 更新 collection
              const collection = c;
              return { ...s, searchParams, collection };
            }
            return s;
          });
        });
      }

      // 查找该 collection 的查询状态
      const query = queryState.find(
        q => q.collection.collection_name === c.collection_name
      );

      // 若未找到查询状态且 Schema 已就绪，则新建查询状态
      if (!query && c.schema) {
        setQueryState(prevState => {
          const fields = c.schema.fields;
          return [
            ...prevState,
            {
              collection: c,
              expr: '',
              fields: fields,
              outputFields: fields.map(f => f.name),
              consistencyLevel: ConsistencyLevelEnum.Bounded,
              tick: 0,
            },
          ];
        });
      } else {
        // 更新 collection
        setQueryState(prevState => {
          return prevState.map(q => {
            if (q.collection.collection_name === c.collection_name) {
              // 更新 collection
              const collection = c;
              return { ...q, collection };
            }
            return q;
          });
        });
      }
    });

    // 删除已不在 collections 中的 collection 对应的搜索参数
    setSearchParams(prevParams => {
      return prevParams.filter(s =>
        collections.find(
          c => c.collection_name === s.collection.collection_name
        )
      );
    });

    // 删除已不在 collections 中的 collection 对应的查询状态
    setQueryState(prevState => {
      return prevState.filter(q =>
        collections.find(
          c => c.collection_name === q.collection.collection_name
        )
      );
    });
  }, [collections]);

  // 从 URL 中获取当前 collection
  const params = useParams();
  const {
    databaseName = '',
    collectionName = '',
    collectionPage = '',
    databasePage = '',
  } = params;

  // 更新导航
  useNavigationHook(ROUTE_PATHS.DATABASES, {
    collectionName,
    databaseName,
  });

  const setCollectionSearchParams = (params: SearchParams) => {
    setSearchParams(prevParams => {
      return prevParams.map(s => {
        if (
          s.collection.collection_name === params.collection.collection_name
        ) {
          return { ...params };
        }
        return s;
      });
    });
  };

  const setCollectionQueryState = (state: QueryState) => {
    setQueryState(prevState => {
      return prevState.map(q => {
        if (q.collection.collection_name === state.collection.collection_name) {
          return { ...state };
        }
        return q;
      });
    });
  };

  // 渲染
  return (
    <PageWrapper className={isDragging ? 'dragging' : ''}>
      <TreeSection
        className="tree"
        ref={treeRef}
        style={{ width: ui.tree.width }}
      >
        {loading ? (
          <StatusIcon type={LoadingType.CREATING} />
        ) : (
          <DatabaseTree
            key="collections"
            collections={collections}
            database={database}
            params={params}
          />
        )}
        <Dragger
          className="dragger"
          data-id="dragger"
          onDoubleClick={handleDoubleClick}
          ref={draggerRef}
        />
      </TreeSection>
      {!collectionName && (
        <TabSection className="tab">
          <DatabasesTab
            databasePage={databasePage}
            databaseName={databaseName}
            tabClass="tab"
          />
        </TabSection>
      )}
      {collectionName && (
        <TabSection className="tab">
          <CollectionsTabs
            collectionPage={collectionPage}
            collectionName={collectionName}
            tabClass="tab"
            searchParams={
              searchParams.find(
                s => s.collection.collection_name === collectionName
              )!
            }
            setSearchParams={setCollectionSearchParams}
            queryState={
              queryState.find(
                q => q.collection.collection_name === collectionName
              )!
            }
            setQueryState={setCollectionQueryState}
            collections={collections}
          />
        </TabSection>
      )}
    </PageWrapper>
  );
};

export default Databases;
