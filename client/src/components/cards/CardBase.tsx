import { FC, ReactNode } from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import { designTokens } from '@/styles/theme';

export interface CardBaseProps {
  children: ReactNode;
  onClick?: () => void;
  /** Highlight card with primary-color border (active state). */
  active?: boolean;
  /** Render a dashed-border placeholder style (for "add new" tiles). */
  dashed?: boolean;
  /** Minimum tile size — square cards use the default. */
  minWidth?: number | string;
  minHeight?: number | string;
  sx?: SxProps<Theme>;
}

/**
 * Unified card/tile primitive used by all "grid of cards" pages (Home databases,
 * repos, GitLab repos, SysCards, etc.). Shares a single hover / focus /
 * active style so all cards behave the same.
 *
 * Visual spec:
 * - 8px radius (theme.shape.borderRadius)
 * - 1px hairline border (theme.divider)
 * - subtle shadow on hover + border darkens to primary.main
 * - 200ms ease-in-out transition
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
