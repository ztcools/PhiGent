import React, { ReactElement, Ref } from 'react';
import { LabelDisplayedRowsArgs } from '@mui/material';
import { IconsType } from '../icons/Types';
import { SearchType } from '../customInput/Types';
import type { SxProps, Theme } from '@mui/material';

export type IconConfigType = {
  [x: string]: JSX.Element;
};

export type ColorType = 'default' | 'inherit' | 'primary' | 'secondary';

export type SortDirection = 'asc' | 'desc';

export type SortType = 'string' | 'number';

/**
 * selected: 表格 checkbox 中选中的数据
 */
export type ToolBarType = {
  toolbarConfigs: ToolBarConfig[];
  selected?: any[];
  setSelected?: (selected: any[]) => void;
  hideOnDisable?: boolean;
};

export type TableSwitchType = {
  defaultActive?: 'list' | 'app';
  onListClick: () => void;
  onAppClick: () => void;
};

/**
 * postion: toolbar 位置
 * component: type 不是 iconBtn/button/switch 时，渲染该组件
 */
export type ToolBarConfig = Partial<TableSwitchType> &
  Partial<SearchType> & {
    label: string;
    icon?: IconsType;
    color?: ColorType;
    // type 不是 iconBtn 时，onClick 可选
    onClick?: (arg0: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    disabled?: (data: any[]) => boolean;
    tooltip?: string;
    // disabled 时会用 "disabledTooltip" 替代 "tooltip"
    disabledTooltip?: string;
    hidden?: boolean;
    type?: 'iconBtn' | 'button' | 'switch' | 'select' | 'groupSelect';
    position?: 'right' | 'left';
    component?: ReactElement;
    btnVariant?: 'contained' | 'outlined' | 'text';
    btnColor?: 'primary' | 'secondary';
    alwaysShow?: boolean;
    hideOnDisable?: () => boolean;
  };

export type TableHeadType = {
  onSelectAllClick: (e: React.ChangeEvent) => void;
  order?: SortDirection;
  orderBy?: string;
  numSelected: number;
  rowCount: number;
  colDefinitions: ColDefinitionsType[];
  handleSort?: (e: any, p: string, col?: ColDefinitionsType) => void;
  openCheckBox?: boolean;
  disableSelect?: boolean;
  enableSelectAll?: boolean;
};

export type TableEditableHeadType = {
  editHeads: EditableHeads[];
};

export type EditableHeads = {
  component: ReactElement;
  value: string;
};

export type TableType = {
  selected: any[];
  onSelected: (e: React.MouseEvent, row: any) => void;
  isSelected: (data: any[]) => boolean;
  onSelectedAll: (e: React.ChangeEvent) => void;
  rowHeight: number;
  rows?: any[];
  colDefinitions: ColDefinitionsType[];
  primaryKey: string;
  openCheckBox?: boolean;
  disableSelect?: boolean;
  enableSelectAll?: boolean;
  rowDecorator?: (row: any) => SxProps<Theme> | React.CSSProperties;
  noData?: string;
  showHoverStyle?: boolean;
  isLoading?: boolean;
  headEditable?: boolean;
  editHeads: EditableHeads[];
  // 带单位，如 '20px'
  tableCellMaxWidth?: string;
  handleSort?: (e: any, orderBy: string) => void;
  order?: SortDirection;
  orderBy?: string;
  ref?: Ref<HTMLDivElement>;
  // 是否添加 spacer 列以控制空间分配
  addSpacerColumn?: boolean;
};

export type ColDefinitionsType = {
  id: string;
  align?: 'inherit' | 'left' | 'center' | 'right' | 'justify' | undefined;
  disablePadding: boolean;
  label: React.ReactNode;
  needCopy?: boolean;
  showActionCell?: boolean;
  isHoverAction?: boolean;
  notSort?: boolean;
  // 自定义排序规则字段，默认为行 id
  sortBy?: string;
  sortType?: 'string' | 'number';
  onClick?: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    data?: any
  ) => void;
  getStyle?: (data: any) => {};
  formatter?: (data: any, cellData?: any, cellIndex?: number) => any;
  headerFormatter?: (def: ColDefinitionsType) => React.ReactNode;
  onConnect?: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    data: any
  ) => void;
  actionBarConfigs?: ActionBarConfig[];
};

export type AttuGridType = ToolBarType & {
  showPagination?: boolean;
  rowCount: number;
  rowsPerPage?: number;
  // 用于根据表格容器与行高动态设置分页大小
  setRowsPerPage?: (size: number) => void;
  primaryKey: string;
  onPageChange?: (e: any, nextPageNum: number) => void;
  labelDisplayedRows?: (obj: LabelDisplayedRowsArgs) => React.ReactNode;
  page?: number;
  showToolbar?: boolean;
  rows: any[];
  colDefinitions: ColDefinitionsType[];
  isLoading?: boolean;
  title?: string[];
  openCheckBox?: boolean;
  disableSelect?: boolean;
  enableSelectAll?: boolean;
  noData?: string;
  showHoverStyle?: boolean;
  headEditable?: boolean;
  editHeads?: EditableHeads[];
  // 带单位，如 '20px'
  tableCellMaxWidth?: string;
  handleSort?: (e: any, orderBy: string) => void;
  order?: SortDirection;
  orderBy?: string;
  tableHeaderHeight?: number;
  rowHeight?: number;
  hideOnDisable?: boolean;
  pagerHeight?: number;
  rowDecorator?: (row: any) => SxProps<Theme> | React.CSSProperties;
  sx?: SxProps<Theme>;
  // 是否添加 spacer 列以控制空间分配
  addSpacerColumn?: boolean;
};

export type ActionBarType = {
  configs: ActionBarConfig[];
  row: any;
  isHoverType?: boolean;
};

type ActionBarConfig = {
  onClick: (e: React.MouseEvent, row: any) => void;
  icon?: IconsType;
  text?: string;
  showIconMethod?: 'iconType' | 'renderFn';
  renderIconFn?: (row: any) => ReactElement;
  label?: string;
  getLabel?: (row: any) => string;
  className?: string;
  disabled?: (row: any) => boolean;
};

export type TablePaginationActionsProps = {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (
    event: React.MouseEvent<HTMLButtonElement>,
    newPage: number
  ) => void;
};
