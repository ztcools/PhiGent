import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import icons from '@/components/icons/Icons';
import HighlightText from './HighlightText';

interface RepoNodeProps {
  repo: string;
  branchCount: number;
  highlight?: string;
}

/**
 * 仓库主行（code collection 一级节点）：显示仓库名 + 分支数。
 * 点击展开后，main 与各保护分支作为子节点列出。
 */
const RepoNode: React.FC<RepoNodeProps> = ({ repo, branchCount, highlight = '' }) => {
  const RepoIcon = icons.database;
  return (
    <>
      <Box
        sx={{
          mr: 1,
          display: 'flex',
          alignItems: 'center',
          color: 'primary.main',
          flexShrink: 0,
        }}
      >
        <RepoIcon sx={{ fontSize: 16 }} />
      </Box>
      <Tooltip title={`${repo} (${branchCount} 分支)`} placement="top">
        <Typography noWrap sx={{ flex: 1, fontWeight: 600, minWidth: 0 }}>
          <HighlightText text={repo} highlight={highlight} />
          <Box
            component="span"
            sx={{
              ml: 0.5,
              color: 'text.secondary',
              fontWeight: 400,
              fontSize: '0.85em',
            }}
          >
            ({branchCount})
          </Box>
        </Typography>
      </Tooltip>
    </>
  );
};

export default RepoNode;
