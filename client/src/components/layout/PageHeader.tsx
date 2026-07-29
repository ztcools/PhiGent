import { FC, ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

export interface PageHeaderProps {
  /** Page title (already translated / localized). */
  title: ReactNode;
  /** Optional small subtitle / hint text shown below the title. */
  subtitle?: ReactNode;
  /** Optional count badge shown next to the title, e.g. total items. */
  count?: number;
  /** Right-aligned actions (buttons / chips / status indicators). */
  actions?: ReactNode;
}

/**
 * Standard page-level header used by all custom (非 Attu 原生) pages.
 *
 * Visual spec:
 * - h4 title, weight 600
 * - count in parens, secondary color, sits on the same baseline
 * - subtitle in body2 / text.secondary
 * - actions right-aligned with 16px gap
 */
const PageHeader: FC<PageHeaderProps> = ({
  title,
  subtitle,
  count,
  actions,
}) => {
  return (
    <Box sx={{ mb: subtitle ? 1 : 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {typeof count === 'number' && (
          <Typography
            component="span"
            sx={{ color: 'text.secondary', fontSize: 15 }}
          >
            ({count})
          </Typography>
        )}
        {actions && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              ml: 'auto',
              flexWrap: 'wrap',
            }}
          >
            {actions}
          </Box>
        )}
      </Box>
      {subtitle && (
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', mt: 0.5 }}
        >
          {subtitle}
        </Typography>
      )}
    </Box>
  );
};

export default PageHeader;
