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
import { repoLabel, branchOfIdentity } from '@/utils/codeCollection';
import { useCodeRepoMap } from '@/utils/codeRepoMap';

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
  /** 分支名（权威源：「仓库管理」；兜底：identity 解析） */
  branch: string;
  /** 是否该仓库配置的主分支 —— 不是"名字叫 main/master"猜的 */
  isMain: boolean;
}

const ROOT_BRANCHES = ['main', 'master'];

/** 本页的仓库标题：没有 repoUrl（本地路径索引）时标一下 (local) */
const repoTitle = (repoUrl?: string): string => repoLabel(repoUrl) || '(local)';

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
      // 行数统计与存在性校验合并为一次调用（避免在全新的 Milvus 上查询并不存在的
      // code_index_state，否则会弹出全局错误提示）。
      // 先用名字做存在性校验（getAllCollections 只返回惰性对象，
      // 不含 rowCount/description），再拉取 code collection 的完整信息，
      // 以便按分支 identity（取自 `codebasePath:<identity>` 描述）
      // 和 collection 名映射行数。
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
          /* 尽力而为，失败可忽略 */
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

      // 分支只有在对应 Milvus collection 仍存在时才算“存活”。用户在 Attu 里
      // 删掉 collection 后，code_index_state 中的行会残留 —— 过滤掉这些行，
      // 让索引树与数据库保持同步，并清理孤儿行，避免共享状态表不断累积过期数据。
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
          /* 跳过 */
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
          /* 尽力清理，失败可忽略 */
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

  // 分支名与"谁是主分支"的权威来源：「仓库管理」的 collection → 分支映射。
  // 从 identity 反推分支在三种情况下会给错值（description 缺失、旧架构的三段
  // identity、自建 GitLab 非标准端口），而这些分支本来是在仓库管理里配好的。
  const repoMap = useCodeRepoMap();

  // 按仓库分组，构建父→子索引树，再摊平成带深度标记的行。
  const groups = useMemo(() => {
    const refOf = (s: BranchState) =>
      s.collectionName ? repoMap.get(s.collectionName) : undefined;
    // 兜底链：registry → identity 解析 → identity 原文（至少不是空白单元格）
    const branchName = (s: BranchState) =>
      refOf(s)?.branch || branchOfIdentity(s.identity) || s.identity;
    // 主分支同样先问 registry。同一仓库 main 与 master 都被索引时，靠名字判断会
    // 两个都算主行、先到者占位；registry 里只有一个 isMain=true。
    const isMainBranch = (s: BranchState) => {
      const ref = refOf(s);
      if (ref) return ref.isMain;
      return ROOT_BRANCHES.includes(branchName(s).toLowerCase());
    };

    const byRepo = new Map<string, BranchState[]>();
    for (const s of states) {
      const key = s.repoUrl || '(local)';
      if (!byRepo.has(key)) byRepo.set(key, []);
      byRepo.get(key)!.push(s);
    }

    const result: { repoUrl: string; title: string; nodes: TreeNode[] }[] = [];
    for (const [repoUrl, list] of byRepo) {
      const byIdentity = new Map(list.map(s => [s.identity, s]));

      // 仓库根节点始终选配置里的主分支（若存在），这样早于 main 索引的特性分支
      // （临时根）就不会顶替 main。兜底依次为 base=null 的分支、第一个分支。
      const root =
        list.find(isMainBranch) || list.find(s => !s.baseIdentity) || list[0];

      // 「次级根」是指非所选根的 base=null（或无父）分支 —— 例如早于 main 索引的
      // `b`。它的后代重新挂到真正的根上，让索引树以 main 为顶部、其余都在其下。
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
          branch: branchName(s),
          isMain: isMainBranch(s),
        });
        const kids = (childrenOf.get(s.identity) || []).sort((a, b) =>
          branchName(a).localeCompare(branchName(b))
        );
        for (const k of kids) walk(k, depth + 1, branchName(s));
      };
      walk(root, 0, '');
      // 组标题优先用「仓库管理」里填的仓库名（比 URL 末段更贴近用户的叫法）。
      const title = refOf(root)?.repo || repoTitle(repoUrl);
      result.push({ repoUrl, title, nodes });
    }
    result.sort((a, b) => a.title.localeCompare(b.title));
    return result;
  }, [states, counts, repoMap]);

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
            到「代码仓库」页添加仓库并触发一次索引后，这里会显示仓库 / 分支层次。
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
              {group.title}
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
                  const branch = node.branch;
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
                          {/* 顶级行不等于主分支：main 尚未索引时会由别的分支临时占位，
                              那种情况标"顶级"而不是谎报 main。 */}
                          {isRoot && (
                            <Chip
                              label={node.isMain ? 'main' : '顶级'}
                              size="small"
                              color={node.isMain ? 'primary' : 'default'}
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
