import { FC } from 'react';
import { Typography, useTheme, Box, Tooltip } from '@mui/material';
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

  // 被索引的分支就是「仓库管理」里配的那些 —— 主分支 + 保护分支。卡片很窄，一行
  // 放不下就省略号截断，完整列表连同各自的索引结果放进 tooltip（分支名本来是已知
  // 信息，没必要让用户点进仓库管理页才看得到）。
  const extraBranches = (repo.protectedBranches || []).filter(
    b => b && b !== mainBranch
  );
  const allBranches = [mainBranch, ...extraBranches];
  const branchLine = allBranches.join(', ');
  const branchTip = (
    <Box component="span" sx={{ display: 'block', whiteSpace: 'pre-line' }}>
      {allBranches
        .map(b => {
          const run = repo.lastRuns?.[b];
          const state = run ? (run.ok ? run.mode || '成功' : '失败') : '未索引';
          return `${b}${b === mainBranch ? '（主）' : ''} — ${state}`;
        })
        .join('\n')}
    </Box>
  );

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
          <Tooltip title={branchTip} placement="top" arrow>
            <Typography
              noWrap
              sx={{
                fontSize: '12px',
                color: theme => theme.palette.text.secondary,
                maxWidth: '160px',
              }}
            >
              {branchLine}
              {extraBranches.length ? ` (${allBranches.length})` : ''}
            </Typography>
          </Tooltip>
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
