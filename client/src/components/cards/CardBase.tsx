import { FC, ReactNode } from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import { designTokens } from '@/styles/theme';

export interface CardBaseProps {
  children: ReactNode;
  onClick?: () => void;
  /** 高亮卡片：使用主题色边框（激活态） */
  active?: boolean;
  /** 渲染虚线边框的占位样式（用于「新增」卡片） */
  dashed?: boolean;
  /** 卡片最小尺寸 — 正方形卡片使用默认值 */
  minWidth?: number | string;
  minHeight?: number | string;
  sx?: SxProps<Theme>;
}

/**
 * 通用的卡片/瓦片基础组件，供所有「卡片网格」页面使用（首页数据库、仓库、
 * GitLab 仓库、SysCards 等）。统一 hover / focus / 激活态样式，
 * 保证所有卡片行为一致。
 *
 * 视觉规范：
 * - 8px 圆角（theme.shape.borderRadius）
 * - 1px 细线边框（theme.divider）
 * - hover 时轻微阴影 + 边框加深为 primary.main
 * - 200ms ease-in-out 过渡
 */
const CardBase: FC<CardBaseProps> = ({
  children,
  onClick,
  active = false,
  dashed = false,
  minWidth = 128,
  minHeight = 128,
  sx,
}) => {
  return (
    <Box
      component="section"
      onClick={onClick}
      sx={[
        (theme: Theme) => ({
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing(1),
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          padding: theme.spacing(2),
          border: `1px ${dashed ? 'dashed' : 'solid'} ${theme.palette.divider}`,
          minWidth,
          minHeight,
          cursor: onClick ? 'pointer' : 'default',
          borderRadius: 2,
          transition: designTokens.transition.base,
          boxShadow: designTokens.shadow.card,
          ...(onClick && {
            '&:hover': {
              borderColor: theme.palette.primary.main,
              boxShadow: designTokens.shadow.cardHover,
              transform: 'translateY(-1px)',
            },
          }),
          ...(active && {
            borderColor: theme.palette.primary.main,
            boxShadow: designTokens.shadow.cardHover,
          }),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
};

export default CardBase;
