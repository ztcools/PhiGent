import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useNavigationHook } from '@/hooks';
import { ROUTE_PATHS } from '@/config/routes';
import { CollectionService, DataService } from '@/http';
import icons from '@/components/icons/Icons';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';

const STATE_COLLECTION = 'code_index_state';

interface BranchState {
  identity: string;
  headCommit: string;
  updatedAt?: number;
  repoUrl?: string;
  baseIdentity?: string | null;
  parentIdentity?: string | null;
  overridePaths?: string[];
  collectionName?: string;
}

interface TreeNode {
  state: BranchState;
  depth: number;
  rowCount?: number;
  tracked?: string;
}

const ROOT_BRANCHES = ['main', 'master'];

const repoLabel = (repoUrl?: string): string => {
  if (!repoUrl) return '(local)';
  const seg = repoUrl.replace(/\.git$/i, '').split(/[/:]/).filter(Boolean).pop();
  return seg || repoUrl;
};

const branchOf = (identity: string, repoUrl?: string): string => {
  if (repoUrl && identity.startsWith(repoUrl + ':')) return identity.slice(repoUrl.length + 1);
  const i = identity.lastIndexOf(':');
  return i >= 0 ? identity.slice(i + 1) : identity;
};

const RefreshIcon = icons.refresh;

const SKELETON_ROWS = 4;

const IndexTree = () => {
  useNavigationHook(ROUTE_PATHS.INDEX_TREE);
  const { t: navTrans } = useTranslation('nav');
  const [states, setStates] = useState<BranchState[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Row counts + existence check in one call (avoids querying a non-existent
      // code_index_state on a fresh Milvus, which would pop a global error toast).
      // Existence check via names (getAllCollections only returns lazy objects
      // without rowCount/description), then fetch full details for code collections
      // to map row counts by branch identity (from `codebasePath:<identity>` desc)
      // and by collection name.
      const names: string[] = await CollectionService.getCollectionsNames({
        db_name: 'default',
      }).catch(() => [] as string[]);
      const hasStateCollection = names.includes(STATE_COLLECTION);

      const map: Record<string, number> = {};
      const codeNames = names.filter(
        n => n !== STATE_COLLECTION && !n.startsWith('embedding_cache_')
      );
      if (codeNames.length > 0) {
        try {
          const full: any[] = await CollectionService.getCollections({
            db_name: 'default',
            collections: codeNames,
          });
          for (const c of full) {
            if (c.collection_name != null && c.rowCount != null) map[c.collection_name] = c.rowCount;
            const desc: string = c.description || '';
            if (desc.startsWith('codebasePath:') && c.rowCount != null) {
              map[desc.slice('codebasePath:'.length).split('|')[0]] = c.rowCount;
            }
          }
        } catch {
          /* best-effort */
        }
      }
      setCounts(map);

      if (!hasStateCollection) {
        setStates([]);
        return;
      }

      const res: any = await CollectionService.queryData(STATE_COLLECTION, {
        expr: 'id != ""',
        output_fields: ['id', 'content', 'relativePath'],
        limit: 16384,
      });
      const rows: any[] = res?.data || res?.results || res || [];

      // A branch is "live" only if its Milvus collection still exists. When a user
      // drops a collection in attu, its code_index_state row is left behind — filter
      // those out so the tree stays in sync with the database, and prune the orphan
      // rows so the shared state table doesn't accumulate stale entries.
      const codeNameSet = new Set(codeNames);
      const isLive = (s: BranchState): boolean =>
        (!!s.collectionName && codeNameSet.has(s.collectionName)) ||
        map[s.identity] != null ||
        (!!s.collectionName && map[s.collectionName] != null);

      const parsed: BranchState[] = [];
      const orphanIds: string[] = [];
      for (const row of rows) {
        try {
          const s = JSON.parse(row.content);
          if (!s || !s.identity || !s.headCommit) continue;
          if (isLive(s)) parsed.push(s);
          else if (row.id != null) orphanIds.push(String(row.id));
        } catch {
          /* skip */
        }
      }
      setStates(parsed);

      if (orphanIds.length > 0) {
        const quoted = orphanIds
          .map(id => `"${id.replace(/"/g, '\\"')}"`)
          .join(',');
        DataService.deleteEntities(STATE_COLLECTION, {
          expr: `id in [${quoted}]`,
        }).catch(() => {
          /* best-effort cleanup */
        });
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Group by repo, build parent→children tree, flatten to depth-tagged rows.
  const groups = useMemo(() => {
    const byRepo = new Map<string, BranchState[]>();
    for (const s of states) {
      const key = s.repoUrl || '(local)';
      if (!byRepo.has(key)) byRepo.set(key, []);
      byRepo.get(key)!.push(s);
    }

    const result: { repoUrl: string; nodes: TreeNode[] }[] = [];
    for (const [repoUrl, list] of byRepo) {
      const byIdentity = new Map(list.map(s => [s.identity, s]));
      const nameOf = (s: BranchState) => branchOf(s.identity, s.repoUrl).toLowerCase();

      // The repo root is ALWAYS the main/master branch when present, so a feature
      // branch indexed before main (a temporary root) never displaces main. Fall
      // back to a base=null branch, then the first.
      const root =
        ROOT_BRANCHES.map(rb => list.find(s => nameOf(s) === rb)).find(Boolean) ||
        list.find(s => !s.baseIdentity) ||
        list[0];

      // A "secondary root" is a base=null (or parent-less) branch that ISN'T the
      // chosen root — e.g. `b` indexed before main. Its descendants re-attach to
      // the real root so the tree shows main on top with everything under it.
      const resolvedParent = (s: BranchState): string | null =>
        s.parentIdentity && byIdentity.has(s.parentIdentity) && s.parentIdentity !== s.identity
          ? s.parentIdentity
          : null;
      const isSecondaryRoot = (s: BranchState) =>
        s.identity !== root.identity && !resolvedParent(s);

      const childrenOf = new Map<string, BranchState[]>();
      for (const s of list) {
        if (s.identity === root.identity) continue;
        let parentId = resolvedParent(s);
        if (!parentId || isSecondaryRoot(byIdentity.get(parentId)!)) parentId = root.identity;
        if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
        childrenOf.get(parentId)!.push(s);
      }

      const nodes: TreeNode[] = [];
      const walk = (s: BranchState, depth: number, parentBranch: string) => {
        nodes.push({
          state: s,
          depth,
          rowCount: counts[s.identity] ?? (s.collectionName ? counts[s.collectionName] : undefined),
          tracked: parentBranch,
        });
        const kids = (childrenOf.get(s.identity) || []).sort((a, b) =>
          branchOf(a.identity, a.repoUrl).localeCompare(branchOf(b.identity, b.repoUrl))
        );
        for (const k of kids) walk(k, depth + 1, branchOf(s.identity, s.repoUrl));
      };
      walk(root, 0, '');
      result.push({ repoUrl, nodes });
    }
    result.sort((a, b) => repoLabel(a.repoUrl).localeCompare(repoLabel(b.repoUrl)));
    return result;
  }, [states, counts]);

  return (
    <PageContainer>
      <PageHeader
        title={navTrans('indexTree')}
        subtitle="每个仓库的 main（顶级）为根，特性分支按追踪关系缩进。分支只存相对 main 的 delta。"
        actions={
          <Button
            size="small"
            variant="outlined"
            onClick={load}
            startIcon={<RefreshIcon />}
            disabled={loading}
          >
            刷新
          </Button>
        }
      />

      {error && (
        <Typography sx={{ color: 'error.main', mb: 2 }}>
          读取 {STATE_COLLECTION} 失败：{error}
        </Typography>
      )}

      {loading && groups.length === 0 && (
        <Paper
          variant="outlined"
          sx={{ borderRadius: 2, overflow: 'hidden', p: 2 }}
        >
          <Skeleton variant="text" width={180} height={28} sx={{ mb: 1 }} />
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={36}
              sx={{ mb: 1, borderRadius: 1 }}
            />
          ))}
        </Paper>
      )}

      {!loading && !error && groups.length === 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 6,
            textAlign: 'center',
            color: 'text.secondary',
            borderStyle: 'dashed',
          }}
        >
          <Typography>暂无索引记录</Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
            到 GitLab 仓库页 添加仓库并触发一次索引后，这里会显示仓库 / 分支层次。
          </Typography>
        </Paper>
      )}

      {groups.map(group => (
        <Paper
          key={group.repoUrl}
          variant="outlined"
          sx={{
            mb: 3,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              borderBottom: theme => `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, flexShrink: 0 }}>
              {repoLabel(group.repoUrl)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontFamily: 'monospace',
                fontSize: 11,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {group.repoUrl}
            </Typography>
            <Chip
              label={`${group.nodes.length} 分支`}
              size="small"
              variant="outlined"
              sx={{ ml: 'auto', flexShrink: 0 }}
            />
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>分支</TableCell>
                  <TableCell>追踪</TableCell>
                  <TableCell align="right">Entities</TableCell>
                  <TableCell>HEAD</TableCell>
                  <TableCell>更新时间</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.nodes.map((node, idx) => {
                  const branch = branchOf(node.state.identity, node.state.repoUrl);
                  const isRoot = node.depth === 0;
                  const tracked = node.tracked || '';
                  return (
                    <TableRow
                      key={node.state.identity}
                      hover
                      sx={{
                        bgcolor: idx % 2 === 1 ? 'action.hover' : 'background.paper',
                        '&:last-child td': { borderBottom: 0 },
                      }}
                    >
                      <TableCell>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            pl: `${node.depth * 20}px`,
                            gap: 1,
                            minWidth: 0,
                          }}
                        >
                          {!isRoot && (
                            <Box
                              component="span"
                              sx={{ color: 'text.disabled', flexShrink: 0 }}
                            >
                              └─
                            </Box>
                          )}
                          <Typography
                            noWrap
                            sx={{
                              fontWeight: isRoot ? 600 : 400,
                              fontSize: isRoot ? 14 : 13,
                            }}
                          >
                            {branch}
                          </Typography>
                          {isRoot && (
                            <Chip
                              label="main"
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ flexShrink: 0 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{
                          color: tracked ? 'text.primary' : 'text.disabled',
                          fontFamily: 'monospace',
                          fontSize: 12,
                        }}
                      >
                        {tracked || '—'}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {node.rowCount != null
                          ? node.rowCount.toLocaleString()
                          : '—'}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: 'text.secondary',
                        }}
                      >
                        {node.state.headCommit
                          ? node.state.headCommit.slice(0, 8)
                          : '—'}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {node.state.updatedAt
                          ? dayjs(node.state.updatedAt).format('MM-DD HH:mm')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ))}
    </PageContainer>
  );
};

export default IndexTree;
