import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';

const SKELETON_ROWS = 5;

/**
 * 表格加载中展示的占位内容。渲染一列闪烁的骨架条，
 * 避免数据到达时表格区域突然从空白弹出。
 */
const LoadingTable = (props: { wrapperClass?: string }) => {
  const { wrapperClass = '' } = props;

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={1}
      px={2}
      py={1}
      className={wrapperClass}
      role="status"
      aria-label="加载中"
      sx={{ width: '100%', boxSizing: 'border-box' }}
    >
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rectangular"
          height={32}
          sx={{ borderRadius: 1 }}
        />
      ))}
    </Box>
  );
};

export default LoadingTable;
