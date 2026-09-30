/**
 * Git 托管平台识别 —— 控制台侧的镜像实现。
 *
 * 个人访问令牌是以 HTTP basic auth 的方式送到 git 的，而每个平台要求的
 * *用户名* 各不相同。猜错的话 git 会报 `HTTP Basic: Access denied`，看起来像是
 * 令牌有问题，而不是用户名不对。新增/编辑表单会在输入 URL 的过程中识别平台，
 * 并提示该主机期望的令牌类型，这样粘贴错误能立刻暴露，而不是等到建索引时
 * 变成一个语焉不详的失败。
 *
 * 这是 claude-context 仓库中 `packages/git-index-service/src/git-host.ts`
 * 服务端表的副本 —— 拉取路径也从同一份映射中选取 basic-auth 用户名。
 * 两边请保持同步。这里选择复制识别逻辑而不是调用接口，是为了在输入时就能
 * 即时提示；服务端另外提供 `GET /detect?url=` 作为权威结果。
 */

export type GitPlatform =
  | 'huawei-codehub'
  | 'gitlab'
  | 'github'
  | 'gitee'
  | 'bitbucket'
  | 'generic';

/** URL 的认证方式：https + token，或 scp/ssh + deploy key。 */
export type GitUrlScheme = 'https' | 'ssh' | 'unknown';

export interface GitHostInfo {
  platform: GitPlatform;
  /** 便于阅读的平台名称。 */
  label: string;
  /** 该平台上与 token 搭配使用的 basic-auth 用户名。 */
  tokenUser: string;
  scheme: GitUrlScheme;
  /** 不含端口的 hostname，已转为小写。URL 解析失败时为空。 */
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
  // 未知主机：自建 Git 服务最常用 GitLab 的约定。
  generic: 'oauth2',
};

/** 运维人员在该平台创建所需 token 的位置。 */
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
 * 从两种 URL 形式中取出 host。`new URL()` 只能处理带 scheme 的形式，
 * 因此 scp 写法（`git@host:group/repo.git`）需要单独匹配。
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

  // scp 形式：[user@]host:path
  const scp = url.match(/^(?:[A-Za-z0-9._-]+@)?([^:/\s]+):(?!\/)(.+)$/);
  if (scp) return { host: scp[1].toLowerCase(), scheme: 'ssh' };

  return { host: '', scheme: 'unknown' };
}

/** 把 host 归类到已知平台。 */
export function platformOfHost(host: string): GitPlatform {
  const h = (host || '').toLowerCase();
  if (!h) return 'generic';
  // 华为 DevCloud/CodeArts 仓库位于 codehub.devcloud.*.huaweicloud.com
  // 以及较新的 *.codearts.* 域名。
  if (h.includes('codehub') || h.includes('devcloud') || h.includes('codearts')) {
    return 'huawei-codehub';
  }
  if (h === 'github.com' || h.endsWith('.github.com')) return 'github';
  if (h === 'gitee.com' || h.endsWith('.gitee.com')) return 'gitee';
  if (h === 'bitbucket.org' || h.endsWith('.bitbucket.org')) return 'bitbucket';
  // 自建 GitLab 的 hostname 几乎总是带有 `gitlab`。
  if (h.includes('gitlab')) return 'gitlab';
  return 'generic';
}

/** 从仓库 URL 识别平台和认证方式。 */
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

/** 该平台创建 token 的位置（显示在 Token 输入框下方）。 */
export function tokenHint(platform: GitPlatform): string {
  return PLATFORM_TOKEN_HINT[platform];
}

export { PLATFORM_LABEL };
