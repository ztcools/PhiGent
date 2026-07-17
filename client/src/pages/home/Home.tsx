import { useContext, useEffect, useMemo, useState } from 'react';
import { Typography, Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  dataContext,
  systemContext,
  authContext,
  rootContext,
} from '@/context';
import { MILVUS_DEPLOY_MODE } from '@/consts';
import { useNavigationHook } from '@/hooks';
import { ROUTE_PATHS } from '@/config/routes';
import { CollectionService } from '@/http';
import DatabaseCard from './DatabaseCard';
import RepoCard, { RepoInfo } from './RepoCard';
import GitRepoCard from './GitRepoCard';
import { GitIndexService, GitRepo, RepoRunStatus } from '@/pages/gitlab/service';
import CreateDatabaseDialog from '../dialogs/CreateDatabaseDialog';
import icons from '@/components/icons/Icons';
import SysCard from './SysCard';
import StatusIcon, { LoadingType } from '@/components/status/StatusIcon';
import CommunityLinks from '@/pages/home/CommunityLinks';

const INDEX_STATE_COLLECTION = 'code_index_state';

const repoNameOf = (repoUrl: string): string => {
  const seg = repoUrl.replace(/\.git$/i, '').split(/[/:]/).filter(Boolean).pop();
  return seg || repoUrl;
};

const Home = () => {
  useNavigationHook(ROUTE_PATHS.HOME);
  const navigate = useNavigate();
  const {
    databases,
    database,
    collections,
    loadingDatabases,
    setDatabase,
    fetchDatabases,
  } = useContext(dataContext);
  const { data } = useContext(systemContext);
  const { t: homeTrans } = useTranslation('home');
  const { t: databaseTrans } = useTranslation('database');

  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [gitRepos, setGitRepos] = useState<(GitRepo & { lastRun: RepoRunStatus | null })[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await GitIndexService.status();
        if (!cancelled) setGitRepos(s.repos || []);
      } catch {
        if (!cancelled) setGitRepos([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Skip querying code_index_state when it doesn't exist yet (fresh Milvus),
        // otherwise attu pops a global "collection not found" error toast.
        const names: string[] = await CollectionService.getCollectionsNames({
          db_name: 'default',
        }).catch(() => []);
        if (!names.includes(INDEX_STATE_COLLECTION)) {
          if (!cancelled) setRepos([]);
          return;
        }
        const res: any = await CollectionService.queryData(
          INDEX_STATE_COLLECTION,
          { expr: 'id != ""', output_fields: ['content'], limit: 16384 }
        );
        const rows: any[] = res?.data || res?.results || res || [];
        const byRepo = new Map<string, RepoInfo>();
        for (const row of rows) {
          let s: any;
          try {
            s = JSON.parse(row.content);
          } catch {
            continue;
          }
          if (!s || !s.identity || !s.headCommit) continue;
          const url = s.repoUrl || '(local)';
          const isRoot = !s.baseIdentity;
          const branch = s.repoUrl && s.identity.startsWith(s.repoUrl + ':')
            ? s.identity.slice(s.repoUrl.length + 1)
            : s.identity.slice(s.identity.lastIndexOf(':') + 1);
          const cur = byRepo.get(url) || {
            repoUrl: url,
            repoName: repoNameOf(url),
            branchCount: 0,
            rootBranch: '',
            updatedAt: 0,
          };
          cur.branchCount += 1;
          if (isRoot) cur.rootBranch = branch;
          if (s.updatedAt && s.updatedAt > cur.updatedAt) cur.updatedAt = s.updatedAt;
          byRepo.set(url, cur);
        }
        if (!cancelled) {
          setRepos(
            Array.from(byRepo.values()).sort((a, b) =>
              a.repoName.localeCompare(b.repoName)
            )
          );
        }
      } catch {
        if (!cancelled) setRepos([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // calculation diff to the rootCoord create time
  const duration = useMemo(() => {
    let rootCoordCreatedTime = data.rootCoord?.infos?.created_time;

    let duration = 0;
    let unit = '';
    if (rootCoordCreatedTime) {
      if (rootCoordCreatedTime.lastIndexOf('m=') !== -1) {
        rootCoordCreatedTime = rootCoordCreatedTime.substring(
          0,
          rootCoordCreatedTime.lastIndexOf('m=')
        );
      }

      const rootCoordCreatedTimeObj = dayjs(rootCoordCreatedTime);

      const now = dayjs();
      const minDiff = now.diff(rootCoordCreatedTimeObj, 'minute', true);
      const dayDiff = now.diff(rootCoordCreatedTimeObj, 'day', true);
      const hourDiff = now.diff(rootCoordCreatedTimeObj, 'hour', true);
      const withinOneHour = minDiff < 60;
      const withinOneDay = hourDiff < 24;
      duration = withinOneHour ? minDiff : withinOneDay ? hourDiff : dayDiff;
      unit = withinOneHour
        ? homeTrans('minutes')
        : withinOneDay
          ? homeTrans('hours')
          : homeTrans('day');
    }

    return `${duration.toFixed(2)} ${unit}`;
  }, [data.rootCoord]);

  const { isServerless } = useContext(authContext);
  const { setDialog } = useContext(rootContext);
  const PlusIcon = icons.add;

  const handleCreateDbClick = () => {
    if (isServerless) {
      window.open('https://cloud.zilliz.com/', '_blank');
      return;
    }
    setDialog({
      open: true,
      type: 'custom',
      params: {
        component: <CreateDatabaseDialog />,
      },
    });
  };

  return (
    <Box
      sx={theme => ({
        margin: '12px',
        position: 'relative',
        display: 'flex',
        gap: 2,
        height: 'calc(100vh - 80px)',
        pr: 2,
        overflow: 'hidden',
      })}
    >
      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'auto',
        }}
      >
        <Box
          sx={{
            mb: 1.5,
            px: 0.5,
            maxWidth: '100%',
          }}
        >
          <Box display="flex" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center">
              <Typography
                variant="h4"
                sx={{
                  mr: 1,
                  position: 'relative',
                  top: 8,
                  mb: 2,
                  color: theme => theme.palette.text.primary,
                }}
              >
                {databaseTrans('databases')}
              </Typography>
              <Typography
                component="span"
                variant="subtitle1"
                color="textSecondary"
                sx={{ position: 'relative', top: 1, mr: 2 }}
              >
                ({databases.length})
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={handleCreateDbClick}
              sx={{
                ml: 0,
                minWidth: 24,
                width: 24,
                height: 24,
                p: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PlusIcon sx={{ fontSize: 20 }} />
            </Button>
          </Box>
          {loadingDatabases ? (
            <StatusIcon type={LoadingType.CREATING} />
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                flexGrow: 0,
                gap: 1.5,
              }}
            >
              {databases.map(db => {
                if (db.name === database) {
                  db.collections = collections.map(c => c.collection_name);
                }
                return (
                  <DatabaseCard
                    database={db}
                    isActive={db.name === database}
                    setDatabase={setDatabase}
                    fetchDatabases={fetchDatabases}
                    key={db.name}
                  />
                );
              })}
            </Box>
          )}
        </Box>

        {repos.length > 0 && (
          <Box
            sx={{
              mb: 1.5,
              px: 0.5,
              maxWidth: '100%',
            }}
          >
            <Box display="flex" alignItems="center" mb={2}>
              <Typography
                variant="h4"
                sx={{
                  mr: 1,
                  position: 'relative',
                  top: 8,
                  mb: 2,
                  color: theme => theme.palette.text.primary,
                }}
              >
                {homeTrans('indexTree')}
              </Typography>
              <Typography
                component="span"
                variant="subtitle1"
                color="textSecondary"
                sx={{ position: 'relative', top: 1, mr: 2 }}
              >
                ({repos.length})
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                flexGrow: 0,
                gap: 1.5,
              }}
            >
              {repos.map(repo => (
                <RepoCard repo={repo} key={repo.repoUrl} />
              ))}
            </Box>
          </Box>
        )}

        <Box sx={{ mb: 1.5, px: 0.5, maxWidth: '100%' }}>
          <Box display="flex" alignItems="center" mb={2}>
            <Typography
              variant="h4"
              sx={{
                mr: 1,
                position: 'relative',
                top: 8,
                mb: 2,
                color: theme => theme.palette.text.primary,
              }}
            >
              {homeTrans('gitlabRepos')}
            </Typography>
            <Typography
              component="span"
              variant="subtitle1"
              color="textSecondary"
              sx={{ position: 'relative', top: 1, mr: 2 }}
            >
              ({gitRepos.length})
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', flexGrow: 0, gap: 1.5 }}>
            {gitRepos.map(repo => (
              <GitRepoCard repo={repo} key={repo.name} />
            ))}
            <Box
              component="section"
              onClick={() => navigate('/gitlab')}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                minWidth: '140px',
                minHeight: '128px',
                cursor: 'pointer',
                borderRadius: 2,
                border: theme => `1px dashed ${theme.palette.divider}`,
                color: theme => theme.palette.text.secondary,
                '&:hover': {
                  borderColor: theme => theme.palette.primary.main,
                  color: theme => theme.palette.primary.main,
                },
              }}
            >
              <PlusIcon sx={{ fontSize: 28 }} />
              <Typography sx={{ fontSize: 13 }}>
                {gitRepos.length > 0 ? homeTrans('manageRepos') : homeTrans('addRepo')}
              </Typography>
            </Box>
          </Box>
        </Box>

        {data?.systemInfo && (
          <>
            <Box
              sx={{
                mb: 1.5,
                px: 0.5,
              }}
            >
              <Typography
                variant="h4"
                sx={{ mb: 2, color: theme => theme.palette.text.primary }}
              >
                {homeTrans('sysInfo')}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  flexGrow: 0,
                  gap: 2,
                }}
              >
                <SysCard
                  title={'Milvus Version'}
                  count={data?.systemInfo?.build_version}
                  link="system"
                />

                <SysCard
                  title={homeTrans('deployMode')}
                  count={data?.deployMode}
                  link="system"
                />
                <SysCard
                  title={homeTrans('upTime')}
                  count={duration}
                  link="system"
                />

                <SysCard
                  title={homeTrans('users')}
                  count={data?.users?.length}
                  link="users"
                />
                <SysCard
                  title={homeTrans('roles')}
                  count={data?.roles?.length}
                  link="roles"
                />
              </Box>
            </Box>

            {data?.deployMode === MILVUS_DEPLOY_MODE.DISTRIBUTED && (
              <Box
                sx={{
                  mb: 1.5,
                  px: 2,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    flexGrow: 0,
                    gap: 2,
                  }}
                >
                  <SysCard
                    title={homeTrans('dataNodes')}
                    count={data?.dataNodes?.length}
                    link="system"
                  />
                  <SysCard
                    title={homeTrans('indexNodes')}
                    count={data?.indexNodes?.length}
                    link="system"
                  />
                  <SysCard
                    title={homeTrans('queryNodes')}
                    count={data?.queryNodes?.length}
                    link="system"
                  />
                </Box>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Right sidebar */}
      <Box
        sx={{
          width: 280,
          flexShrink: 0,
          display: { xs: 'none', md: 'block' },
          height: 'fit-content',
        }}
      >
        <CommunityLinks />
      </Box>
    </Box>
  );
};

export default Home;
