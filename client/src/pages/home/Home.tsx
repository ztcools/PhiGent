import { useContext, useEffect, useMemo, useState } from 'react';
import { Typography, Box, Button, Skeleton } from '@mui/material';
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
import CommunityLinks from '@/pages/home/CommunityLinks';

const INDEX_STATE_COLLECTION = 'code_index_state';

const repoNameOf = (repoUrl: string): string => {
  const seg = repoUrl.replace(/\.git$/i, '').split(/[/:]/).filter(Boolean).pop();
  return seg || repoUrl;
};

interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: React.ReactNode;
}

const SectionHeader = ({ title, count, action }: SectionHeaderProps) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      mb: 1.5,
    }}
  >
    <Typography variant="h5" sx={{ fontWeight: 600 }}>
      {title}
    </Typography>
    {typeof count === 'number' && (
      <Typography component="span" sx={{ color: 'text.secondary', fontSize: 14 }}>
        ({count})
      </Typography>
    )}
    {action}
  </Box>
);

const CARD_SKELETON_KEYS = ['a', 'b', 'c', 'd'];

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
  const [gitRepos, setGitRepos] = useState<(GitRepo & { lastRuns?: Record<string, RepoRunStatus | null> })[]>([]);
  const [gitReposLoaded, setGitReposLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await GitIndexService.status();
        if (!cancelled) setGitRepos(s.repos || []);
      } catch {
        if (!cancelled) setGitRepos([]);
      } finally {
        if (!cancelled) setGitReposLoaded(true);
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
  }, [data.rootCoord, homeTrans]);

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
      sx={{
        display: 'flex',
        gap: 3,
        height: 'calc(100vh - 45px)',
        px: 3,
        py: 2,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'auto',
          pr: 1,
        }}
      >
        {/* Databases section */}
        <Box sx={{ mb: 3 }}>
          <SectionHeader
            title={databaseTrans('databases')}
            count={databases.length}
            action={
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={handleCreateDbClick}
                aria-label="新建数据库"
                sx={{
                  ml: 1,
                  minWidth: 28,
                  width: 28,
                  height: 28,
                  p: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PlusIcon sx={{ fontSize: 18 }} />
              </Button>
            }
          />
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            {loadingDatabases
              ? CARD_SKELETON_KEYS.map(k => (
                  <Skeleton
                    key={k}
                    variant="rectangular"
                    width={180}
                    height={128}
                    sx={{ borderRadius: 2 }}
                  />
                ))
              : databases.map(db => {
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
        </Box>

        {/* Index tree section */}
        {repos.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <SectionHeader title={homeTrans('indexTree')} count={repos.length} />
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              {repos.map(repo => (
                <RepoCard repo={repo} key={repo.repoUrl} />
              ))}
            </Box>
          </Box>
        )}

        {/* GitLab repos section */}
        <Box sx={{ mb: 3 }}>
          <SectionHeader
            title={homeTrans('gitlabRepos')}
            count={gitRepos.length}
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {!gitReposLoaded
              ? CARD_SKELETON_KEYS.map(k => (
                  <Skeleton
                    key={k}
                    variant="rectangular"
                    width={180}
                    height={128}
                    sx={{ borderRadius: 2 }}
                  />
                ))
              : gitRepos.map(repo => (
                  <GitRepoCard repo={repo} key={repo.name} />
                ))}
            {gitReposLoaded && (
              <Box
                component="section"
                onClick={() => navigate('/gitlab')}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  minWidth: 140,
                  minHeight: 128,
                  cursor: 'pointer',
                  borderRadius: 2,
                  border: theme => `1px dashed ${theme.palette.divider}`,
                  color: theme => theme.palette.text.secondary,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    borderColor: theme => theme.palette.primary.main,
                    color: theme => theme.palette.primary.main,
                    backgroundColor: theme =>
                      theme.palette.mode === 'light'
                        ? 'rgba(9, 181, 114, 0.04)'
                        : 'rgba(9, 181, 114, 0.08)',
                  },
                }}
              >
                <PlusIcon sx={{ fontSize: 28 }} />
                <Typography sx={{ fontSize: 13 }}>
                  {gitRepos.length > 0
                    ? homeTrans('manageRepos')
                    : homeTrans('addRepo')}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* System info section */}
        {data?.systemInfo && (
          <>
            <Box sx={{ mb: 3 }}>
              <SectionHeader title={homeTrans('sysInfo')} />
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
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
              <Box sx={{ mb: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
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
