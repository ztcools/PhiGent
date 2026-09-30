import { FC, MouseEvent, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import TablePagination from '@mui/material/TablePagination';
import CustomToolbar from './ToolBar';
import Table from './Table';
import TablePaginationActions from './TablePaginationActions';
import type { AttuGridType } from './Types';

/**
 *
 * @param rowCount 必填。用于分页的数据总条数
 * @param rowsPerPage 分页每页条数，默认 10
 * @param primaryKey 必填。数据的唯一列，用于 checkbox 和渲染 key。
 * @param onPageChange 处理翻页
 * @param labelDisplayedRows 自定义分页文案函数，返回字符串；
 * @param page 分页当前页
 * @param showToolbar 控制工具栏是否显示，默认 false
 * @param rows 需要渲染的表格数据
 * @param colDefinitions 定义表头如何渲染。
 * @param isLoading 表格加载状态
 * @param title  渲染面包屑
 * @param openCheckBox 控制 checkbox 是否显示，默认 true
 * @param disableSelect 禁用表格行选择，默认 false
 * @param enableSelectAll 控制全选 checkbox 是否显示，默认 true
 * @param noData 表格为空时展示的提示文案。
 * @param showHoverStyle 控制表格行悬浮样式是否显示
 * @param headEditable 为 true 时用户可编辑表头。
 * @param editHeads 仅当 headEditable 为 true 时才渲染 editHeads
 * @param tableCellMaxWidth 定义单元格最大宽度，默认 300
 * @param handlesort 表格排序方式，未定义时不可排序
 * @param order 'desc' | 'asc'。排序方向
 * @param order 按哪个表格字段排序
 * @param addSpacerColumn 控制占位空列是否显示，默认 false
 * @returns
 */
const AttuGrid: FC<AttuGridType> = props => {
  // const classes = userStyle();
  const tableRef = useRef<HTMLDivElement | null>(null);

  // i18n
  const { t: commonTrans } = useTranslation();

  const {
    rowCount = 20,
    rowsPerPage = 10,
    tableHeaderHeight = 44,
    rowHeight = 42,
    pagerHeight = 52,
    primaryKey = 'id',
    showToolbar = false,
    toolbarConfigs = [],
    onPageChange = (
      e: MouseEvent<HTMLButtonElement> | null,
      nextPageNum: number
    ) => {
      console.log('nextPageNum', nextPageNum);
    },
    labelDisplayedRows,
    page = 0,
    rows = [],
    colDefinitions = [],
    isLoading = false,
    title,
    openCheckBox = true,
    disableSelect = false,
    enableSelectAll = true,
    noData = commonTrans('grid.noData'),
    showHoverStyle = true,
    headEditable = false,
    editHeads = [],
    selected = [],
    setSelected = () => {},
    setRowsPerPage = () => {},
    tableCellMaxWidth,
    handleSort,
    order,
    orderBy,
    showPagination = true,
    hideOnDisable,
    rowDecorator = () => ({}),
    sx = {},
    addSpacerColumn = false,
  } = props;

  const _isSelected = (row: { [x: string]: any }) => {
    // console.log("row selected test", row[primaryKey]);
    return selected.some((s: any) => s[primaryKey] === row[primaryKey]);
  };

  const _onSelected = (event: React.MouseEvent, row: { [x: string]: any }) => {
    if (disableSelect) {
      return;
    }
    let newSelected: any[] = ([] as any[]).concat(selected);
    if (_isSelected(row)) {
      newSelected = newSelected.filter(s => s[primaryKey] !== row[primaryKey]);
    } else {
      newSelected.push(row);
    }

    setSelected(newSelected);
  };

  const _onSelectedAll = (event: React.ChangeEvent) => {
    if ((event.target as HTMLInputElement).checked) {
      const newSelecteds = rows;
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const defaultLabelRows = ({ from = 0, to = 0, count = 0 }) => {
    return (
      <>
        <Typography variant="body2" component="span">
          {from} - {to}
        </Typography>
        <Typography variant="body2" className="rows" component="span">
          {commonTrans('grid.gridTrans.of')} {count}{' '}
          {commonTrans('grid.gridTrans.rows')}
        </Typography>
      </>
    );
  };

  const calculateRowCountAndPageSize = () => {
    if (tableRef.current && rowHeight > 0) {
      const containerHeight: number = tableRef.current.offsetHeight;
      const hasToolbar = toolbarConfigs.length > 0;
      const totalHeight =
        containerHeight -
        tableHeaderHeight -
        (showPagination ? pagerHeight : 0) -
        (hasToolbar ? 42 : 0);

      const rowCount = Math.floor(totalHeight / rowHeight);

      if (setRowsPerPage) {
        setRowsPerPage(rowCount);
      }
    }
  };

  useEffect(() => {
    // const timer = setTimeout(() => {
    calculateRowCountAndPageSize();
    // }, 16);
    // 监听窗口 resize 事件
    window.addEventListener('resize', calculateRowCountAndPageSize);

    // 卸载时移除事件监听
    return () => {
      window.removeEventListener('resize', calculateRowCountAndPageSize);
      // clearTimeout(timer);
    };
  }, [tableHeaderHeight, rowHeight]);

  return (
    <Grid
      container
      sx={{
        height: '100%',
        flexWrap: 'nowrap',
        flexDirection: 'column',
        ...sx,
      }}
      ref={tableRef}
    >
      {title && (
        <Grid item xs={12} sx={{ '& .last': { color: 'rgba(0, 0, 0, 0.54)' } }}>
          <Breadcrumbs separator="›" aria-label="breadcrumb" role="breadcrumb">
            {title.map(
              (v: any, i: number) =>
                v && (
                  <Typography
                    key={v}
                    className={i === title.length - 1 ? 'last' : ''}
                    variant="h6"
                    color="textPrimary"
                  >
                    {v}
                  </Typography>
                )
            )}
          </Breadcrumbs>
        </Grid>
      )}

      {(showToolbar || toolbarConfigs.length > 0) && (
        <Grid item>
          <CustomToolbar
            toolbarConfigs={toolbarConfigs}
            selected={selected}
            hideOnDisable={hideOnDisable}
          ></CustomToolbar>
        </Grid>
      )}

      <Grid
        item
        xs={12}
        sx={{
          paddingBottom: '0 !important',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Table
          openCheckBox={openCheckBox}
          primaryKey={primaryKey}
          rows={rows}
          selected={selected}
          colDefinitions={colDefinitions}
          onSelectedAll={_onSelectedAll}
          onSelected={_onSelected}
          isSelected={_isSelected}
          disableSelect={disableSelect}
          noData={noData}
          showHoverStyle={showHoverStyle}
          isLoading={isLoading}
          headEditable={headEditable}
          editHeads={editHeads}
          tableCellMaxWidth={tableCellMaxWidth}
          handleSort={handleSort}
          order={order}
          orderBy={orderBy}
          rowHeight={rowHeight}
          rowDecorator={rowDecorator}
          addSpacerColumn={addSpacerColumn}
          enableSelectAll={enableSelectAll}
        ></Table>
        {rowCount && showPagination ? (
          <TablePagination
            component="div"
            colSpan={3}
            count={rowCount}
            page={page}
            labelDisplayedRows={labelDisplayedRows || defaultLabelRows}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[]}
            onPageChange={onPageChange}
            sx={{
              '& .MuiTablePagination-spacer': {
                display: 'none',
              },
              '& .MuiTablePagination-toolbar': {
                display: 'flex',
                justifyContent: 'space-between',
                paddingLeft: 0,
              },
              '& .MuiTablePagination-caption': {
                position: 'absolute',
                left: 0,
                bottom: 0,
                top: 0,
                display: 'flex',
                alignItems: 'center',
                '& .rows': {
                  color: 'rgba(0,0,0,0.33)',
                  marginLeft: 1,
                },
              },
            }}
            ActionsComponent={TablePaginationActions}
          />
        ) : null}
      </Grid>
    </Grid>
  );
};

export default AttuGrid;
