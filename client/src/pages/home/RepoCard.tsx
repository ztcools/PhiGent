import { FC } from 'react';
import { Typography, useTheme, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import icons from '@/components/icons/Icons';

export interface RepoInfo {
  repoUrl: string;
  repoName: string;
  branchCount: number;
  rootBranch: string;
  updatedAt: number;
}

export interface RepoCardProps {
  repo: RepoInfo;
}

const RepoCard: FC<RepoCardProps> = ({ repo }) => {
  const { t: homeTrans } = useTranslation('home');
  const navigate = useNavigate();
  const theme = useTheme();
  const RepoIcon = icons.source;

  const onClick = () => {
    navigate('/index-tree');
  };

  return (
    <Box component="section">
      <Box
        component="section"
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          backgroundColor: theme => theme.palette.background.paper,
          color: theme => theme.palette.text.primary,
          padding: 2,
          border: theme => `1px solid ${theme.palette.divider}`,
          minWidth: '128px',
          minHeight: '128px',
          cursor: 'pointer',
          borderRadius: 2,
          '&:hover': {
            borderColor: theme => theme.palette.primary.main,
          },
        }}
        onClick={onClick}
      >
        <RepoIcon sx={{ width: 24, height: 24 }} />
        <Typography
          variant="h3"
          sx={{
            fontSize: '16px',
            lineHeight: '1.3',
            fontWeight: '500',
            mb: 1,
            maxWidth: '160px',
            wordBreak: 'break-all',
          }}
        >
          {repo.repoName}
        </Typography>
        <Box>
          <Typography
            sx={{
              fontSize: '12px',
              lineHeight: '16px',
              color: theme => theme.palette.text.secondary,
            }}
          >
            {homeTrans('branches')}
          </Typography>
          <Typography
            sx={{
              fontSize: '24px',
              lineHeight: '28px',
              fontWeight: 'bold',
              mb: 1,
              color: theme.palette.primary.main,
            }}
          >
            {repo.branchCount}
          </Typography>
          {repo.updatedAt > 0 && (
            <>
              <Typography
                sx={{
                  fontSize: '12px',
                  lineHeight: '16px',
                  color: theme => theme.palette.text.secondary,
                }}
              >
                {homeTrans('createdTime')}
              </Typography>
              <Typography
                sx={{
                  fontSize: '12px',
                  lineHeight: '16px',
                  color: theme => theme.palette.text.secondary,
                }}
              >
                {new Date(repo.updatedAt).toLocaleString()}
              </Typography>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default RepoCard;
