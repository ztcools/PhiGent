import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { dataContext } from '@/context';
import { useQuery } from '@/hooks';
import icons from '@/components/icons/Icons';
import AttuGrid from '@/components/grid/Grid';
import CustomToolBar from '@/components/grid/ToolBar';
import { getLabelDisplayedRows } from '@/pages/search/Utils';
import { Root } from '../../StyledComponents';
import { DYNAMIC_FIELD, ConsistencyLevelEnum } from '@/consts';
import { Typography } from '@mui/material';
import StatusIcon, { LoadingType } from '@/components/status/StatusIcon';
import CollectionColHeader from '../CollectionColHeader';
import DataView from '@/components/DataView/DataView';
import type { QueryState } from '../../types';
import { CollectionFullObject } from '@server/types';
import CollectionToolbar from './DataActionToolbar';
import QueryToolbar from './QueryToolbar';

export interface CollectionDataProps {
  queryState: QueryState;
  setQueryState: (state: QueryState) => void;
}

const CollectionData = (props: CollectionDataProps) => {
  // Props 参数
  const { queryState, setQueryState } = props;
  const collection = queryState && queryState.collection;

  // Collection 不存在，或 Collection 完整对象尚未就绪
  if (!collection || !collection.consistency_level) {
    return <StatusIcon type={LoadingType.CREATING} />;
  }

  // UI 状态
  const [tableLoading, setTableLoading] = useState<boolean>(false);
  const [selectedData, setSelectedData] = useState<any[]>([]);
  const exprInputRef = useRef<string>(queryState.expr);
  const [, forceUpdate] = useState({});
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isCollectionSwitching, setIsCollectionSwitching] =
    useState<boolean>(false);

  // UI 函数
  const { fetchCollection } = useContext(dataContext);
  // 国际化文案
  const { t: searchTrans } = useTranslation('search');
  const { t: commonTrans } = useTranslation();

  // UI 引用
  const filterRef = useRef();
  const inputRef = useRef<HTMLInputElement>();

  // 查询 Hook
  const {
    currentPage,
    total,
    pageSize,
    queryResult,
    setPageSize,
    setCurrentPage,
    query,
    reset,
    count,
  } = useQuery({
    collection,
    onQueryStart: (expr: string = '') => {
      // 清除已有定时器
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // 延迟 200ms 再显示 loading，避免快速查询时闪烁
      loadingTimeoutRef.current = setTimeout(() => {
        setTableLoading(true);
      }, 200);

      if (expr === '') {
        handleFilterReset();
        return;
      }
    },
    onQueryFinally: () => {
      // 若定时器存在则清除
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setTableLoading(false);
      setIsCollectionSwitching(false);
    },
    queryState: queryState,
    setQueryState: setQueryState,
  });

  // 记忆化的处理函数
  const handleExprChange = useCallback(
    (value: string) => {
      exprInputRef.current = value;
      if (value === '' || value === queryState.expr) {
        forceUpdate({});
      }
    },
    [queryState.expr]
  );

  const handleExprKeyDown = useCallback(
    (e: any) => {
      if (e.key === 'Enter') {
        setQueryState({
          ...queryState,
          expr: exprInputRef.current,
          tick: queryState.tick + 1,
        });
        // 重置页码
        setCurrentPage(0);
        e.preventDefault();
      }
    },
    [queryState, setQueryState, setCurrentPage]
  );

  const handleFilterSubmit = useCallback(
    async (expression: string) => {
      // 更新 UI 中的表达式
      setQueryState({ ...queryState, expr: expression });
      exprInputRef.current = expression;
      forceUpdate({});
    },
    [queryState, setQueryState]
  );

  // UI 事件处理函数
  const handleFilterReset = useCallback(async () => {
    // 重置高级筛选
    const currentFilter: any = filterRef.current;
    currentFilter?.getReset();
    // 更新 UI 中的表达式
    exprInputRef.current = '';
    setQueryState({
      ...queryState,
      expr: '',
      outputFields: [...collection.schema.fields]
        .filter(f => !f.is_function_output)
        .map(f => f.name),
      tick: queryState.tick + 1,
    });
    forceUpdate({});
  }, [collection.schema.fields, queryState, setQueryState]);

  const handlePageChange = useCallback(
    async (e: any, page: number) => {
      // 执行查询
      await query(page, queryState);
      // 更新页码
      setCurrentPage(page);
    },
    [query, queryState.consistencyLevel, setCurrentPage]
  );

  const onSelectChange = useCallback((value: any) => {
    setSelectedData(value);
  }, []);

  const onDelete = useCallback(async () => {
    // 清空选中项
    setSelectedData([]);
    // reset();
    reset();
    // 更新总数
    count(ConsistencyLevelEnum.Strong);
    // 更新查询
    query(0, { ...queryState, consistencyLevel: ConsistencyLevelEnum.Strong });
  }, [count, query, reset]);

  const onInsert = useCallback(
    async (collectionName: string) => {
      await fetchCollection(collectionName);
    },
    [fetchCollection]
  );

  const getEditData = useCallback(
    (data: any, collection: CollectionFullObject) => {
      // 按 Collection Schema 的字段顺序排序
      const schema = collection.schema;
      let sortedData: { [key: string]: any } = {};
      schema.fields.forEach(field => {
        if (data[field.name] !== undefined) {
          sortedData[field.name] = data[field.name];
        }
      });

      // 若存在动态字段则补充
      const isDynamicSchema = collection.schema.dynamicFields.length > 0;
      if (isDynamicSchema) {
        sortedData = { ...sortedData, ...data[DYNAMIC_FIELD] };
      }

      return sortedData;
    },
    []
  );

  // 直接从 CollectionToolbar 组件获取工具栏配置
  const toolbarConfigs = CollectionToolbar({
    collection,
    selectedData,
    total,
    queryState,
    setQueryState,
    onDelete,
    onInsert,
    getEditData,
    setSelectedData,
  });

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // 重置选中项
    setSelectedData([]);
    exprInputRef.current = queryState.expr;
    forceUpdate({});

    // Collection 变化时设置切换状态
    setIsCollectionSwitching(true);

    // 组件卸载或 Collection 变化时清理定时器
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [collection.collection_name, queryState.expr]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <Root>
      {collection && (
        <>
          <CustomToolBar toolbarConfigs={toolbarConfigs} hideOnDisable={true} />
          <QueryToolbar
            collection={collection}
            queryState={queryState}
            setQueryState={setQueryState}
            exprInputRef={exprInputRef}
            handleExprChange={handleExprChange}
            handleExprKeyDown={handleExprKeyDown}
            handleFilterSubmit={handleFilterSubmit}
            handleFilterReset={handleFilterReset}
            setCurrentPage={setCurrentPage}
            forceDisabled={isCollectionSwitching}
          />
          <AttuGrid
            toolbarConfigs={[]}
            addSpacerColumn={true}
            rowHeight={43}
            tableHeaderHeight={44}
            colDefinitions={queryState.outputFields.map(i => {
              const field = collection.schema.fields.find(f => f.name === i);

              // 若字段为函数输出，返回特殊的列定义
              if (field?.is_function_output) {
                const inputFields = collection.schema.functions.find(fn =>
                  fn.output_field_names?.includes(i)
                )?.input_field_names;

                return {
                  id: collection.schema.primaryField.name,
                  align: 'left',
                  disablePadding: false,
                  needCopy: false,
                  label: i,
                  formatter: () => (
                    <Typography
                      variant="body2"
                      sx={{ color: theme => theme.palette.text.disabled }}
                    >
                      auto-generated from {inputFields?.join(', ')}
                    </Typography>
                  ),
                  headerFormatter: v => {
                    return (
                      <CollectionColHeader def={v} collection={collection} />
                    );
                  },
                };
              }

              return {
                id: i,
                align: 'left',
                disablePadding: false,
                needCopy: true,
                formatter(_: any, cellData: any) {
                  const fieldType = field?.data_type || 'JSON'; // 动态字段

                  return <DataView type={fieldType} value={cellData} />;
                },
                headerFormatter: v => {
                  return (
                    <CollectionColHeader def={v} collection={collection} />
                  );
                },
                label: i === DYNAMIC_FIELD ? searchTrans('dynamicFields') : i,
              };
            })}
            primaryKey={collection.schema.primaryField.name}
            openCheckBox={true}
            isLoading={
              tableLoading || (isCollectionSwitching && collection.loaded)
            }
            rows={queryResult.data}
            rowCount={total}
            selected={selectedData}
            setSelected={onSelectChange}
            page={currentPage}
            onPageChange={handlePageChange}
            setRowsPerPage={setPageSize}
            rowsPerPage={pageSize}
            showPagination={
              !tableLoading && !isCollectionSwitching && collection.loaded
            }
            labelDisplayedRows={getLabelDisplayedRows(
              commonTrans(
                queryResult.data.length > 1 ? 'grid.entities' : 'grid.entity'
              ),
              <>
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.75rem',
                    lineHeight: 1,
                  }}
                >
                  ({queryResult.latency || ''} ms)
                </Typography>
                {currentPage * pageSize + pageSize < total &&
                queryResult.data.length < pageSize ? (
                  <Typography
                    component="span"
                    sx={{
                      color: 'warning.main',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      lineHeight: 1,
                      marginLeft: '4px',
                    }}
                  >
                    <icons.info
                      sx={{
                        fontSize: '12px',
                        color: 'warning.main',
                        marginTop: '1px',
                      }}
                    />
                    {searchTrans('duplicateDataWarning')}
                  </Typography>
                ) : null}
              </>
            )}
            noData={searchTrans(
              !collection.loaded ? 'collectionNotLoaded' : 'empty'
            )}
          />
        </>
      )}
    </Root>
  );
};

export default CollectionData;
