import { FC } from 'react';
import { Typography, useTheme, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import icons from '@/components/icons/Icons';
import CardBase from '@/components/cards/CardBase';
import { GitRepo, RepoRunStatus } from '@/pages/gitlab/service';

export interface GitRepoCardProps {
  repo: GitRepo & { lastRuns?: Record<string, RepoRunStatus | null> };
}

const GitRepoCard: FC<GitRepoCardProps> = ({ repo }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const Icon = icons.source;

  const mainBranch = repo.branch || 'main';
  const mainRun = repo.lastRuns?.[mainBranch];

  return (
    <Box component="section">
      <CardBase minWidth={140} onClick={() => navigate('/gitlab')}>
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
          <Typography
            sx={{
              fontSize: '12px',
              color: theme => theme.palette.text.secondary,
            }}
          >
            {mainBranch}
            {repo.protectedBranches?.length
              ? ` +${repo.protectedBranches.length} 保护分支`
              : ''}
          </Typography>
          <Typography
            sx={{
              fontSize: '13px',
              fontWeight: 600,
              mb: 0.5,
              color: mainRun
                ? mainRun.ok
                  ? theme.palette.primary.main
                  : theme.palette.error.main
                : theme.palette.text.secondary,
            }}
          >
            {mainRun ? (mainRun.ok ? mainRun.mode : '失败') : '未索引'}
          </Typography>
          {mainRun && (
            <Typography
              sx={{
                fontSize: '12px',
                color: theme => theme.palette.text.secondary,
              }}
            >
              {dayjs(mainRun.at).format('MM-DD HH:mm')}
            </Typography>
          )}
        </Box>
      </CardBase>
    </Box>
  );
};

export default GitRepoCard;
