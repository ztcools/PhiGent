export interface GitRepo {
  name: string;
  url: string;
  branch: string;
  protectedBranches?: string[];
  hasToken: boolean;
  auth?: 'https' | 'ssh';
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

  sshKey: (): Promise<{ publicKey: string | null }> =>
    fetch(`${base()}/ssh-key`).then(json),

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
