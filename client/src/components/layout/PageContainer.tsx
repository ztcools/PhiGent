import { FC, ReactNode } from 'react';
import { Box, SxProps, Theme } from '@mui/material';

export interface PageContainerProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
}

/**
 * Standard scrollable page body. Uses theme spacing tokens for padding so
 * all custom pages share the same outer whitespace.
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
