/**
 * code collection 命名解析工具。
 *
 * claude-context 的向量 collection 命名约定：
 *   collection = (hcc|cc)_<slug32>_<md5(identity)[:8]>
 *   identity   = normalizeGitUrl(repoUrl) + ':' + branch
 * description 形如 `codebasePath:<identity>|tracks:<branch>`，是权威的 identity 来源。
 *
 * 集合页/索引树需要把 collection 归组为「仓库(main) → 各分支」，本模块提供
 * 从 description / collection 名解析 repo + branch 的统一入口。
 */

export interface CodeCollectionInfo {
  /** collection 名（如 hcc_pipeline_b361de2b） */
  collectionName: string;
  /** 仓库短名（如 pipeline）。从 description identity 或 collection slug 解析 */
  repo: string;
  /** 分支名（如 main / dev）。非代码 collection 为空串 */
  branch: string;
  /** 完整 identity（repoUrl:branch），解析不到则为空 */
  identity: string;
  /** 是否主分支（main/master），非代码 collection 亦为 true（自成一组的主行） */
  isRoot: boolean;
  /** 是否 claude-context 的代码 collection（hcc_/cc_ 前缀或有 codebasePath 描述） */
  isCode: boolean;
  /**
   * 仓库/分支的来源：
   *   'registry' —— 来自「仓库管理」的权威映射（见 codeRepoMap.ts），可信
   *   'description' —— 从 Milvus description 反推（兜底）
   *   'slug' —— 连 description 都没有，只能从 collection 名的 slug 猜，分支未知
   *   'none' —— 非代码 collection，没有仓库/分支语义
   * UI 可据此提示"这个 collection 已不在仓库管理里"（registry 之外的代码 collection）。
   */
  source: 'registry' | 'description' | 'slug' | 'none';
}

/** 权威映射的查表函数（collection 名 → 仓库/分支）。见 utils/codeRepoMap.ts。 */
export type RepoRefLookup = (collectionName: string) =>
  | { repo: string; branch: string; isMain: boolean; repoUrl?: string; identity?: string }
  | undefined;

const ROOT_BRANCHES = new Set(['main', 'master']);

/**
 * 基础设施 collection：claude-context 自己的共享索引状态表和 embedding 缓存表。
 * 它们不是"仓库"，列表页/索引树都应该隐藏。
 */
export const isInfraCollection = (name: string): boolean =>
  name === 'code_index_state' || name.startsWith('embedding_cache_');

/** 从 repoUrl 取仓库短名（去 .git、取最后一段） */
export const repoLabel = (repoUrl?: string): string => {
  if (!repoUrl) return '';
  const seg = repoUrl.replace(/\.git$/i, '').split(/[/:]/).filter(Boolean).pop();
  return seg || repoUrl;
};

/**
 * 把 identity 拆成 repoUrl + branch。
 *
 * identity 是 `<repoUrl>:<branch>`，但 repoUrl 自己带冒号（scheme、scp 形式的
 * `git@host:`、Windows 盘符），所以不能直接按冒号切。做法是先把这些"结构性冒号"
 * 归入前缀，剩下的部分第一段才是路径、第二段才是分支。
 *
 * 用 lastIndexOf(':') 是不行的：旧架构（dev-aware 个人 collection）留下的
 * identity 有第三段开发者 id —— `…/context.git:main:3614644417_q_1913`
 * 会被解析成 branch=开发者 id、repo=main。这里统一只取路径之后的那一段作分支。
 *
 * 还有一类结构性冒号 scheme 前缀盖不住：自建 GitLab 的非标准端口
 * `https://gitlab.example.com:8443/g/r.git:main` —— 直接取第二段会得到
 * branch=`8443/g/r.git`。端口的判据是"冒号后紧跟数字，数字后是路径分隔符或结尾"，
 * 命中就把它并回 repoUrl 再往后取分支。
 */
export function splitIdentity(identity: string): { repoUrl: string; branch: string } {
  let head = '';
  let rest = identity;

  const scheme = identity.match(/^[a-z][a-z0-9+.-]*:\/\//i);
  const scp = identity.match(/^[^/\s@]+@[^:/\s]+:/);
  const winDrive = identity.match(/^[A-Za-z]:[\\/]/);
  if (scheme) {
    head = scheme[0];
  } else if (scp) {
    head = scp[0];
  } else if (winDrive) {
    head = identity.slice(0, 2);
  }
  rest = identity.slice(head.length);

  const parts = rest.split(':');
  if (parts.length < 2) return { repoUrl: identity, branch: '' };

  let path = parts[0];
  let next = 1;
  if (/^\d+(\/|$)/.test(parts[1])) {
    path += ':' + parts[1];
    next = 2;
  }
  return { repoUrl: head + path, branch: parts[next] ?? '' };
}

/** 从 identity 拆 branch */
export const branchOfIdentity = (identity: string): string =>
  splitIdentity(identity).branch;

/** 从 identity 拆 repoUrl 部分 */
export const repoOfIdentity = (identity: string): string =>
  splitIdentity(identity).repoUrl;

/**
 * 解析一个 collection 的仓库/分支归属信息。
 *
 * 三级取值，先权威后猜测：
 *   1. `lookup`（「仓库管理」的 collection → 分支映射）—— 命中即用，分支和"谁是主分支"
 *      都是配置里写着的事实。
 *   2. description 的 `codebasePath:<identity>` —— 兜底。仓库已从「仓库管理」删除、
 *      collection 还留着的孤儿行走这条。
 *   3. collection 名的 slug —— 连 description 都没有，只能拿到仓库名，分支未知。
 *      **不再假装分支是 main**：编出来的 main 会让这一行冒充主行，把真正的 main
 *      挤成子行（真实数据里 master 抢 main 主行位就是这么来的）。
 *
 * @param collectionName collection 名
 * @param description    collection 的 description（可能含 codebasePath:<identity>）
 * @param lookup         权威映射查表函数，见 utils/codeRepoMap.ts
 */
export function parseCodeCollection(
  collectionName: string,
  description?: string,
  lookup?: RepoRefLookup,
): CodeCollectionInfo {
  let identity = '';
  if (description && description.startsWith('codebasePath:')) {
    identity = description.slice('codebasePath:'.length).split('|')[0].trim();
  }
  const slugMatch = collectionName.match(/^(?:hcc|cc)_(.+)_[0-9a-f]{8}$/i);
  const ref = lookup?.(collectionName);
  const isCode = !!ref || !!identity || !!slugMatch;

  // 非代码 collection（用户手建的）没有仓库/分支语义 —— 名字照原样展示、分支留空，
  // 各自成一个单行组，不参与分支层次。
  if (!isCode) {
    return {
      collectionName,
      repo: collectionName,
      branch: '',
      identity: '',
      isRoot: true,
      isCode: false,
      source: 'none',
    };
  }

  if (ref) {
    return {
      collectionName,
      repo: ref.repo,
      branch: ref.branch,
      identity: ref.identity || identity,
      // 「仓库管理」里配的主分支才是主分支。同一仓库 main 与 master 都被索引时，
      // 靠名字判断会两个都算主行、先到者占位；这里只有一个 isMain=true。
      isRoot: ref.isMain,
      isCode: true,
      source: 'registry',
    };
  }

  if (identity) {
    const parsed = splitIdentity(identity);
    return {
      collectionName,
      repo: repoLabel(parsed.repoUrl),
      // identity 解析不出分支段（本地路径索引）时按主分支处理，避免整组没有主行。
      branch: parsed.branch || 'main',
      identity,
      isRoot: ROOT_BRANCHES.has(parsed.branch || 'main'),
      isCode: true,
      source: 'description',
    };
  }

  // slug 由 core 的 slugForRepoIdentity 生成（非字母数字已替换成 _），原样展示。
  return {
    collectionName,
    repo: slugMatch![1],
    branch: '',
    identity: '',
    // 分支未知也要能当主行，否则这个仓库整组没有仓库名可显示。
    isRoot: true,
    isCode: true,
    source: 'slug',
  };
}

/**
 * 把一组 code collection 归组为「仓库 → 分支列表」的两级结构。
 * 每个仓库的 main/master 分支排最前，其余分支按名称排序。
 */
export interface RepoGroup<T> {
  repo: string;
  /** 主分支项（可能为空——云端尚未索引 main） */
  root: T | null;
  /** 其余分支项，按分支名排序 */
  branches: T[];
  /** 该仓库全部分支的总行数（用于主行展示） */
  totalRows: number;
}

export function groupByRepo<T extends CodeCollectionInfo & { rowCount?: number }>(
  items: T[],
): RepoGroup<T>[] {
  const map = new Map<string, RepoGroup<T>>();
  for (const item of items) {
    // 非代码 collection 各自独立成组 —— 用 collection 名作 key，免得和同名仓库撞进一组。
    const key = item.isCode ? `c:${item.repo}` : `x:${item.collectionName}`;
    let g = map.get(key);
    if (!g) {
      g = { repo: item.repo, root: null, branches: [], totalRows: 0 };
      map.set(key, g);
    }
    // 同一仓库理论上只有一个 main；真出现重复（master + main 都索引了）时先到者
    // 当主行，后到者退回分支列表，不丢数据。
    if (item.isRoot && !g.root) g.root = item;
    else g.branches.push(item);
    g.totalRows += item.rowCount || 0;
  }
  const groups = Array.from(map.values());
  for (const g of groups) {
    g.branches.sort((a, b) => a.branch.localeCompare(b.branch));
  }
  groups.sort((a, b) => a.repo.localeCompare(b.repo));
  return groups;
}

/** 组内行的层次角色：主行（显示仓库名）/ 子行（仓库列留空、缩进） */
export interface RepoGroupRow<T> {
  item: T;
  /** true = 该仓库组的主行，显示仓库名；false = 缩进子行，仓库列留空 */
  isGroupHead: boolean;
  /** 该组共有几行（主行用来展示"N 个分支"） */
  groupSize: number;
}

/**
 * 把仓库组摊平成表格行序：每组主行在前（优先 main/master；该仓库尚未索引 main 时
 * 由排序最靠前的分支充当主行，否则整组没有仓库名可显示），其余分支为缩进子行。
 */
export function flattenRepoGroups<T extends CodeCollectionInfo & { rowCount?: number }>(
  groups: RepoGroup<T>[],
): RepoGroupRow<T>[] {
  const rows: RepoGroupRow<T>[] = [];
  for (const g of groups) {
    const ordered = g.root ? [g.root, ...g.branches] : g.branches;
    const groupSize = ordered.length;
    ordered.forEach((item, i) => {
      rows.push({ item, isGroupHead: i === 0, groupSize });
    });
  }
  return rows;
}
