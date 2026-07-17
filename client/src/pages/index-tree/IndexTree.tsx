import { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Typography, Button, Chip, CircularProgress } from '@mui/material';
import dayjs from 'dayjs';
import { useNavigationHook } from '@/hooks';
import { ROUTE_PATHS } from '@/config/routes';
import { CollectionService } from '@/http';
import icons from '@/components/icons/Icons';

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

const IndexTree = () => {
  useNavigationHook(ROUTE_PATHS.INDEX_TREE);
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
        output_fields: ['content', 'relativePath'],
        limit: 16384,
      });
      const rows: any[] = res?.data || res?.results || res || [];
      const parsed: BranchState[] = [];
      for (const row of rows) {
        try {
          const s = JSON.parse(row.content);
          if (s && s.identity && s.headCommit) parsed.push(s);
        } catch {
          /* skip */
        }
      }
      setStates(parsed);
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
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Index Tree
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={load}
          startIcon={<RefreshIcon />}
          disabled={loading}
        >
          Refresh
        </Button>
        {loading && <CircularProgress size={18} />}
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        每个仓库的 main（顶级）为根，特性分支按追踪关系缩进。分支只存相对 main 的 delta。
      </Typography>

      {error && (
        <Typography sx={{ color: 'error.main', mb: 2 }}>
          读取 {STATE_COLLECTION} 失败：{error}
        </Typography>
      )}

      {!loading && !error && groups.length === 0 && (
        <Typography sx={{ color: 'text.secondary' }}>暂无索引记录。</Typography>
      )}

      {groups.map(group => (
        <Box
          key={group.repoUrl}
          sx={{
            mb: 3,
            border: theme => `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
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
              gap: 1,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {repoLabel(group.repoUrl)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {group.repoUrl}
            </Typography>
          </Box>

          {/* header row */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 0.8fr 1fr 1.2fr',
              px: 2,
              py: 1,
              borderTop: theme => `1px solid ${theme.palette.divider}`,
              fontWeight: 600,
              fontSize: 13,
              color: 'text.secondary',
            }}
          >
            <span>分支</span>
            <span>追踪</span>
            <span>Entities</span>
            <span>HEAD</span>
            <span>更新时间</span>
          </Box>

          {group.nodes.map(node => {
            const branch = branchOf(node.state.identity, node.state.repoUrl);
            const isRoot = node.depth === 0;
            const tracked = node.tracked || '';
            return (
              <Box
                key={node.state.identity}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.2fr 0.8fr 1fr 1.2fr',
                  px: 2,
                  py: 1,
                  alignItems: 'center',
                  borderTop: theme => `1px solid ${theme.palette.divider}`,
                  fontSize: 13,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', pl: `${node.depth * 24}px`, gap: 1 }}>
                  {!isRoot && <span style={{ color: '#9aa0a6' }}>└─</span>}
                  <Typography
                    sx={{ fontWeight: isRoot ? 600 : 400, fontSize: isRoot ? 15 : 13 }}
                  >
                    {branch}
                  </Typography>
                  {isRoot && <Chip label="main" size="small" color="primary" variant="outlined" />}
                </Box>
                <span style={{ color: tracked ? 'inherit' : '#9aa0a6' }}>{tracked || '—'}</span>
                <span>{node.rowCount != null ? node.rowCount.toLocaleString() : '—'}</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {node.state.headCommit ? node.state.headCommit.slice(0, 8) : '—'}
                </span>
                <span style={{ color: '#9aa0a6' }}>
                  {node.state.updatedAt ? dayjs(node.state.updatedAt).format('MM-DD HH:mm') : '—'}
                </span>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
};

export default IndexTree;
