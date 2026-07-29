import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';

const SKELETON_ROWS = 5;

/**
 * Placeholder shown while a grid is loading. Renders a column of shimmering
 * skeleton bars so the table area doesn't pop in empty when data arrives.
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
