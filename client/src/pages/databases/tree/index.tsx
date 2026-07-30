import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useContext,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import icons from '@/components/icons/Icons';
import { Grow, Popover, Box, IconButton, Fade } from '@mui/material';
import { CollectionObject } from '@server/types';
import {
  DatabaseTreeItem as OriginalDatabaseTreeItem,
  TreeNodeType,
  DatabaseTreeProps,
  ContextMenu,
  TreeNodeObject,
} from './types';
import { TreeContextMenu } from './TreeContextMenu';
import { useVirtualizer } from '@tanstack/react-virtual';
import { dataContext } from '@/context';
import CollectionNode from './CollectionNode';
import DatabaseNode from './DatabaseNode';
import RepoNode from './RepoNode';
import SearchBox from './SearchBox';
import {
  parseCodeCollection,
  groupByRepo,
  CodeCollectionInfo,
} from '@/utils/codeCollection';
import {
  TreeContainer,
  TreeContent,
  NoResultsBox,
  TreeNodeBox,
  SearchBoxContainer,
} from './StyledComponents';

interface FlatTreeItem {
  id: string;
  name: string;
  depth: number;
  type: TreeNodeType;
  data: TreeNodeObject | null;
  isExpanded: boolean;
  hasChildren: boolean;
  originalNode: OriginalDatabaseTreeItem;
}

const DatabaseTree: React.FC<DatabaseTreeProps> = props => {
  const { database, collections, params } = props;

  const navigate = useNavigate();
  const { collectionName = '' } = useParams<{ collectionName: string }>();
  const { batchRefreshCollections } = useContext(dataContext);
  const { t } = useTranslation();

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    new Set([database])
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    params.collectionName ? `c_${params.collectionName}` : database
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);

  const ExpandIcon = icons.rightArrow;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const filteredCollections = useMemo(() => {
    if (!debouncedSearchQuery) return collections;
    const query = debouncedSearchQuery.toLowerCase();
    return collections.filter(c =>
      c.collection_name.toLowerCase().includes(query)
    );
  }, [collections, debouncedSearchQuery]);

  const flattenTree = useCallback(
    (
      node: OriginalDatabaseTreeItem,
      depth: number,
      expanded: Set<string>
    ): FlatTreeItem[] => {
      const isExpanded = expanded.has(node.id);
      const hasChildren = node.children && node.children.length > 0;

      const flatNode: FlatTreeItem = {
        id: node.id,
        name: node.name,
        depth: depth,
        type: node.type,
        data: node.data || null,
        isExpanded: isExpanded,
        hasChildren: Boolean(hasChildren),
        originalNode: node,
      };

      let childrenFlat: FlatTreeItem[] = [];
      if (hasChildren && isExpanded) {
        childrenFlat = node
          .children!.map(child => flattenTree(child, depth + 1, expanded))
          .reduce((acc, val) => acc.concat(val), []);
      }

      return [flatNode, ...childrenFlat];
    },
    []
  );

  const flattenedNodes = useMemo(() => {
    // Group code collections into 「仓库(main) → 各分支」 two-level hierarchy.
    // Only hcc_/cc_ code collections get grouped; other collections (user data,
    // code_index_state, embedding_cache_*) stay flat at the top level.
    const isCodeCollection = (name: string) => /^(hcc|cc)_/i.test(name);
    const codeInfos = filteredCollections
      .filter(c => isCodeCollection(c.collection_name))
      .map(c => ({
        ...parseCodeCollection(
          c.collection_name,
          (c as { description?: string }).description,
        ),
        rowCount: c.rowCount || 0,
        data: c,
      }));
    const otherCollections = filteredCollections.filter(
      c => !isCodeCollection(c.collection_name),
    );

    const repoGroups = groupByRepo(codeInfos);

    const children: OriginalDatabaseTreeItem[] = [];

    // 每个仓库一个父节点（main 行为仓库名），其余分支为子节点
    for (const g of repoGroups) {
      const branchChildren: OriginalDatabaseTreeItem[] = g.branches.map(b => ({
        id: `c_${b.collectionName}`,
        name: b.branch, // 子节点只显示分支名
        type: 'collection' as TreeNodeType,
        data: b.data,
        children: [],
        expanded: false,
      }));
      // 仓库主行：显示仓库名（不带 collection 名），数据用 main（若有）
      const rootColl = g.root;
      children.push({
        id: `repo_${g.repo}`,
        name: g.repo,
        type: 'repo' as TreeNodeType,
        data: rootColl ? rootColl.data : undefined,
        children: rootColl
          ? [
              // main 本身作为第一个子节点（branch=main）
              {
                id: `c_${rootColl.collectionName}`,
                name: rootColl.branch,
                type: 'collection' as TreeNodeType,
                data: rootColl.data,
                children: [],
                expanded: false,
              },
              ...branchChildren,
            ]
          : branchChildren,
        expanded: expandedItems.has(`repo_${g.repo}`),
      });
    }

    // 非 code collection 平铺
    for (const c of otherCollections) {
      children.push({
        id: `c_${c.collection_name}`,
        name: c.collection_name,
        type: 'collection' as TreeNodeType,
        data: c,
        children: [],
        expanded: false,
      });
    }

    const tree: OriginalDatabaseTreeItem = {
      id: database,
      name: database,
      expanded: expandedItems.has(database),
      type: 'db',
      children: children,
      data: undefined,
    };

    const allNodes = flattenTree(tree, 0, expandedItems);

    return allNodes.filter(
      node => node.type !== 'db' && node.type !== 'search'
    );
  }, [database, filteredCollections, expandedItems, flattenTree]);

  const rowVirtualizer = useVirtualizer({
    count: flattenedNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 5,
  });

  const handleToggleExpand = (nodeId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
    setContextMenu(null);
  };

  const skipNextScrollRef = useRef(false);

  const handleNodeClick = (node: FlatTreeItem) => {
    // 仓库行：点击只展开/收起分支列表，不跳详情（main 在展开后的第一个子节点）
    if (node.type === 'repo') {
      handleToggleExpand(node.id);
      setSelectedItemId(node.id);
      setContextMenu(null);
      return;
    }

    skipNextScrollRef.current = true;
    setSelectedItemId(node.id);

    if (node.type === 'db') {
      navigate(`/databases/${database}/${params.databasePage || 'collections'}`);
    } else {
      // collection 分支节点：data 才是真正的 CollectionObject（含 collection_name）
      const collName = (node.data as CollectionObject | null)?.collection_name || node.name;
      navigate(`/databases/${database}/${collName}/${params.collectionPage || 'schema'}`);
    }
    setContextMenu(null);
  };

  const handleContextMenu = (event: React.MouseEvent, node: FlatTreeItem) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      nodeId: node.id,
      nodeType: node.type,
      object: node.data,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  useEffect(() => {
    document.addEventListener('click', handleCloseContextMenu);
    return () => {
      document.removeEventListener('click', handleCloseContextMenu);
    };
  }, []);

  useEffect(() => {
    if (!collections.length) return;

    let isScrolling = false;
    let scrollTimeoutId: NodeJS.Timeout | null = null;

    const currentFlattenedNodes = flattenedNodes;

    const refreshVisibleCollections = () => {
      if (!parentRef.current) return;

      const visibleItems = rowVirtualizer.getVirtualItems();
      const visibleCollectionNames = visibleItems
        .map(item => {
          if (item.index >= currentFlattenedNodes.length) return null;
          const node = currentFlattenedNodes[item.index];
          if (node && node.type === 'collection' && node.name) {
            return node.name;
          }
          return null;
        })
        .filter(Boolean) as string[];

      if (visibleCollectionNames.length > 0) {
        batchRefreshCollections(visibleCollectionNames, 'collection-tree');
      }
    };

    const handleScrollStart = () => {
      if (!isScrolling) {
        isScrolling = true;
        refreshVisibleCollections();
      }

      if (scrollTimeoutId) {
        clearTimeout(scrollTimeoutId);
      }

      scrollTimeoutId = setTimeout(() => {
        isScrolling = false;
        refreshVisibleCollections();
        scrollTimeoutId = null;
      }, 500);
    };

    const initialRefreshTimeout = setTimeout(() => {
      refreshVisibleCollections();
    }, 100);

    const scrollElement = parentRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScrollStart);

      return () => {
        scrollElement.removeEventListener('scroll', handleScrollStart);
        if (scrollTimeoutId) {
          clearTimeout(scrollTimeoutId);
        }
        clearTimeout(initialRefreshTimeout);
      };
    }

    return () => {
      if (scrollTimeoutId) {
        clearTimeout(scrollTimeoutId);
      }
      clearTimeout(initialRefreshTimeout);
    };
  }, [
    collections.length,
    batchRefreshCollections,
    rowVirtualizer,
    debouncedSearchQuery,
  ]);

  useEffect(() => {
    // 深链匹配要用 collection_name（node.data.collection_name），不是 node.name ——
    // 分支子节点的 name 是分支名(main/dev)，URL 的 collectionName 是 collection 全名。
    const matchNode = (node: FlatTreeItem) =>
      (node.data as CollectionObject | null)?.collection_name === collectionName ||
      node.name === collectionName;

    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false;
      setSelectedItemId(
        flattenedNodes.find(matchNode)?.id || database
      );
      return;
    }
    const index = flattenedNodes.findIndex(matchNode);
    if (index >= 0) {
      // 命中的分支子节点的父 repo 必须展开，否则虚拟列表里看不到该子节点
      const hit = flattenedNodes[index];
      const parentId = hit.id.startsWith('c_')
        ? flattenedNodes.find(n => n.type === 'repo' && n.originalNode.children?.some(c => c.id === hit.id))?.id
        : undefined;
      if (parentId) {
        setExpandedItems(prev => (prev.has(parentId) ? prev : new Set(prev).add(parentId)));
      }
      rowVirtualizer.scrollToIndex(index, { align: 'center' });
      setSelectedItemId(hit.id);
    } else {
      rowVirtualizer.scrollToIndex(0, { align: 'start' });
      setSelectedItemId(database);
    }
  }, [collectionName]);

  // Add scroll handler for scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      if (!parentRef.current) return;
      const scrollTop = parentRef.current.scrollTop;
      setShowScrollTop(scrollTop > 200); // Show button when scrolled more than 200px
    };

    const scrollElement = parentRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const handleScrollToTop = () => {
    if (parentRef.current) {
      parentRef.current.scrollTo({
        top: 0,
        // behavior: 'smooth',
      });
    }
  };

  return (
    <>
      <TreeContainer ref={parentRef}>
        {isSearchOpen ? (
          <SearchBoxContainer
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              backgroundColor: 'inherit',
            }}
          >
            <SearchBox
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onClose={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
            />
          </SearchBoxContainer>
        ) : (
          <DatabaseNode
            database={database}
            collectionCount={collections.length}
            isSelected={selectedItemId === database}
            isContextMenuTarget={contextMenu?.nodeId === database}
            onNodeClick={() =>
              handleNodeClick({
                id: database,
                name: database,
                depth: 0,
                type: 'db',
                data: null,
                isExpanded: false,
                hasChildren: false,
                originalNode: {
                  id: database,
                  name: database,
                  type: 'db',
                  children: [],
                  expanded: false,
                },
              })
            }
            onContextMenu={e =>
              handleContextMenu(e, {
                id: database,
                name: database,
                depth: 0,
                type: 'db',
                data: null,
                isExpanded: false,
                hasChildren: false,
                originalNode: {
                  id: database,
                  name: database,
                  type: 'db',
                  children: [],
                  expanded: false,
                },
              })
            }
            onSearchClick={e => {
              e.stopPropagation();
              setIsSearchOpen(!isSearchOpen);
            }}
          />
        )}

        <TreeContent
          sx={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            marginTop: 0,
          }}
        >
          {flattenedNodes.length === 0 ? (
            <NoResultsBox>{t('search.noResults')}</NoResultsBox>
          ) : (
            rowVirtualizer.getVirtualItems().map(virtualItem => {
              const node = flattenedNodes[virtualItem.index];
              if (!node) return null;

              const isSelected = node.id === selectedItemId;
              const isContextMenuTarget = contextMenu?.nodeId === node.id;
              const isCollectionNoSchema =
                node.type === 'collection' &&
                (!node.data || !(node.data as CollectionObject).schema);

              return (
                <TreeNodeBox
                  key={node.id}
                  isSelected={isSelected}
                  isContextMenuTarget={isContextMenuTarget}
                  isCollectionNoSchema={isCollectionNoSchema}
                  depth={node.depth}
                  sx={{
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  onClick={() => handleNodeClick(node)}
                  onContextMenu={e => handleContextMenu(e, node)}
                >
                  {node.hasChildren && node.type !== 'db' ? (
                    <IconButton
                      size="small"
                      aria-label={node.isExpanded ? '收起' : '展开'}
                      onClick={e => {
                        e.stopPropagation();
                        handleToggleExpand(node.id);
                      }}
                      sx={{
                        mr: 0,
                        p: '2px',
                        transition: 'transform 0.15s ease-in-out',
                      }}
                    >
                      <ExpandIcon
                        sx={{
                          transform: node.isExpanded
                            ? 'rotate(90deg)'
                            : 'rotate(0deg)',
                          transition: 'transform 0.15s ease-in-out',
                        }}
                      />
                    </IconButton>
                  ) : (
                    <Box sx={{ width: 0 }} />
                  )}

                  {node.type === 'repo' && (
                    <RepoNode
                      repo={node.name}
                      branchCount={node.originalNode.children?.length || 0}
                      highlight={debouncedSearchQuery}
                    />
                  )}

                  {node.type === 'collection' && node.data && (
                    <CollectionNode
                      data={node.data as CollectionObject}
                      displayName={node.name}
                      highlight={debouncedSearchQuery}
                      isSelected={isSelected}
                      isContextMenuTarget={isContextMenuTarget}
                      hasChildren={node.hasChildren}
                      isExpanded={node.isExpanded}
                      depth={node.depth}
                      onToggleExpand={e => {
                        e.stopPropagation();
                        handleToggleExpand(node.id);
                      }}
                      onClick={() => handleNodeClick(node)}
                      onContextMenu={e => handleContextMenu(e, node)}
                    />
                  )}
                </TreeNodeBox>
              );
            })
          )}
        </TreeContent>
      </TreeContainer>

      <Fade in={showScrollTop}>
        <IconButton
          onClick={handleScrollToTop}
          size="small"
          aria-label="回到顶部"
          sx={theme => ({
            position: 'absolute',
            bottom: 16,
            right: 16,
            backgroundColor: theme.palette.background.paper,
            '&:hover': {
              backgroundColor: theme.palette.background.paper,
              boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
            },
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            width: 32,
            height: 32,
            border: `1px solid ${theme.palette.divider}`,
            transition: 'all 0.2s ease-in-out',
          })}
        >
          <ExpandIcon sx={{ transform: 'rotate(-90deg)', fontSize: 20 }} />
        </IconButton>
      </Fade>

      <Popover
        open={Boolean(contextMenu)}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        TransitionComponent={Grow}
        transitionDuration={0}
        sx={{ pointerEvents: 'none' }}
        slotProps={{
          paper: {
            sx: { pointerEvents: 'auto', borderRadius: 2 },
          },
        }}
      >
        <TreeContextMenu
          onClick={handleCloseContextMenu}
          contextMenu={contextMenu!}
        />
      </Popover>
    </>
  );
};

export default DatabaseTree;
