import { FC } from 'react';
import { Typography, useTheme, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import icons from '@/components/icons/Icons';
import { GitRepo, RepoRunStatus } from '@/pages/gitlab/service';

export interface GitRepoCardProps {
  repo: GitRepo & { lastRun: RepoRunStatus | null };
}

const GitRepoCard: FC<GitRepoCardProps> = ({ repo }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const Icon = icons.source;

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
          minWidth: '140px',
          minHeight: '128px',
          cursor: 'pointer',
          borderRadius: 2,
          '&:hover': { borderColor: theme => theme.palette.primary.main },
        }}
        onClick={() => navigate('/gitlab')}
      >
        <Icon sx={{ width: 24, height: 24 }} />
        <Typography
          variant="h3"
          sx={{
            fontSize: '16px',
            lineHeight: '1.3',
            fontWeight: 500,
            mb: 1,
            maxWidth: '160px',
            wordBreak: 'break-all',
          }}
        >
          {repo.name}
        </Typography>
        <Box>
          <Typography sx={{ fontSize: '12px', color: theme => theme.palette.text.secondary }}>
            {repo.branch}
          </Typography>
          <Typography
            sx={{
              fontSize: '13px',
              fontWeight: 600,
              mb: 0.5,
              color: repo.lastRun
                ? repo.lastRun.ok
                  ? theme.palette.primary.main
                  : theme.palette.error.main
                : theme.palette.text.secondary,
            }}
          >
            {repo.lastRun ? (repo.lastRun.ok ? repo.lastRun.mode : '失败') : '未索引'}
          </Typography>
          {repo.lastRun && (
            <Typography sx={{ fontSize: '12px', color: theme => theme.palette.text.secondary }}>
              {dayjs(repo.lastRun.at).format('MM-DD HH:mm')}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default GitRepoCard;
