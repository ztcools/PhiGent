import { FC, ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

export interface PageHeaderProps {
  /** 页面标题（已翻译 / 本地化）。 */
  title: ReactNode;
  /** 可选的副标题 / 提示文案，显示在标题下方。 */
  subtitle?: ReactNode;
  /** 可选的计数徽标，显示在标题旁，例如条目总数。 */
  count?: number;
  /** 右对齐的操作区（按钮 / chips / 状态指示器）。 */
  actions?: ReactNode;
}

/**
 * 所有自定义（非 Attu 原生）页面使用的标准页面级 Header。
 *
 * 视觉规范：
 * - h4 标题，字重 600
 * - 计数以括号包裹，次要色，与标题同基线
 * - 副标题使用 body2 / text.secondary
 * - 操作区右对齐，间距 16px
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
