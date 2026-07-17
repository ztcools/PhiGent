export interface GitRepo {
  name: string;
  url: string;
  branch: string;
  hasToken: boolean;
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

export interface GitIndexStatus {
  running: boolean;
  lastPassAt: number | null;
  schedule: { dailyHour: number | null; intervalMs: number; nextRunAt: number | null };
  repos: (GitRepo & { lastRun: RepoRunStatus | null })[];
}

const base = (): string => {
  const env = (window as any)._env_ || {};
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

  addRepo: (repo: { name: string; url: string; branch: string; token?: string }) =>
    fetch(`${base()}/repos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(repo),
    }).then(json),

  updateRepo: (
    name: string,
    repo: { url?: string; branch?: string; token?: string }
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
};
