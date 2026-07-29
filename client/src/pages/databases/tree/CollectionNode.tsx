import React from 'react';
import { Tooltip, Typography, Box, IconButton } from '@mui/material';
import { CollectionObject } from '@server/types';
import { formatNumber } from '@/utils';
import { TreeNodeBox, Count, StatusDot } from './StyledComponents';
import HighlightText from './HighlightText';
import icons from '@/components/icons/Icons';

interface CollectionNodeProps {
  data: CollectionObject;
  /** 覆盖显示名（分支子节点只显示分支名，缺省用 collection_name） */
  displayName?: string;
  highlight?: string;
  isSelected?: boolean;
  isContextMenuTarget?: boolean;
  hasChildren?: boolean;
  isExpanded?: boolean;
  depth?: number;
  onToggleExpand?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const CollectionNode: React.FC<CollectionNodeProps> = ({
  data,
  displayName,
  highlight = '',
  isSelected = false,
  isContextMenuTarget = false,
  hasChildren = false,
  isExpanded = false,
  depth = 0,
  onToggleExpand,
  onClick,
  onContextMenu,
}) => {
  const label = displayName ?? data.collection_name;
  const ExpandIcon = icons.rightArrow;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand?.(e);
  };

  return (
    <TreeNodeBox
      isSelected={isSelected}
      isContextMenuTarget={isContextMenuTarget}
      isCollectionNoSchema={!data.schema}
      depth={depth}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {hasChildren && (
        <IconButton size="small" onClick={handleToggleExpand} sx={{ mr: 0 }}>
          {isExpanded ? (
            <ExpandIcon sx={{ transform: `rotate(90deg)` }} />
          ) : (
            <ExpandIcon />
          )}
        </IconButton>
      )}

      <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
        <StatusDot status={getStatus(data)} />
      </Box>

      <Tooltip title={data.collection_name} placement="top">
        <Typography noWrap className="collectionName">
          <HighlightText text={label} highlight={highlight} />
        </Typography>
      </Tooltip>
      <Count>({formatNumber(data.rowCount || 0)})</Count>
    </TreeNodeBox>
  );
};

const getStatus = (data: CollectionObject) => {
  if (!data.schema || !data.schema.hasVectorIndex) return 'noIndex';
  if (data.status === 'loading') return 'loading';
  return data.loaded ? 'loaded' : 'unloaded';
};

export default CollectionNode;
