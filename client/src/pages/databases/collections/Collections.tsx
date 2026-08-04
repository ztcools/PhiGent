import { useContext, useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Box, Chip, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Highlighter from 'react-highlight-words';
import { rootContext, dataContext } from '@/context';
import { usePaginationHook } from '@/hooks';
import AttuGrid from '@/components/grid/Grid';
import CustomToolBar from '@/components/grid/ToolBar';
import icons from '@/components/icons/Icons';
import EmptyCard from '@/components/cards/EmptyCard';
import StatusAction from '@/pages/databases/collections/StatusAction';
import EditableDescription from '@/pages/databases/collections/EditableDescription';
import CustomToolTip from '@/components/customToolTip/CustomToolTip';
import CreateCollectionDialog from '@/pages/dialogs/CreateCollectionDialog';
import LoadCollectionDialog from '@/pages/dialogs/LoadCollectionDialog';
import ReleaseCollectionDialog from '@/pages/dialogs/ReleaseCollectionDialog';
import DropCollectionDialog from '@/pages/dialogs/DropCollectionDialog';
import RenameCollectionDialog from '@/pages/dialogs/RenameCollectionDialog';
import DuplicateCollectionDialog from '@/pages/dialogs/DuplicateCollectionDialog';
import InsertDialog from '@/pages/dialogs/insert/Dialog';
import { getLabelDisplayedRows } from '@/pages/search/Utils';
import { LOADING_STATE } from '@/consts';
import { formatNumber } from '@/utils';
import {
  parseCodeCollection,
  groupByRepo,
  flattenRepoGroups,
  isInfraCollection,
} from '@/utils/codeCollection';
import type { CodeCollectionInfo, RepoGroup } from '@/utils/codeCollection';
import { useCodeRepoMap } from '@/utils/codeRepoMap';
import type {
  ColDefinitionsType,
  ToolBarConfig,
} from '@/components/grid/Types';
import type { CollectionObject } from '@server/types';
import { Root } from '../StyledComponents';

/** 一个 collection 连同它解析出的仓库/分支归属 */
type AnnotatedCollection = CodeCollectionInfo & {
  col: CollectionObject;
  rowCount?: number;
};

/** 某一行在「仓库 → 分支」层次里的位置（按 collection 名索引） */
interface RowLayout {
  repo: string;
  branch: string;
  isCode: boolean;
  /** 是否主分支（main/master） */
  isRoot: boolean;
  /** true = 仓库组主行，显示仓库名；false = 缩进子行，仓库列留空 */
  isGroupHead: boolean;
  /** 该仓库组共几行 */
  groupSize: number;
}

/** 组排序取值：都取自组主行（或组总量），保证组内层次不受排序影响 */
const groupSortValue = (
  g: RepoGroup<AnnotatedCollection>,
  key: string
): string | number => {
  const head = g.root || g.branches[0];
  switch (key) {
    case 'collection_name':
      return g.repo.toLowerCase();
    case 'branch':
      return (head?.branch || '').toLowerCase();
    case 'rowCount':
      return g.totalRows;
    // 表头传回的是 sortBy（status 列的 sortBy = loadedPercentage）
    case 'loadedPercentage':
      return Number(head?.col.loadedPercentage) || -1;
    case 'createdTime':
      return Number(head?.col.createdTime) || 0;
    default:
      return 0;
  }
};

const Collections = () => {
  const {
    collections,
    database,
    loading,
    fetchCollections,
    fetchCollection,
    batchRefreshCollections,
    isBatchRefreshing,
  } = useContext(dataContext);

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState<string>(
    (searchParams.get('search') as string) || ''
  );
  const [selectedCollections, setSelectedCollections] = useState<
    CollectionObject[]
  >([]);

  const { setDialog } = useContext(rootContext);
  const { t: collectionTrans } = useTranslation('collection');
  const { t: btnTrans } = useTranslation('btn');

  const QuestionIcon = icons.question;

  // 排序自管：作用在「仓库组」上，而不是行上 —— 否则一排序，main 主行和它的分支
  // 子行就被打散，缩进层次没了意义。
  const [orderBy, setOrderBy] = useState<string>('');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const handleGridSort = (_e: any, property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // 「仓库管理」里配的分支 → collection 映射。这是分支名的权威来源：分支是在那边
  // 添加的，服务端一清二楚，不必再从 Milvus description 反推（见 codeRepoMap.ts）。
  const repoMap = useCodeRepoMap();

  /** 可见 collection（去掉基础设施表），带仓库/分支归属 */
  const visibleCollections = useMemo(() => {
    const lookup = (name: string) => repoMap.get(name);
    // context 层已经过滤过 infra 表，这里再挡一次，页面不依赖上游行为。
    return collections
      .filter(c => !isInfraCollection(c.collection_name))
      .map<AnnotatedCollection>(c => ({
        ...parseCodeCollection(
          c.collection_name,
          (c as { description?: string }).description,
          lookup
        ),
        col: c,
        rowCount: c.rowCount,
      }));
  }, [collections, repoMap]);

  /** 按仓库分组后的列表 —— 分页和排序的单位都是「仓库」，组不会被翻页切断 */
  const repoGroups = useMemo(() => {
    const kw = search.toLowerCase();
    // 分支名也参与搜索：搜 "dev" 应该能捞出各仓库的 dev 分支。命中的分支重新分组后，
    // 组内第一行自然承担主行、显示仓库名，不会出现无归属的孤立子行。
    const matched = kw
      ? visibleCollections.filter(
          a =>
            a.collectionName.toLowerCase().includes(kw) ||
            a.repo.toLowerCase().includes(kw) ||
            a.branch.toLowerCase().includes(kw)
        )
      : visibleCollections;

    const groups = groupByRepo(matched);
    if (!orderBy) return groups;

    const dir = order === 'desc' ? -1 : 1;
    return [...groups].sort((a, b) => {
      const va = groupSortValue(a, orderBy);
      const vb = groupSortValue(b, orderBy);
      if (va === vb) return a.repo.localeCompare(b.repo);
      return (va > vb ? 1 : -1) * dir;
    });
  }, [visibleCollections, search, orderBy, order]);

  const {
    pageSize,
    handlePageSize,
    currentPage,
    handleCurrentPage,
    total,
    data: pageGroups,
  } = usePaginationHook(repoGroups);

  /** 当前页的表格行 + 各行的层次信息。
   *
   * Grid 的 Table 组件在调用 formatter 前会检查 `typeof row[colDef.id] !== 'undefined'`
   * （见 components/grid/Table.tsx:286），只有该字段在 row 上存在时才会渲染单元格。
   * branch 列 id='branch'，而 CollectionObject 没有 branch 字段 —— 不把它合到 row 上，
   * 分支列整列都会被跳过。 */
  const { collectionList, layout } = useMemo(() => {
    const rows: any[] = [];
    const map = new Map<string, RowLayout>();
    // usePaginationHook 的 data 是 any[]，显式指定泛型才能保住 col 字段的类型。
    for (const { item, isGroupHead, groupSize } of flattenRepoGroups<
      AnnotatedCollection
    >(pageGroups)) {
      rows.push({ ...item.col, branch: item.branch });
      map.set(item.collectionName, {
        repo: item.repo,
        branch: item.branch,
        isCode: item.isCode,
        isRoot: item.isRoot,
        isGroupHead,
        groupSize,
      });
    }
    return { collectionList: rows, layout: map };
  }, [pageGroups]);

  // 搜索/排序一变仓库组数就变，停在旧页码可能落到空页上 —— 回到第一页。
  useEffect(() => {
    handleCurrentPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, orderBy, order]);

  /** 行的层次信息（拿不到时退化成主行，至少仓库名不会消失） */
  const layoutOf = (name: string): RowLayout =>
    layout.get(name) || {
      repo: name,
      branch: '',
      isCode: false,
      isRoot: true,
      isGroupHead: true,
      groupSize: 1,
    };

  const toolbarConfigs: ToolBarConfig[] = [
    {
      label: collectionTrans('create'),
      onClick: () => {
        setDialog({
          open: true,
          type: 'custom',
          params: {
            component: (
              <CreateCollectionDialog
                onCreate={collection_name => {
                  //navigate to the new collection
                  navigate(`/databases/${database}/${collection_name}/schema`);
                }}
              />
            ),
          },
        });
      },
      icon: 'add',
    },
    {
      type: 'button',
      btnVariant: 'text',
      btnColor: 'secondary',
      label: btnTrans('load'),
      onClick: () => {
        setDialog({
          open: true,
          type: 'custom',
          params: {
            component: (
              <LoadCollectionDialog
                collection={selectedCollections[0]}
                onLoad={async () => {
                  setSelectedCollections([]);
                }}
              />
            ),
          },
        });
      },
      icon: 'load',
      disabled: data => {
        return (
          data.length !== 1 ||
          data[0].status !== LOADING_STATE.UNLOADED ||
          !data[0].schema.hasVectorIndex
        );
      },
      tooltip: btnTrans('loadColTooltip'),
    },
    {
      type: 'button',
      btnVariant: 'text',
      btnColor: 'secondary',
      label: btnTrans('release'),
      onClick: () => {
        setDialog({
          open: true,
          type: 'custom',
          params: {
            component: (
              <ReleaseCollectionDialog
                collection={selectedCollections[0]}
                onRelease={async () => {
                  setSelectedCollections([]);
                }}
              />
            ),
          },
        });
      },
      icon: 'release',
      tooltip: btnTrans('releaseColTooltip'),
      disabled: data => {
        return data.length !== 1 || data[0].status !== LOADING_STATE.LOADED;
      },
    },
    {
      icon: 'uploadFile',
      type: 'button',
      btnVariant: 'text',
      btnColor: 'secondary',
      label: btnTrans('importFile'),
      tooltip: btnTrans('importFileTooltip'),
      onClick: () => {
        setDialog({
          open: true,
          type: 'custom',
          params: {
            component: (
              <InsertDialog
                collections={visibleCollections.map(a => a.col)}
                defaultSelectedCollection={
                  selectedCollections.length === 1
                    ? selectedCollections[0].collection_name
                    : ''
                }
                // user can't select partition on collection page, so default value is ''
                defaultSelectedPartition={''}
                onInsert={async (collectionName: string) => {
                  await fetchCollection(collectionName);
                  setSelectedCollections([]);
                }}
              />
            ),
          },
        });
      },
      /**
       * insert validation:
       * 1. At least 1 available collection
       * 2. selected collections quantity shouldn't over 1
       */
      disabled: () =>
        collectionList.length === 0 || selectedCollections.length > 1,
    },
    {
      icon: 'edit',
      type: 'button',
      btnColor: 'secondary',
      btnVariant: 'text',
      onClick: () => {
        setDialog({
          open: true,
          type: 'custom',
          params: {
            component: (
              <RenameCollectionDialog
                cb={async (newName: string) => {
                  await fetchCollection(newName);
                  setSelectedCollections([]);
                }}
                collection={selectedCollections[0]}
              />
            ),
          },
        });
      },
      label: btnTrans('rename'),
      tooltip: btnTrans('renameTooltip'),
      disabled: data => data.length !== 1,
    },
    {
      icon: 'copy',
      type: 'button',
      btnVariant: 'text',
      onClick: () => {
        setDialog({
          open: true,
          type: 'custom',
          params: {
            component: (
              <DuplicateCollectionDialog
                cb={async () => {
                  setSelectedCollections([]);
                }}
                collection={selectedCollections[0]}
                collections={collections}
              />
            ),
          },
        });
      },
      label: btnTrans('duplicate'),
      tooltip: btnTrans('duplicateTooltip'),
      disabled: data => data.length !== 1,
    },
    {
      icon: 'cross',
      type: 'button',
      btnVariant: 'text',
      onClick: () => {
        setDialog({
          open: true,
          type: 'custom',
          params: {
            component: (
              <DropCollectionDialog
                onDelete={async () => {
                  setSelectedCollections([]);
                }}
                collections={selectedCollections}
              />
            ),
          },
        });
      },
      label: btnTrans('drop'),
      tooltip: btnTrans('deleteColTooltip'),
      disabledTooltip: btnTrans('deleteDisableTooltip'),
      disabled: data => data.length < 1,
    },

    {
      icon: 'refresh',
      type: 'button',
      btnVariant: 'text',
      onClick: () => {
        if (selectedCollections.length > 0) {
          for (const collection of selectedCollections) {
            fetchCollection(collection.collection_name);
          }
        } else {
          fetchCollections();
        }
      },
      disabled: () => {
        return loading || isBatchRefreshing;
      },
      label: btnTrans('refresh'),
    },

    {
      label: 'Search',
      icon: 'search',
      searchText: search,
      onSearch: (value: string) => {
        setSearch(value);
      },
    },
  ];

  const colDefinitions: ColDefinitionsType[] = [
    {
      id: 'collection_name',
      align: 'left',
      disablePadding: true,
      sortBy: 'collection_name',
      sortType: 'string',
      formatter(col) {
        const { collection_name } = col as { collection_name: string };
        const lo = layoutOf(collection_name);
        // 子行：仓库列整格留空 —— 这个空白就是用户要的缩进，层次靠它体现。
        if (!lo.isGroupHead) return <Box sx={{ maxWidth: 200 }} />;
        return (
          <Box sx={{ maxWidth: 200 }}>
            <Link
              to={`/databases/${database}/${collection_name}/overview`}
              style={{
                color: 'inherit',
                display: 'block',
                overflow: 'hidden',
                width: '100%',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                fontWeight: 600,
              }}
              title={
                lo.isCode
                  ? `${lo.repo}:${lo.branch}\n${collection_name}`
                  : collection_name
              }
            >
              <Highlighter
                textToHighlight={lo.repo}
                searchWords={[search]}
                highlightStyle={{
                  color: 'inherit',
                  fontWeight: 700,
                  backgroundColor: 'rgba(9, 181, 114, 0.18)',
                }}
              />
              {lo.groupSize > 1 && (
                <Typography
                  component="span"
                  sx={{
                    ml: 0.75,
                    fontSize: '0.72rem',
                    fontWeight: 400,
                    color: 'text.secondary',
                  }}
                >
                  ({lo.groupSize})
                </Typography>
              )}
            </Link>
          </Box>
        );
      },
      label: collectionTrans('repo'),
    },
    {
      id: 'branch',
      align: 'left',
      disablePadding: false,
      sortBy: 'branch',
      sortType: 'string',
      formatter(col) {
        const { collection_name } = col as { collection_name: string };
        const lo = layoutOf(collection_name);
        // 非代码 collection（用户手建的）没有分支语义。
        if (!lo.branch)
          return (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              --
            </Typography>
          );
        const chip = (
          <Chip
            size="small"
            label={
              <Highlighter
                textToHighlight={lo.branch}
                searchWords={[search]}
                highlightStyle={{
                  color: 'inherit',
                  fontWeight: 700,
                  backgroundColor: 'rgba(9, 181, 114, 0.18)',
                }}
              />
            }
            color={lo.isRoot ? 'primary' : 'default'}
            variant="outlined"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.78em',
              height: 22,
              borderRadius: 1,
              fontWeight: lo.isRoot ? 600 : 400,
              '& .MuiChip-label': { px: 1 },
            }}
          />
        );
        return (
          <Link
            to={`/databases/${database}/${collection_name}/overview`}
            style={{
              color: 'inherit',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            title={collection_name}
          >
            {/* 子行加一条 └ 连接线，视觉上挂在同组主行下面 */}
            {!lo.isGroupHead && (
              <Box
                component="span"
                sx={{
                  color: 'text.disabled',
                  fontFamily: 'monospace',
                  mr: 0.5,
                  ml: 0.5,
                  lineHeight: 1,
                }}
              >
                └
              </Box>
            )}
            {chip}
          </Link>
        );
      },
      label: collectionTrans('branch'),
    },
    {
      id: 'status',
      align: 'left',
      disablePadding: false,
      sortBy: 'loadedPercentage',
      label: collectionTrans('status'),
      formatter(v) {
        return (
          <Typography variant="body1" component="div">
            <StatusAction
              status={v.status}
              percentage={v.loadedPercentage}
              collection={v}
              showLoadButton={true}
            />
          </Typography>
        );
      },
    },
    {
      id: 'rowCount',
      align: 'left',
      disablePadding: false,
      sortBy: 'rowCount',
      label: (
        <Box
          component="span"
          className="flex-center with-max-content"
          sx={{ display: 'inline-flex', alignItems: 'center' }}
        >
          {collectionTrans('rowCount')}
          <CustomToolTip title={collectionTrans('entityCountInfo')}>
            <QuestionIcon sx={{ fontSize: 14, ml: 0.5 }} />
          </CustomToolTip>
        </Box>
      ),
      formatter(v) {
        return formatNumber(v.rowCount);
      },
    },
    {
      id: 'description',
      align: 'left',
      disablePadding: false,
      label: (
        <Box
          component="span"
          className="flex-center with-max-content"
          sx={{ display: 'inline-flex', alignItems: 'center' }}
        >
          {collectionTrans('description')}
        </Box>
      ),
      formatter(v) {
        return (
          <EditableDescription
            collection={v}
            onSaved={() => fetchCollection(v.collection_name)}
          />
        );
      },
    },
    {
      id: 'createdTime',
      align: 'left',
      disablePadding: false,
      label: collectionTrans('createdTime'),
      formatter(data) {
        return new Date(data.createdTime).toLocaleString();
      },
    },
  ];

  const handleSelectChange = (value: any) => {
    setSelectedCollections(value);
  };

  const handlePageChange = (e: any, page: number) => {
    handleCurrentPage(page);
    setSelectedCollections([]);
  };

  const CollectionIcon = icons.navCollection;

  // lazy fetch collections that don't have schema
  useEffect(() => {
    const names = collectionList
      .filter(c => !c.schema)
      .map(c => c.collection_name);

    if (names.length > 0) {
      batchRefreshCollections(names, 'collection-grid');
    }
  }, [collectionList, batchRefreshCollections]);

  return (
    <Root>
      {collections.length > 0 || loading ? (
        <AttuGrid
          toolbarConfigs={toolbarConfigs}
          colDefinitions={colDefinitions}
          rows={collectionList}
          rowCount={total}
          primaryKey="id"
          selected={selectedCollections}
          setSelected={handleSelectChange}
          page={currentPage}
          onPageChange={handlePageChange}
          rowsPerPage={pageSize}
          tableHeaderHeight={44}
          rowHeight={42}
          setRowsPerPage={handlePageSize}
          isLoading={loading}
          handleSort={handleGridSort}
          order={order}
          orderBy={orderBy}
          hideOnDisable={true}
          sx={{ height: 'auto', minHeight: '100%' }}
          // 分页单位是「仓库组」而不是 collection —— 组不会被翻页切断，
          // 所以这里显示的计数也必须是仓库数。
          labelDisplayedRows={getLabelDisplayedRows(collectionTrans('repo'))}
          rowDecorator={(row: CollectionObject) => {
            if (!row.schema) {
              return {
                pointerEvents: 'none',
                opacity: 0.5,
                backgroundColor: 'rgba(0,0,0,0.04)',
              };
            }
            return {};
          }}
        />
      ) : (
        <>
          <CustomToolBar toolbarConfigs={toolbarConfigs} />
          <EmptyCard
            wrapperClass="page-empty-card"
            icon={<CollectionIcon />}
            text={collectionTrans('noData')}
          />
        </>
      )}
    </Root>
  );
};

export default Collections;
