import type { GitPlatform, GitUrlScheme } from './gitHost';

/**
 * 一个分支连同它的 collection 名 —— 由 git-index-service 算出（它掌握命名规则）。
 *
 * 分支名不在 collection 名里（`hcc_<slug>_<hash8>`，故意如此：一个仓库的 main 和
 * 各分支要能一眼看出同源）。所以展示侧要标注分支，此前只能去 Milvus 读每个
 * collection 的 description 反推 —— description 缺失或是旧架构的三段 identity 时
 * 分支列就空着。而分支是在「仓库管理」里被添加的，本来就是已知量，服务端直接给。
 */
export interface RepoBranch {
  branch: string;
  /** 是否该仓库配置的主分支（不是"名字叫 main/master"，是配置里的那个） */
  isMain: boolean;
  identity: string;
  collection: string;
}

export interface GitRepo {
  name: string;
  url: string;
  branch: string;
  protectedBranches?: string[];
  /** main + 各保护分支，含 collection 名。旧服务端不发这个字段，展示侧要能退化。 */
  branches?: RepoBranch[];
  hasToken: boolean;
  auth?: 'https' | 'ssh';
  // Detected by the service from the URL (git-host.ts). Optional so an older
  // service build that doesn't send them still renders — the console falls back
  // to detecting locally from `url`.
  platform?: GitPlatform;
  platformLabel?: string;
  tokenUser?: string;
  urlScheme?: GitUrlScheme;
}

export interface RepoRunStatus {
  ok: boolean;
  mode?: string;
  indexedFiles?: number;
  added?: number;
  modified?: number;
  removed?: number;
  error?: string;
  at: number;
  durationMs: number;
}

export interface CurrentProgress {
  repo: string;
  branch?: string;
  phase: string;
  percentage: number;
}

export interface GitIndexStatus {
  running: boolean;
  current: CurrentProgress | null;
  lastPassAt: number | null;
  schedule: { dailyHour: number | null; intervalMs: number; nextRunAt: number | null };
  repos: (GitRepo & { lastRuns?: Record<string, RepoRunStatus | null> })[];
}

const base = (): string => {
  const env = (window as any)._env_ || {};
  // GIT_INDEX_HOST lets a deployment point the UI at a remote git-index-service
  // (e.g. http://10.50.4.149:8795) instead of assuming it's co-located with the
  // page host. Falls back to same-hostname:GIT_INDEX_PORT for co-located setups.
  if (env.GIT_INDEX_HOST) return String(env.GIT_INDEX_HOST).replace(/\/$/, '');
  const port = env.GIT_INDEX_PORT || '8795';
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
};

const json = async (res: Response) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

export const GitIndexService = {
  status: (): Promise<GitIndexStatus> => fetch(`${base()}/status`).then(json),

  /**
   * 仓库列表。比 /status 轻（不带 lastRuns、不问调度），collection 页只要
   * 「分支 → collection」这层映射，用这个。
   */
  repos: (): Promise<{ repos: GitRepo[] }> => fetch(`${base()}/repos`).then(json),

  sshKey: (): Promise<{ publicKey: string | null }> =>
    fetch(`${base()}/ssh-key`).then(json),

  /**
   * Authoritative platform detection for a URL about to be added. The form shows
   * an instant local guess (gitHost.ts) while typing and confirms it against this
   * once the URL settles, so a service-side table update wins over the mirror.
   */
  detect: (url: string) =>
    fetch(`${base()}/detect?url=${encodeURIComponent(url)}`).then(json),

  addRepo: (repo: {
    name: string;
    url: string;
    branch?: string;
    protectedBranches?: string[];
    token?: string;
  }) =>
    fetch(`${base()}/repos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(repo),
    }).then(json),

  updateRepo: (
    name: string,
    repo: {
      url?: string;
      branch?: string;
      protectedBranches?: string[];
      token?: string;
    }
  ) =>
    fetch(`${base()}/repos/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(repo),
    }).then(json),

  deleteRepo: (name: string) =>
    fetch(`${base()}/repos/${encodeURIComponent(name)}`, { method: 'DELETE' }).then(json),

  setSchedule: (schedule: { dailyHour?: number | null; intervalMs?: number }) =>
    fetch(`${base()}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    }).then(json),

  indexAll: () => fetch(`${base()}/index`, { method: 'POST' }).then(json),

  indexOne: (name: string) =>
    fetch(`${base()}/index/${encodeURIComponent(name)}`, { method: 'POST' }).then(json),

  indexOneBranch: (name: string, branch: string) =>
    fetch(`${base()}/index/${encodeURIComponent(name)}/${encodeURIComponent(branch)}`, {
      method: 'POST',
    }).then(json),
};
