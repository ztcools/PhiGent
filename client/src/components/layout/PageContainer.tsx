import { FC, ReactNode } from 'react';
import { Box, SxProps, Theme } from '@mui/material';

export interface PageContainerProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
}

/**
 * 标准可滚动页面主体。内边距使用 theme 的 spacing token，
 * 让所有自定义页面保持相同的外边距。
 */
const PageContainer: FC<PageContainerProps> = ({ children, sx }) => {
  return (
    <Box
      sx={[
        {
          p: 3,
          height: '100%',
          overflow: 'auto',
          boxSizing: 'border-box',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
};

export default PageContainer;
