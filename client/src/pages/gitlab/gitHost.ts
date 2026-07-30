/**
 * Git hosting platform detection — console-side mirror.
 *
 * A personal access token reaches git as HTTP basic auth, and every host wants a
 * different *username* alongside it. Guess wrong and git fails with
 * `HTTP Basic: Access denied`, which reads like a bad token rather than a bad
 * username. The add/edit form detects the platform while the URL is being typed
 * and shows which token flavor that host expects, so a wrong paste surfaces
 * immediately instead of as an opaque failure at index time.
 *
 * This is a copy of the service-side table at
 * `packages/git-index-service/src/git-host.ts` in the claude-context repo — the
 * fetch path picks its basic-auth username from the same mapping. Keep the two in
 * sync. Detection is duplicated rather than fetched so the hint is instant while
 * typing; the service also exposes `GET /detect?url=` as the authoritative answer.
 */

export type GitPlatform =
  | 'huawei-codehub'
  | 'gitlab'
  | 'github'
  | 'gitee'
  | 'bitbucket'
  | 'generic';

/** How the URL authenticates: https + token, or scp/ssh + deploy key. */
export type GitUrlScheme = 'https' | 'ssh' | 'unknown';

export interface GitHostInfo {
  platform: GitPlatform;
  /** Human-readable platform name. */
  label: string;
  /** Basic-auth username that pairs with a token on this platform. */
  tokenUser: string;
  scheme: GitUrlScheme;
  /** Hostname without port, lowercased. Empty when the URL doesn't parse. */
  host: string;
}

const PLATFORM_LABEL: Record<GitPlatform, string> = {
  'huawei-codehub': '华为云 CodeHub',
  gitlab: 'GitLab',
  github: 'GitHub',
  gitee: 'Gitee',
  bitbucket: 'Bitbucket',
  generic: '通用 Git',
};

const PLATFORM_TOKEN_USER: Record<GitPlatform, string> = {
  'huawei-codehub': 'private-token',
  gitlab: 'oauth2',
  github: 'x-access-token',
  gitee: 'oauth2',
  bitbucket: 'x-token-auth',
  // Unknown host: GitLab's convention is the most common for self-hosted Git.
  generic: 'oauth2',
};

/** Where the operator creates the token this platform expects. */
const PLATFORM_TOKEN_HINT: Record<GitPlatform, string> = {
  'huawei-codehub':
    '在 CodeArts/DevCloud「个人设置 → 访问令牌」创建；basic-auth 用户名为 private-token。',
  gitlab:
    '在 GitLab「Settings → Access Tokens」创建（scope 至少 read_repository）；用户名为 oauth2。',
  github:
    '在 GitHub「Settings → Developer settings → Personal access tokens」创建（scope: repo）；用户名为 x-access-token。',
  gitee: '在 Gitee「设置 → 私人令牌」创建；用户名为 oauth2。',
  bitbucket: '在 Bitbucket「App passwords」创建；用户名为 x-token-auth。',
  generic:
    '未识别的 Git 平台，将按 oauth2 → private-token → x-access-token → x-token-auth 依次尝试。',
};

/**
 * Pull the host out of either URL form. `new URL()` only handles the scheme form,
 * so scp syntax (`git@host:group/repo.git`) is matched separately.
 */
export function parseGitUrl(raw: string): { host: string; scheme: GitUrlScheme } {
  const url = (raw || '').trim();
  if (!url) return { host: '', scheme: 'unknown' };

  if (/^(https?|git|ssh):\/\//i.test(url)) {
    try {
      const u = new URL(url);
      const scheme: GitUrlScheme =
        u.protocol === 'http:' || u.protocol === 'https:' ? 'https' : 'ssh';
      return { host: u.hostname.toLowerCase(), scheme };
    } catch {
      return { host: '', scheme: 'unknown' };
    }
  }

  // scp-like: [user@]host:path
  const scp = url.match(/^(?:[A-Za-z0-9._-]+@)?([^:/\s]+):(?!\/)(.+)$/);
  if (scp) return { host: scp[1].toLowerCase(), scheme: 'ssh' };

  return { host: '', scheme: 'unknown' };
}

/** Classify a host into a known platform. */
export function platformOfHost(host: string): GitPlatform {
  const h = (host || '').toLowerCase();
  if (!h) return 'generic';
  // Huawei DevCloud/CodeArts repos live on codehub.devcloud.*.huaweicloud.com
  // and the newer *.codearts.* domains.
  if (h.includes('codehub') || h.includes('devcloud') || h.includes('codearts')) {
    return 'huawei-codehub';
  }
  if (h === 'github.com' || h.endsWith('.github.com')) return 'github';
  if (h === 'gitee.com' || h.endsWith('.gitee.com')) return 'gitee';
  if (h === 'bitbucket.org' || h.endsWith('.bitbucket.org')) return 'bitbucket';
  // Self-hosted GitLab almost always keeps `gitlab` in the hostname.
  if (h.includes('gitlab')) return 'gitlab';
  return 'generic';
}

/** Detect platform + auth flavor from a repository URL. */
export function detectGitHost(url: string): GitHostInfo {
  const { host, scheme } = parseGitUrl(url);
  const platform = platformOfHost(host);
  return {
    platform,
    label: PLATFORM_LABEL[platform],
    tokenUser: PLATFORM_TOKEN_USER[platform],
    scheme,
    host,
  };
}

/** Where to create a token for this platform (shown under the Token field). */
export function tokenHint(platform: GitPlatform): string {
  return PLATFORM_TOKEN_HINT[platform];
}

export { PLATFORM_LABEL };
