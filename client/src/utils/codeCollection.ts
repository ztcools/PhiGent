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
  /** 分支名（如 main / dev）。从 description identity 解析；缺省 main */
  branch: string;
  /** 完整 identity（repoUrl:branch），解析不到则为空 */
  identity: string;
  /** 是否主分支（main/master） */
  isRoot: boolean;
}

const ROOT_BRANCHES = new Set(['main', 'master']);

/** 从 repoUrl 取仓库短名（去 .git、取最后一段） */
export const repoLabel = (repoUrl?: string): string => {
  if (!repoUrl) return '';
  const seg = repoUrl.replace(/\.git$/i, '').split(/[/:]/).filter(Boolean).pop();
  return seg || repoUrl;
};

/** 从 identity（repoUrl:branch）拆 branch */
export const branchOfIdentity = (identity: string): string => {
  const i = identity.lastIndexOf(':');
  return i >= 0 ? identity.slice(i + 1) : identity;
};

/** 从 identity 拆 repoUrl 部分 */
export const repoOfIdentity = (identity: string): string => {
  const i = identity.lastIndexOf(':');
  return i >= 0 ? identity.slice(0, i) : identity;
};

/**
 * 解析一个 code collection 的归属信息。
 * @param collectionName collection 名
 * @param description    collection 的 description（可能含 codebasePath:<identity>）
 */
export function parseCodeCollection(
  collectionName: string,
  description?: string,
): CodeCollectionInfo {
  let identity = '';
  if (description && description.startsWith('codebasePath:')) {
    identity = description.slice('codebasePath:'.length).split('|')[0].trim();
  }

  let repo = '';
  let branch = 'main';
  if (identity) {
    repo = repoLabel(repoOfIdentity(identity));
    branch = branchOfIdentity(identity);
  } else {
    // 从 collection 名退化解析 slug：hcc_<slug>_<hash8>
    const m = collectionName.match(/^(?:hcc|cc)_(.+)_[0-9a-f]{8}$/i);
    repo = m ? m[1].replace(/_/g, '-') : collectionName;
  }

  return {
    collectionName,
    repo,
    branch,
    identity,
    isRoot: ROOT_BRANCHES.has(branch),
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
    let g = map.get(item.repo);
    if (!g) {
      g = { repo: item.repo, root: null, branches: [], totalRows: 0 };
      map.set(item.repo, g);
    }
    if (item.isRoot) g.root = item;
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
