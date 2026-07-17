import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Chip,
  CircularProgress,
  Tooltip,
} from '@mui/material';
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
    const t = setInterval(load, 8000);
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
        {status?.running && (
          <Chip size="small" color="primary" label="索引进行中" icon={<CircularProgress size={12} />} />
        )}
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        服务器定时拉取这些 GitLab 仓库并更新 main 索引；修改即时生效，无需重启。
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
        <TextField size="small" label="Token（私有库）" value={form.token} type="password"
          onChange={e => setForm({ ...form, token: e.target.value })} sx={{ width: 170 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={addRepo} disabled={loading}>
          添加
        </Button>
      </Box>

      {/* repo table */}
      <Box sx={{ border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 1, overflow: 'hidden' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 2fr 0.8fr 0.6fr 1.6fr 1.4fr',
            bgcolor: 'action.hover',
            fontWeight: 600,
            fontSize: 13,
            color: 'text.secondary',
          }}
        >
          <Box sx={cell}>名称</Box>
          <Box sx={cell}>URL</Box>
          <Box sx={cell}>分支</Box>
          <Box sx={cell}>Token</Box>
          <Box sx={cell}>上次索引</Box>
          <Box sx={cell}>操作</Box>
        </Box>
        {(status?.repos || []).map(r => (
          <Box
            key={r.name}
            sx={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 2fr 0.8fr 0.6fr 1.6fr 1.4fr',
              borderTop: theme => `1px solid ${theme.palette.divider}`,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Box sx={{ ...cell, fontWeight: 500 }}>{r.name}</Box>
            <Box sx={{ ...cell, wordBreak: 'break-all' }}>{r.url}</Box>
            <Box sx={cell}>{r.branch}</Box>
            <Box sx={cell}>{r.hasToken ? '✓' : '—'}</Box>
            <Box sx={cell}>
              {r.lastRun ? (
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
    </Box>
  );
};

export default GitLabRepos;
