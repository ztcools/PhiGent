import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Chip,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Skeleton,
} from '@mui/material';
import type { GitRepo, RepoRunStatus } from './service';
import dayjs from 'dayjs';
import { useNavigationHook } from '@/hooks';
import { ROUTE_PATHS } from '@/config/routes';
import icons from '@/components/icons/Icons';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { GitIndexService, GitIndexStatus, CurrentProgress } from './service';
import { detectGitHost, tokenHint, GitHostInfo } from './gitHost';

const RefreshIcon = icons.refresh;
const DeleteIcon = icons.delete;
const AddIcon = icons.add;
const ExpandIcon = icons.expand;
const CollapseIcon = icons.dropdown;

const emptyForm = { name: '', url: '', branch: 'main', token: '', protectedBranches: '' };

const parseBranchList = (text: string): string[] =>
  text
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(Boolean);

/**
 * Platform detection for the URL currently in a form field. Answers locally on
 * every keystroke (gitHost.ts mirrors the service's table) and then confirms
 * against `GET /detect` once typing settles, so a service whose table is newer
 * than this bundle still wins.
 */
const useGitHost = (url: string): GitHostInfo => {
  const trimmed = url.trim();
  const [remote, setRemote] = useState<GitHostInfo | null>(null);

  useEffect(() => {
    setRemote(null);
    if (!trimmed) return;
    const t = setTimeout(() => {
      GitIndexService.detect(trimmed)
        .then(info => setRemote(info as GitHostInfo))
        // Offline / older service without /detect — the local guess stands.
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [trimmed]);

  const local = detectGitHost(trimmed);
  return remote && remote.host === local.host ? remote : local;
};

const PLATFORM_COLOR: Record<string, 'primary' | 'secondary' | 'info' | 'default'> = {
  'huawei-codehub': 'primary',
  gitlab: 'secondary',
  github: 'info',
  gitee: 'secondary',
  bitbucket: 'info',
  generic: 'default',
};

/**
 * The detected platform and what it implies for authentication. Shown while the
 * URL is being typed so a paste from the wrong platform — or an SSH URL with a
 * token pasted alongside it — is visible before the repo is saved.
 */
const HostHint = ({ url, hasToken }: { url: string; hasToken: boolean }) => {
  const info = useGitHost(url);
  if (!url.trim()) return null;
  if (!info.host) {
    return (
      <Typography variant="caption" sx={{ color: 'warning.main' }}>
        无法解析仓库 URL。支持 https://host/group/repo.git 或 git@host:group/repo.git。
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Chip
        size="small"
        label={info.label}
        color={PLATFORM_COLOR[info.platform] || 'default'}
        variant="outlined"
      />
      <Chip
        size="small"
        variant="outlined"
        label={hasToken ? 'HTTPS + Token' : 'SSH + 部署公钥'}
      />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {hasToken
          ? tokenHint(info.platform)
          : info.scheme === 'https'
            ? '未填 Token：将把该 https 地址转成 SSH 形式，用服务器部署公钥拉取。'
            : '未填 Token：用服务器部署公钥通过 SSH 拉取，需先在平台添加该公钥。'}
      </Typography>
    </Box>
  );
};

interface BranchRowProps {
  repoName: string;
  branch: string;
  isMain: boolean;
  lastRun: RepoRunStatus | null | undefined;
  current: CurrentProgress | null | undefined;
  busy: string;
  running: boolean;
  onIndex: (name: string, branch: string) => void;
}

const BranchRow = ({
  repoName,
  branch,
  isMain,
  lastRun,
  current,
  busy,
  running,
  onIndex,
}: BranchRowProps) => {
  const inProgress = current?.repo === repoName && current?.branch === branch;
  const key = `${repoName}:${branch}`;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr',
        px: 2,
        py: 1,
        borderTop: theme => `1px solid ${theme.palette.divider}`,
        fontSize: 13,
        transition: 'background-color 0.15s ease-in-out',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          pl: isMain ? 0 : '24px',
          gap: 1,
          minWidth: 0,
        }}
      >
        {!isMain && (
          <Box component="span" sx={{ color: 'text.disabled', flexShrink: 0 }}>
            └─
          </Box>
        )}
        <Typography
          noWrap
          sx={{ fontWeight: isMain ? 600 : 400, fontSize: isMain ? 14 : 13 }}
        >
          {branch}
        </Typography>
        {isMain && (
          <Chip label="main" size="small" color="primary" variant="outlined" sx={{ flexShrink: 0 }} />
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
        {inProgress ? (
          <Box
            component="span"
            sx={{
              color: 'info.main',
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
            }}
          >
            <CircularProgress size={12} />
            {current?.phase} {current?.percentage}%
          </Box>
        ) : lastRun ? (
          <Tooltip title={lastRun.error || ''}>
            <Box
              component="span"
              sx={{ color: lastRun.ok ? 'text.primary' : 'error.main' }}
            >
              {lastRun.ok
                ? `${lastRun.mode || ''} (+${lastRun.added ?? 0}/~${lastRun.modified ?? 0}/-${lastRun.removed ?? 0})`
                : '失败'}
              {'  '}
              <Box component="span" sx={{ color: 'text.secondary' }}>
                {dayjs(lastRun.at).format('MM-DD HH:mm')}
              </Box>
            </Box>
          </Tooltip>
        ) : (
          <Box component="span" sx={{ color: 'text.disabled' }}>未索引</Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
        {lastRun?.durationMs != null ? `${(lastRun.durationMs / 1000).toFixed(1)}s` : '—'}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
        {lastRun?.at ? dayjs(lastRun.at).format('MM-DD HH:mm') : '—'}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onIndex(repoName, branch)}
          disabled={!!busy || running}
        >
          {busy === key ? '...' : '索引此分支'}
        </Button>
      </Box>
    </Box>
  );
};

const GitLabRepos = () => {
  useNavigationHook(ROUTE_PATHS.GITLAB);
  const [status, setStatus] = useState<GitIndexStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [hour, setHour] = useState<string>('3');
  const [busy, setBusy] = useState('');
  const [sshKey, setSshKey] = useState<string | null>(null);
  const [sshOpen, setSshOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const keyRef = useRef<HTMLPreElement>(null);
  const [editing, setEditing] = useState<GitRepo | null>(null);
  const [editForm, setEditForm] = useState({
    url: '',
    branch: 'main',
    token: '',
    useSsh: false,
    protectedBranches: '',
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const s = await GitIndexService.status();
      setStatus(s);
      if (s.schedule.dailyHour !== null) setHour(String(s.schedule.dailyHour));
      setError('');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setInitialLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load]);

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const addRepo = async () => {
    if (!form.name || !form.url) return;
    setLoading(true);
    try {
      await GitIndexService.addRepo({
        name: form.name.trim(),
        url: form.url.trim(),
        branch: (form.branch || 'main').trim(),
        protectedBranches: parseBranchList(form.protectedBranches),
        token: form.token.trim() || undefined,
      });
      setForm({ ...emptyForm });
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const removeRepo = async (name: string) => {
    setBusy(name);
    try {
      await GitIndexService.deleteRepo(name);
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy('');
    }
  };

  const indexOne = async (name: string) => {
    setBusy(name);
    try {
      await GitIndexService.indexOne(name);
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy('');
    }
  };

  const indexOneBranch = async (name: string, branch: string) => {
    setBusy(`${name}:${branch}`);
    try {
      await GitIndexService.indexOneBranch(name, branch);
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy('');
    }
  };

  const indexAll = async () => {
    setLoading(true);
    try {
      await GitIndexService.indexAll();
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (r: GitRepo) => {
    setEditing(r);
    setEditForm({
      url: r.url,
      branch: r.branch,
      token: '',
      useSsh: (r.auth || (r.hasToken ? 'https' : 'ssh')) === 'ssh',
      protectedBranches: (r.protectedBranches || []).join(', '),
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const payload: {
      url?: string;
      branch?: string;
      protectedBranches?: string[];
      token?: string;
    } = {
      url: editForm.url.trim(),
      branch: (editForm.branch || 'main').trim(),
      protectedBranches: parseBranchList(editForm.protectedBranches),
    };
    if (editForm.useSsh) payload.token = '';
    else if (editForm.token.trim()) payload.token = editForm.token.trim();
    setLoading(true);
    try {
      await GitIndexService.updateRepo(editing.name, payload);
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const showSshKey = async () => {
    setSshOpen(true);
    setCopied(false);
    try {
      const r = await GitIndexService.sshKey();
      setSshKey(r.publicKey);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const copySshKey = async () => {
    if (!sshKey) return;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(sshKey);
        ok = true;
      } else if (keyRef.current) {
        const range = document.createRange();
        range.selectNodeContents(keyRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        ok = document.execCommand('copy');
        sel?.removeAllRanges();
      }
    } catch {
      ok = false;
    }
    setCopied(ok);
  };

  const saveSchedule = async () => {
    const h = Math.max(0, Math.min(23, Number(hour) || 0));
    setLoading(true);
    try {
      await GitIndexService.setSchedule({ dailyHour: h });
      await load();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const cell = { px: 2, py: 1, fontSize: 13, display: 'flex', alignItems: 'center' };

  return (
    <PageContainer>
      <PageHeader
        title="代码仓库"
        subtitle="服务器定时拉取这些仓库并更新各保护分支的索引；修改即时生效，无需重启。支持华为云 CodeHub / GitLab / GitHub / Gitee / Bitbucket 与自建 Git——平台由 URL 自动识别。认证方式：填 Token → HTTPS（用户名按平台自动选择）；留空 → SSH（需先在平台添加下方部署公钥）。"
        actions={
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={load}
            >
              刷新
            </Button>
            <Button size="small" variant="outlined" onClick={showSshKey}>
              部署公钥 (SSH)
            </Button>
            {status?.running && (
              <Chip
                size="small"
                color="primary"
                icon={<CircularProgress size={12} color="inherit" />}
                label={
                  status.current
                    ? `索引中：${status.current.repo}${status.current.branch ? ` · ${status.current.branch}` : ''} · ${status.current.phase} ${status.current.percentage}%`
                    : '索引进行中'
                }
              />
            )}
          </>
        }
      />

      {error && (
        <Typography sx={{ color: 'error.main', mb: 2 }}>连接索引服务失败：{error}</Typography>
      )}

      {/* schedule + index all */}
      <Paper
        variant="outlined"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 3,
          p: 2,
          borderRadius: 2,
          flexWrap: 'wrap',
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
          每日定时拉取（小时 0-23）
        </Typography>
        <TextField
          size="small"
          type="number"
          value={hour}
          onChange={e => setHour(e.target.value)}
          sx={{ width: 90 }}
          inputProps={{ min: 0, max: 23 }}
        />
        <Button size="small" variant="contained" onClick={saveSchedule} disabled={loading}>
          保存定时
        </Button>
        {status?.schedule.nextRunAt && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            下次运行：{dayjs(status.schedule.nextRunAt).format('MM-DD HH:mm')}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          color="primary"
          onClick={indexAll}
          disabled={loading || status?.running}
        >
          立即全部索引
        </Button>
      </Paper>

      {/* add repo */}
      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <TextField size="small" label="名称" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} sx={{ width: 140 }} />
          <TextField size="small" label="仓库 URL（https 或 git@…）" value={form.url}
            onChange={e => setForm({ ...form, url: e.target.value })} sx={{ flex: 1, minWidth: 240 }} />
          <TextField size="small" label="主分支" value={form.branch}
            onChange={e => setForm({ ...form, branch: e.target.value })} sx={{ width: 100 }} />
          <TextField size="small" label="保护分支(逗号分隔)" value={form.protectedBranches}
            onChange={e => setForm({ ...form, protectedBranches: e.target.value })} sx={{ width: 180 }} />
          <TextField size="small" label="Token（留空走 SSH）" value={form.token} type="password"
            onChange={e => setForm({ ...form, token: e.target.value })} sx={{ width: 170 }} />
          <Button variant="contained" startIcon={<AddIcon />} onClick={addRepo} disabled={loading}>
            添加
          </Button>
        </Box>
        <Box sx={{ mt: 1, minHeight: 24 }}>
          <HostHint url={form.url} hasToken={!!form.token.trim()} />
        </Box>
      </Box>

      {/* repo table */}
      <Paper
        variant="outlined"
        sx={{ borderRadius: 2, overflow: 'hidden' }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr',
            bgcolor: 'action.hover',
            fontWeight: 600,
            fontSize: 13,
            color: 'text.secondary',
          }}
        >
          <Box sx={cell}>名称 / URL / 分支</Box>
          <Box sx={cell}>索引状态</Box>
          <Box sx={cell}>耗时</Box>
          <Box sx={cell}>上次时间</Box>
          <Box sx={cell}>操作</Box>
        </Box>

        {!initialLoaded ? (
          <Box sx={{ p: 2 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={44} sx={{ mb: 1, borderRadius: 1 }} />
            ))}
          </Box>
        ) : (
          <>
            {(status?.repos || []).map(r => {
              const isExpanded = expanded.has(r.name);
              const mainBranch = r.branch || 'main';
              const protectedBranches = r.protectedBranches || [];
              const allBranches = [mainBranch, ...protectedBranches];
              const current = status?.current;
              const repoBusy = busy === r.name;

              return (
                <Box key={r.name}>
                  {/* repo main row */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr',
                      borderTop: theme => `1px solid ${theme.palette.divider}`,
                      transition: 'background-color 0.15s ease-in-out',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box sx={{ ...cell, gap: 1, minWidth: 0 }}>
                      <IconButton
                        size="small"
                        onClick={() => toggleExpand(r.name)}
                        aria-label={isExpanded ? '收起' : '展开'}
                        sx={{ flexShrink: 0 }}
                      >
                        {isExpanded ? (
                          <CollapseIcon sx={{ fontSize: 18 }} />
                        ) : (
                          <ExpandIcon sx={{ fontSize: 18 }} />
                        )}
                      </IconButton>
                      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }} noWrap>
                            {r.name}
                          </Typography>
                          {/* Platform + auth flavor: which token username the fetch path
                              will use, or that it goes over SSH with the deploy key. */}
                          <Tooltip
                            title={
                              r.hasToken
                                ? `HTTPS basic auth，用户名 ${r.tokenUser || detectGitHost(r.url).tokenUser}`
                                : 'SSH，使用服务器部署公钥'
                            }
                          >
                            <Chip
                              size="small"
                              variant="outlined"
                              color={PLATFORM_COLOR[r.platform || detectGitHost(r.url).platform] || 'default'}
                              label={`${r.platformLabel || detectGitHost(r.url).label} · ${r.hasToken ? 'Token' : 'SSH'}`}
                              sx={{ flexShrink: 0, height: 18, fontSize: 10 }}
                            />
                          </Tooltip>
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontFamily: 'monospace',
                            fontSize: 11,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.url}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={cell}>
                      {current?.repo === r.name ? (
                        <Box
                          component="span"
                          sx={{
                            color: 'info.main',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                          }}
                        >
                          <CircularProgress size={12} />
                          {current.phase} {current.percentage}%
                        </Box>
                      ) : (
                        <Box component="span" sx={{ color: 'text.secondary' }}>
                          {allBranches.length} 个分支
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ ...cell, color: 'text.secondary' }}>—</Box>
                    <Box sx={{ ...cell, color: 'text.secondary' }}>—</Box>
                    <Box sx={{ ...cell, gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => indexOne(r.name)}
                        disabled={!!busy || status?.running}
                      >
                        {repoBusy ? '...' : '索引全部'}
                      </Button>
                      <Button size="small" variant="text" onClick={() => openEdit(r)}>
                        编辑
                      </Button>
                      <Tooltip title="删除">
                        <IconButton
                          size="small"
                          onClick={() => removeRepo(r.name)}
                          disabled={!!busy}
                          aria-label="删除仓库"
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* expanded branch rows */}
                  {isExpanded && (
                    <Box sx={{ bgcolor: 'action.hover' }}>
                      {allBranches.map((b, idx) => (
                        <BranchRow
                          key={`${r.name}:${b}`}
                          repoName={r.name}
                          branch={b}
                          isMain={idx === 0}
                          lastRun={r.lastRuns?.[b]}
                          current={current}
                          busy={busy}
                          running={!!status?.running}
                          onIndex={indexOneBranch}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
            {status && status.repos.length === 0 && (
              <Box
                sx={{
                  px: 2,
                  py: 6,
                  textAlign: 'center',
                  color: 'text.secondary',
                  borderTop: theme => `1px solid ${theme.palette.divider}`,
                }}
              >
                <Typography>暂无仓库</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: 'text.disabled' }}>
                  使用上方表单添加一个仓库即可开始索引（华为云 CodeHub / GitLab / GitHub / Gitee / 自建 Git 均可）。
                </Typography>
              </Box>
            )}
          </>
        )}
      </Paper>

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>编辑仓库：{editing?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box>
              <TextField
                size="small"
                label="仓库 URL（https 或 git@…）"
                value={editForm.url}
                onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                fullWidth
              />
              <Box sx={{ mt: 1, minHeight: 24 }}>
                <HostHint url={editForm.url} hasToken={!editForm.useSsh} />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                label="主分支"
                value={editForm.branch}
                onChange={e => setEditForm({ ...editForm, branch: e.target.value })}
                sx={{ width: 140 }}
              />
              <TextField
                size="small"
                label="保护分支（逗号分隔）"
                value={editForm.protectedBranches}
                onChange={e =>
                  setEditForm({ ...editForm, protectedBranches: e.target.value })
                }
                sx={{ flex: 1, minWidth: 200 }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography sx={{ fontSize: 14 }}>认证方式</Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={editForm.useSsh ? 'ssh' : 'https'}
                onChange={(_, v) => {
                  if (v) setEditForm({ ...editForm, useSsh: v === 'ssh' });
                }}
              >
                <ToggleButton value="https">HTTPS (Token)</ToggleButton>
                <ToggleButton value="ssh">SSH</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            {!editForm.useSsh && (
              <TextField
                size="small"
                label="Token"
                type="password"
                placeholder="留空 = 保持原 Token 不变"
                helperText={`可写成 <用户名>:<令牌> 显式指定 basic-auth 用户名；只填令牌则按平台自动选择（当前：${
                  detectGitHost(editForm.url).tokenUser
                }）。`}
                value={editForm.token}
                onChange={e => setEditForm({ ...editForm, token: e.target.value })}
                fullWidth
              />
            )}
            {editForm.useSsh && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                将清除该仓库的 Token，改用服务器部署公钥通过 SSH 拉取。
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>取消</Button>
          <Button variant="contained" onClick={saveEdit} disabled={loading}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={sshOpen} onClose={() => setSshOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>服务器部署公钥 (SSH)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            将下面的公钥添加到代码平台（GitLab: Settings → SSH Keys 或仓库 Deploy Keys；
            GitHub: Settings → SSH and GPG keys 或仓库 Deploy keys；华为云 CodeArts:
            个人设置 → SSH 密钥），之后不填 Token 的仓库即可通过 SSH 克隆/拉取更新索引。
            私钥仅保存在服务器内网，只需授予只读权限。
          </Typography>
          <Box
            component="pre"
            ref={keyRef}
            sx={{
              p: 2,
              m: 0,
              bgcolor: 'action.hover',
              borderRadius: 1,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: 'monospace',
            }}
          >
            {sshKey || '（尚未生成公钥，或读取失败）'}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={copySshKey} disabled={!sshKey}>
            {copied ? '已复制' : '复制'}
          </Button>
          <Button onClick={() => setSshOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default GitLabRepos;
