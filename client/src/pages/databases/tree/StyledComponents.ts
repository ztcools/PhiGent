import { styled } from '@mui/material/styles';
import { Box, MenuItem, Divider } from '@mui/material';

export const Count = styled('span')(({ theme }) => ({
  fontSize: '11px',
  fontWeight: 500,
  marginLeft: theme.spacing(0.5),
  color: theme.palette.text.secondary,
  pointerEvents: 'none',
  flexShrink: 0,
}));

export const StatusDot = styled(Box, {
  shouldForwardProp: prop => prop !== 'status',
})<{ status: 'loaded' | 'unloaded' | 'loading' | 'noIndex' }>(
  ({ theme, status }) => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
    ...(status === 'loaded' && {
      border: `1px solid ${theme.palette.primary.main}`,
      backgroundColor: theme.palette.primary.main,
    }),
    ...(status === 'unloaded' && {
      border: `1px solid ${theme.palette.primary.main}`,
      backgroundColor: theme.palette.background.paper,
    }),
    ...(status === 'loading' && {
      border: `1px solid ${theme.palette.primary.light}`,
      backgroundColor: theme.palette.primary.light,
    }),
    ...(status === 'noIndex' && {
      border: `1px solid ${theme.palette.text.disabled}`,
      backgroundColor: theme.palette.text.disabled,
    }),
  })
);

export const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  fontSize: '14px',
  padding: '6px 16px',
}));

export const StyledDivider = styled(Divider)(({ theme }) => ({
  margin: 0,
}));

// New styled components for tree view
export const TreeContainer = styled(Box)(({ theme }) => ({
  height: 'calc(100vh - 64px)',
  overflow: 'auto',
  fontSize: '14px',
  color: theme.palette.text.primary,
  '& .MuiSvgIcon-root': {
    fontSize: '14px',
    color: theme.palette.text.primary,
  },
  '&::-webkit-scrollbar': {
    width: '6px',
    height: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background:
      theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.15)'
        : 'rgba(0, 0, 0, 0.15)',
    borderRadius: '3px',
    '&:hover': {
      background:
        theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.25)'
          : 'rgba(0, 0, 0, 0.25)',
    },
  },
  '& > div': {
    width: '100%',
  },
}));

export const TreeContent = styled(Box)({
  height: '100%',
  width: '100%',
  position: 'relative',
  overflow: 'hidden',
});

export const NoResultsBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100px',
  color: theme.palette.text.secondary,
  fontSize: '13px',
}));

export const TreeNodeBox = styled(Box, {
  shouldForwardProp: prop =>
    ![
      'isSelected',
      'isContextMenuTarget',
      'isCollectionNoSchema',
      'depth',
    ].includes(prop as string),
})<{
  isSelected: boolean;
  isContextMenuTarget: boolean;
  isCollectionNoSchema: boolean;
  depth: number;
}>(({ theme, isSelected, isContextMenuTarget, isCollectionNoSchema, depth }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '30px',
  transform: 'translateY(0)',
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  // depth=0: 8px (root level) — depth>=1: 12px per level (sub-tree indent)
  paddingLeft: `${depth === 0 ? 8 : depth * 12}px`,
  paddingRight: '8px',
  boxSizing: 'border-box',
  backgroundColor: isSelected
    ? theme.palette.primary.light
    : 'transparent',
  borderLeft: isSelected
    ? `2px solid ${theme.palette.primary.main}`
    : '2px solid transparent',
  transition:
    'background-color 0.15s ease-in-out, border-color 0.15s ease-in-out',
  '&:hover': {
    backgroundColor:
      theme.palette.mode === 'light'
        ? 'rgba(9, 181, 114, 0.06)'
        : 'rgba(9, 181, 114, 0.12)',
  },
  // Right-click context menu target gets the same affordance as selected
  ...(isContextMenuTarget && {
    backgroundColor: theme.palette.primary.light,
  }),
  opacity: isCollectionNoSchema ? 0.5 : 1,
  color: isCollectionNoSchema ? theme.palette.text.disabled : 'inherit',
  pointerEvents: isCollectionNoSchema ? 'none' : 'auto',
}));

export const SearchBoxContainer = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '30px',
  transform: 'translateY(0)',
  boxSizing: 'border-box',
});

export const NodeContent = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  minWidth: 0,
  paddingRight: '4px',
});

export const SearchButton = styled(Box)(({ theme }) => ({
  padding: '4px',
  marginLeft: theme.spacing(1),
  borderRadius: '4px',
  transition: 'background-color 0.15s ease-in-out',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

export const CollectionCount = styled('span')(({ theme }) => ({
  marginLeft: 8,
  color: theme.palette.text.secondary,
  fontSize: 12,
}));
