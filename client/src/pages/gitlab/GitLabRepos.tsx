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
} from '@mui/material';
import type { GitRepo } from './service';
import dayjs from 'dayjs';
import { useNavigationHook } from '@/hooks';
import { ROUTE_PATHS } from '@/config/routes';
import icons from '@/components/icons/Icons';
import { GitIndexService, GitIndexStatus } from './service';

const RefreshIcon = icons.refresh;
const DeleteIcon = icons.delete;
const AddIcon = icons.add;

const emptyForm = { name: '', url: '', branch: 'main', token: '' };

const GitLabRepos = () => {
  useNavigationHook(ROUTE_PATHS.GITLAB);
  const [status, setStatus] = useState<GitIndexStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
  });

  const load = useCallback(async () => {
    try {
      const s = await GitIndexService.status();
      setStatus(s);
      if (s.schedule.dailyHour !== null) setHour(String(s.schedule.dailyHour));
      setError('');
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load]);

  const addRepo = async () => {
    if (!form.name || !form.url) return;
    setLoading(true);
    try {
      await GitIndexService.addRepo({
        name: form.name.trim(),
        url: form.url.trim(),
        branch: (form.branch || 'main').trim(),
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
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    // useSsh → clear token (''); https with a typed token → set it;
    // https with blank token → omit (keep the existing token).
    const payload: { url?: string; branch?: string; token?: string } = {
      url: editForm.url.trim(),
      branch: (editForm.branch || 'main').trim(),
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
      // navigator.clipboard only exists in secure contexts (https / localhost).
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(sshKey);
        ok = true;
      } else if (keyRef.current) {
        // Plain-http fallback: select the visible <pre> inside the dialog and copy.
        // A Range selection on the on-screen node isn't cleared by the dialog's
        // focus trap (unlike a body-appended textarea), so the copy actually lands.
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
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          GitLab 仓库管理
        </Typography>
        <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load}>
          刷新
        </Button>
        <Button size="small" variant="outlined" onClick={showSshKey}>
          查看部署公钥 (SSH)
        </Button>
        {status?.running && (
          <Chip
            size="small"
            color="primary"
            icon={<CircularProgress size={12} />}
            label={
              status.current
                ? `索引中：${status.current.repo} · ${status.current.phase} ${status.current.percentage}%`
                : '索引进行中'
            }
          />
        )}
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        服务器定时拉取这些 GitLab 仓库并更新 main 索引；修改即时生效，无需重启。
        <br />
        认证方式：填写 Token → 走 HTTPS 克隆/拉取；留空 Token → 走 SSH（用服务器部署公钥，需先在 GitLab 添加该公钥）。
      </Typography>

      {error && (
        <Typography sx={{ color: 'error.main', mb: 2 }}>连接索引服务失败：{error}</Typography>
      )}

      {/* schedule + index all */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 3,
          p: 2,
          border: theme => `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 500 }}>每日定时拉取（小时 0-23）</Typography>
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
      </Box>

      {/* add repo */}
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          mb: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <TextField size="small" label="名称" value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })} sx={{ width: 160 }} />
        <TextField size="small" label="仓库 URL" value={form.url}
          onChange={e => setForm({ ...form, url: e.target.value })} sx={{ flex: 1, minWidth: 260 }} />
        <TextField size="small" label="分支" value={form.branch}
          onChange={e => setForm({ ...form, branch: e.target.value })} sx={{ width: 110 }} />
        <TextField size="small" label="Token（留空走 SSH）" value={form.token} type="password"
          onChange={e => setForm({ ...form, token: e.target.value })} sx={{ width: 190 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={addRepo} disabled={loading}>
          添加
        </Button>
      </Box>

      {/* repo table */}
      <Box sx={{ border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 1, overflow: 'hidden' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1.8fr 0.7fr 0.7fr 1.4fr 1.9fr',
            bgcolor: 'action.hover',
            fontWeight: 600,
            fontSize: 13,
            color: 'text.secondary',
          }}
        >
          <Box sx={cell}>名称</Box>
          <Box sx={cell}>URL</Box>
          <Box sx={cell}>分支</Box>
          <Box sx={cell}>认证</Box>
          <Box sx={cell}>上次索引</Box>
          <Box sx={cell}>操作</Box>
        </Box>
        {(status?.repos || []).map(r => (
          <Box
            key={r.name}
            sx={{
              display: 'grid',
              gridTemplateColumns: '1.1fr 1.8fr 0.7fr 0.7fr 1.4fr 1.9fr',
              borderTop: theme => `1px solid ${theme.palette.divider}`,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Box sx={{ ...cell, fontWeight: 500 }}>{r.name}</Box>
            <Box sx={{ ...cell, wordBreak: 'break-all' }}>{r.url}</Box>
            <Box sx={cell}>{r.branch}</Box>
            <Box sx={cell}>
              <Chip
                size="small"
                variant="outlined"
                color={r.auth === 'ssh' ? 'default' : 'primary'}
                label={(r.auth || (r.hasToken ? 'https' : 'ssh')).toUpperCase()}
              />
            </Box>
            <Box sx={cell}>
              {status?.current?.repo === r.name ? (
                <span style={{ color: '#1976d2', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CircularProgress size={12} />
                  {status.current.phase} {status.current.percentage}%
                </span>
              ) : r.lastRun ? (
                <Tooltip title={r.lastRun.error || ''}>
                  <span style={{ color: r.lastRun.ok ? undefined : '#d32f2f' }}>
                    {r.lastRun.ok
                      ? `${r.lastRun.mode} (+${r.lastRun.added}/~${r.lastRun.modified}/-${r.lastRun.removed})`
                      : '失败'}
                    {'  '}
                    <span style={{ color: '#9aa0a6' }}>
                      {dayjs(r.lastRun.at).format('MM-DD HH:mm')}
                    </span>
                  </span>
                </Tooltip>
              ) : (
                <span style={{ color: '#9aa0a6' }}>未索引</span>
              )}
            </Box>
            <Box sx={{ ...cell, gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => indexOne(r.name)}
                disabled={!!busy || status?.running}
              >
                {busy === r.name ? '...' : '立即索引'}
              </Button>
              <Button size="small" variant="text" onClick={() => openEdit(r)}>
                编辑
              </Button>
              <Tooltip title="删除">
                <IconButton size="small" onClick={() => removeRepo(r.name)} disabled={!!busy}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        ))}
        {status && status.repos.length === 0 && (
          <Box sx={{ ...cell, color: 'text.secondary' }}>暂无仓库，请在上方添加。</Box>
        )}
      </Box>

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>编辑仓库：{editing?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              size="small"
              label="仓库 URL"
              value={editForm.url}
              onChange={e => setEditForm({ ...editForm, url: e.target.value })}
              fullWidth
            />
            <TextField
              size="small"
              label="分支"
              value={editForm.branch}
              onChange={e => setEditForm({ ...editForm, branch: e.target.value })}
              sx={{ width: 160 }}
            />
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
            将下面的公钥添加到 GitLab（用户 SSH Keys，或对应仓库的 Deploy Keys），
            之后不填 Token 的仓库即可通过 SSH 克隆/拉取更新索引。私钥仅保存在服务器内网。
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
    </Box>
  );
};

export default GitLabRepos;
