import { useEffect, useState } from 'react';
import { GitIndexService } from '@/pages/gitlab/service';
import type { GitRepo } from '@/pages/gitlab/service';

/**
 * 「collection → 仓库/分支」的**权威**映射，取自 git-index-service 的 /repos。
 *
 * 为什么不从 Milvus 推：collection 名里没有分支（`hcc_<slug>_<hash8>`），分支只写在
 * collection 的 description（`codebasePath:<url>:<branch>`）里。于是展示侧一直在做
 * 字符串反推，而它在三种情况下会给出空分支或错分支：
 *   1. description 为空（describeCollection 失败、或手工建的 collection）
 *   2. 旧架构留下的三段 identity（`…/x.git:main:3614644417_q_1913`）
 *   3. 自建 GitLab 的非标准端口（`https://host:8443/g/r.git:main`）
 * 而这些分支**是从「仓库管理」页添加进去的** —— main 是仓库的主分支字段，其余是
 * 保护分支列表，服务端一清二楚。让服务端把「分支 → collection」直接发过来，
 * 展示侧就是查表，不再解析。
 *
 * description 解析保留为兜底：仓库从「仓库管理」删掉之后 collection 可能还在，
 * 那种孤儿行仍然要能显示出分支名。
 */

export interface RepoBranchRef {
  /** 仓库短名（「仓库管理」里填的 name，比 URL 末段更贴近用户的叫法） */
  repo: string;
  branch: string;
  /** 该仓库配置的主分支 —— 权威，不是"名字叫 main/master"猜的 */
  isMain: boolean;
  repoUrl: string;
  identity: string;
}

export type CodeRepoMap = Map<string, RepoBranchRef>;

const EMPTY: CodeRepoMap = new Map();

/** 缓存 TTL：仓库/分支的增删是人工低频操作，30s 足够新，又不至于每次挂载都打一次。 */
const TTL_MS = 30_000;

let cache: { at: number; map: CodeRepoMap } | null = null;
let inFlight: Promise<CodeRepoMap> | null = null;

const buildMap = (repos: GitRepo[]): CodeRepoMap => {
  const map: CodeRepoMap = new Map();
  for (const r of repos) {
    // 旧服务端不发 branches；退化成"只知道有哪些分支、不知道 collection 名"，
    // 此时这张表对该仓库无贡献，展示侧自然落回 description 解析。
    for (const b of r.branches || []) {
      if (!b.collection) continue;
      map.set(b.collection, {
        repo: r.name,
        branch: b.branch,
        isMain: b.isMain,
        repoUrl: r.url,
        identity: b.identity,
      });
    }
  }
  return map;
};

/**
 * 取映射表。多个页面同时挂载只会发一次请求（inFlight 去重），失败返回空表 ——
 * 调用方必须能在空表下正常渲染（走 description 兜底）。
 */
export const fetchCodeRepoMap = async (force = false): Promise<CodeRepoMap> => {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.map;
  if (!force && inFlight) return inFlight;
  const p = GitIndexService.repos()
    .then(res => {
      const map = buildMap(res?.repos || []);
      cache = { at: Date.now(), map };
      return map;
    })
    .catch(() => {
      // git-index-service 没起/网络不通不该让 collection 页整体失败。
      // 也不要缓存失败结果：下次挂载还应该再试一次。
      return cache?.map || EMPTY;
    })
    .finally(() => {
      inFlight = null;
    });
  inFlight = p;
  return p;
};

/** 手工改动仓库配置后让下一次读取绕过 TTL。 */
export const invalidateCodeRepoMap = (): void => {
  cache = null;
};

/**
 * React 入口。首帧返回上一次的缓存（有的话）而不是空表 —— 否则分支列会先闪一下
 * 空白再填上。
 */
export const useCodeRepoMap = (): CodeRepoMap => {
  const [map, setMap] = useState<CodeRepoMap>(() => cache?.map || EMPTY);
  useEffect(() => {
    let alive = true;
    fetchCodeRepoMap().then(m => {
      if (alive) setMap(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return map;
};
